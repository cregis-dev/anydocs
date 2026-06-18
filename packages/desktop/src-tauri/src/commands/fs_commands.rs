//! Native filesystem commands exposed to the renderer over Tauri IPC (Story 9.2).
//!
//! These let the desktop renderer read/write/list/delete project files without
//! an HTTP layer. Every operation is confined to the **active project root**
//! (authoritative, stored in Rust state — never trusted from the renderer
//! per-call) and writes are atomic (write-temp-then-rename).
//!
//! Commands adapt I/O only — no domain logic (validation, publication
//! filtering, content modeling stay in `@anydocs/core`; architecture.md
//! §"No duplicate domain logic"). The TypeScript `desktop-fs-adapter.ts` that
//! calls these is Story 9.3; exhaustive atomic fault-injection is Story 9.4.

use std::{
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

use serde::Serialize;
use tauri::State;

use crate::ActiveProjectRoot;

/// Process-local counter for unique temp-file names during atomic writes.
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FsErrorKind {
    NoActiveProjectRoot,
    InvalidPath,
    PathEscapesRoot,
    NotFound,
    Io,
}

/// Serializable error returned to the renderer. Story 9.3 maps `kind` onto
/// typed `FsReadError` / `FsWriteError` domain errors in `@anydocs/core`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsError {
    kind: FsErrorKind,
    message: String,
}

impl FsError {
    fn new(kind: FsErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
}

/// Map an optional stored root to a required one (testable without Tauri state).
fn require_root(root: Option<PathBuf>) -> Result<PathBuf, FsError> {
    root.ok_or_else(|| {
        FsError::new(
            FsErrorKind::NoActiveProjectRoot,
            "No active project root set. Call set_active_project_root first.",
        )
    })
}

/// Read the canonicalized active project root from managed state.
fn active_root(state: &State<'_, ActiveProjectRoot>) -> Result<PathBuf, FsError> {
    let guard = state
        .0
        .lock()
        .map_err(|_| FsError::new(FsErrorKind::Io, "project root state poisoned"))?;
    require_root(guard.clone())
}

/// Reject absolute paths and any `.`/`..`/root/prefix components, returning a
/// clean relative path built only from `Normal` components.
fn validate_relative(rel: &str) -> Result<PathBuf, FsError> {
    let mut out = PathBuf::new();
    for component in Path::new(rel).components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(FsError::new(
                    FsErrorKind::PathEscapesRoot,
                    "parent-directory traversal ('..') is not allowed",
                ));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(FsError::new(
                    FsErrorKind::InvalidPath,
                    "absolute paths are not allowed; pass a path relative to the project root",
                ));
            }
        }
    }
    if out.as_os_str().is_empty() {
        return Err(FsError::new(FsErrorKind::InvalidPath, "path must not be empty"));
    }
    Ok(out)
}

/// Resolve a path that must already exist (read / list / delete).
/// Canonicalization resolves symlinks, so a symlink whose target escapes the
/// root fails the containment check (AC2).
fn resolve_existing(root: &Path, rel: &str) -> Result<PathBuf, FsError> {
    let safe_rel = validate_relative(rel)?;
    let canonical_root = fs::canonicalize(root)
        .map_err(|e| FsError::new(FsErrorKind::Io, format!("cannot resolve project root: {e}")))?;
    let canonical = fs::canonicalize(canonical_root.join(&safe_rel))
        .map_err(|e| FsError::new(FsErrorKind::NotFound, format!("cannot resolve path: {e}")))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(FsError::new(
            FsErrorKind::PathEscapesRoot,
            "target resolves outside the active project root",
        ));
    }
    Ok(canonical)
}

/// Resolve a path that may not exist yet (write/create). The parent directory
/// must exist and be inside the root; the final component is appended after the
/// canonical parent check.
fn resolve_for_write(root: &Path, rel: &str) -> Result<PathBuf, FsError> {
    let safe_rel = validate_relative(rel)?;
    let canonical_root = fs::canonicalize(root)
        .map_err(|e| FsError::new(FsErrorKind::Io, format!("cannot resolve project root: {e}")))?;
    let joined = canonical_root.join(&safe_rel);
    let file_name = joined
        .file_name()
        .ok_or_else(|| FsError::new(FsErrorKind::InvalidPath, "path has no file name"))?
        .to_owned();
    let parent = joined
        .parent()
        .ok_or_else(|| FsError::new(FsErrorKind::InvalidPath, "path has no parent directory"))?;
    let canonical_parent = fs::canonicalize(parent).map_err(|e| {
        FsError::new(
            FsErrorKind::NotFound,
            format!("parent directory does not exist: {e}"),
        )
    })?;
    if !canonical_parent.starts_with(&canonical_root) {
        return Err(FsError::new(
            FsErrorKind::PathEscapesRoot,
            "target resolves outside the active project root",
        ));
    }
    Ok(canonical_parent.join(file_name))
}

/// Real temp-write step: create the temp file, write all bytes, flush + fsync.
fn real_write_temp(temp: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = fs::File::create(temp)?;
    file.write_all(bytes)?;
    file.flush()?;
    file.sync_all()?;
    Ok(())
}

/// Write `bytes` to `target` atomically: temp file in the same directory,
/// flushed + fsynced, then renamed over the target. On any failure the temp
/// artifact is removed and the original target is left unchanged (AC3/AC4).
fn atomic_write(target: &Path, bytes: &[u8]) -> Result<(), FsError> {
    atomic_write_with(target, bytes, real_write_temp, |from, to| fs::rename(from, to))
}

/// Atomic write with injectable `write_temp` / `rename` steps. The default ops
/// ([`real_write_temp`] + `fs::rename`) are used by [`atomic_write`]; tests pass
/// failing closures to prove NFR27 (original untouched on mid-flight failure).
fn atomic_write_with<W, R>(
    target: &Path,
    bytes: &[u8],
    write_temp: W,
    rename: R,
) -> Result<(), FsError>
where
    W: Fn(&Path, &[u8]) -> std::io::Result<()>,
    R: Fn(&Path, &Path) -> std::io::Result<()>,
{
    let parent = target
        .parent()
        .ok_or_else(|| FsError::new(FsErrorKind::InvalidPath, "target has no parent directory"))?;
    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| FsError::new(FsErrorKind::InvalidPath, "target has an invalid file name"))?;

    let unique = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp = parent.join(format!(
        ".{file_name}.{}.{unique}.anydocs-tmp",
        std::process::id()
    ));

    if let Err(error) = write_temp(&temp, bytes) {
        let _ = fs::remove_file(&temp);
        return Err(FsError::new(
            FsErrorKind::Io,
            format!("failed writing temp file: {error}"),
        ));
    }

    if let Err(error) = rename(&temp, target) {
        let _ = fs::remove_file(&temp);
        return Err(FsError::new(
            FsErrorKind::Io,
            format!("failed atomic rename: {error}"),
        ));
    }

    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryInfo {
    name: String,
    is_dir: bool,
}

#[tauri::command]
pub fn set_active_project_root(
    state: State<'_, ActiveProjectRoot>,
    path: String,
) -> Result<String, FsError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(FsError::new(FsErrorKind::InvalidPath, "path is required"));
    }
    let canonical = fs::canonicalize(trimmed)
        .map_err(|e| FsError::new(FsErrorKind::NotFound, format!("project root not found: {e}")))?;
    if !canonical.is_dir() {
        return Err(FsError::new(
            FsErrorKind::InvalidPath,
            "project root must be a directory",
        ));
    }
    let mut guard = state
        .0
        .lock()
        .map_err(|_| FsError::new(FsErrorKind::Io, "project root state poisoned"))?;
    *guard = Some(canonical.clone());
    Ok(canonical.display().to_string())
}

#[tauri::command]
pub fn fs_read(state: State<'_, ActiveProjectRoot>, path: String) -> Result<String, FsError> {
    let root = active_root(&state)?;
    let target = resolve_existing(&root, &path)?;
    fs::read_to_string(&target).map_err(|e| FsError::new(FsErrorKind::Io, format!("read failed: {e}")))
}

#[tauri::command]
pub fn fs_write(
    state: State<'_, ActiveProjectRoot>,
    path: String,
    contents: String,
) -> Result<(), FsError> {
    let root = active_root(&state)?;
    let target = resolve_for_write(&root, &path)?;
    atomic_write(&target, contents.as_bytes())
}

#[tauri::command]
pub fn fs_list(
    state: State<'_, ActiveProjectRoot>,
    path: String,
) -> Result<Vec<DirEntryInfo>, FsError> {
    let root = active_root(&state)?;
    let target = resolve_existing(&root, &path)?;
    let read_dir = fs::read_dir(&target)
        .map_err(|e| FsError::new(FsErrorKind::Io, format!("list failed: {e}")))?;
    let mut entries = Vec::new();
    for entry in read_dir {
        let entry =
            entry.map_err(|e| FsError::new(FsErrorKind::Io, format!("list entry failed: {e}")))?;
        let file_type = entry
            .file_type()
            .map_err(|e| FsError::new(FsErrorKind::Io, format!("file type failed: {e}")))?;
        entries.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
        });
    }
    Ok(entries)
}

#[tauri::command]
pub fn fs_mkdir(state: State<'_, ActiveProjectRoot>, path: String) -> Result<(), FsError> {
    let root = active_root(&state)?;
    // Reuse the write-path resolver: it canonicalizes + containment-checks the
    // parent, so the new directory is guaranteed inside the project root. The
    // parent must already exist (one new level at a time); recursive on the
    // final segment. Idempotent when the directory already exists.
    let target = resolve_for_write(&root, &path)?;
    fs::create_dir_all(&target).map_err(|e| FsError::new(FsErrorKind::Io, format!("mkdir failed: {e}")))
}

#[tauri::command]
pub fn fs_delete(state: State<'_, ActiveProjectRoot>, path: String) -> Result<(), FsError> {
    let root = active_root(&state)?;
    let target = resolve_existing(&root, &path)?;
    if target.is_dir() {
        return Err(FsError::new(
            FsErrorKind::InvalidPath,
            "refusing to delete a directory",
        ));
    }
    fs::remove_file(&target).map_err(|e| FsError::new(FsErrorKind::Io, format!("delete failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root() -> PathBuf {
        let unique = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "anydocs-fs-test-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        // Canonicalize so comparisons are consistent (e.g. macOS /var → /private/var).
        fs::canonicalize(&dir).unwrap()
    }

    fn no_temp_leftovers(dir: &Path) -> bool {
        fs::read_dir(dir)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .all(|entry| !entry.file_name().to_string_lossy().contains("anydocs-tmp"))
    }

    #[test]
    fn require_root_errors_when_unset() {
        let err = require_root(None).unwrap_err();
        assert!(matches!(err.kind, FsErrorKind::NoActiveProjectRoot));
        assert!(require_root(Some(PathBuf::from("/tmp"))).is_ok());
    }

    #[test]
    fn validate_relative_rejects_absolute_and_parent_traversal() {
        assert!(validate_relative("/etc/passwd").is_err());
        assert!(validate_relative("../escape").is_err());
        assert!(validate_relative("pages/../../escape").is_err());
        assert!(validate_relative("").is_err());
        assert!(validate_relative("pages/en/intro.json").is_ok());
    }

    #[test]
    fn resolve_existing_rejects_targets_outside_root() {
        let root = temp_root();
        fs::create_dir_all(root.join("pages")).unwrap();
        fs::write(root.join("pages/intro.json"), "{}").unwrap();
        assert!(resolve_existing(&root, "pages/intro.json").is_ok());
        // a relative path that would escape is rejected before any I/O
        let err = resolve_existing(&root, "../escape").unwrap_err();
        assert!(matches!(err.kind, FsErrorKind::PathEscapesRoot));
        fs::remove_dir_all(&root).ok();
    }

    #[cfg(unix)]
    #[test]
    fn symlink_escaping_root_is_rejected() {
        use std::os::unix::fs::symlink;
        let root = temp_root();
        let outside = temp_root(); // a sibling dir outside `root`
        fs::write(outside.join("secret.txt"), "secret").unwrap();
        // symlink inside root → file outside root
        symlink(outside.join("secret.txt"), root.join("link.txt")).unwrap();
        let err = resolve_existing(&root, "link.txt").unwrap_err();
        assert!(matches!(err.kind, FsErrorKind::PathEscapesRoot));
        fs::remove_dir_all(&root).ok();
        fs::remove_dir_all(&outside).ok();
    }

    #[test]
    fn atomic_write_creates_exact_contents_and_leaves_no_temp() {
        let root = temp_root();
        let target = resolve_for_write(&root, "navigation.json").unwrap();
        atomic_write(&target, b"{\"version\":1}").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "{\"version\":1}");
        // no leftover temp artifacts
        let leftovers: Vec<_> = fs::read_dir(&root)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains("anydocs-tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temp file was not cleaned up");
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn injected_temp_write_failure_leaves_original_unchanged() {
        let root = temp_root();
        let target = root.join("page.json");
        fs::write(&target, b"ORIGINAL").unwrap();
        for _ in 0..25 {
            let err = atomic_write_with(
                &target,
                b"NEWDATA",
                |temp, _bytes| {
                    // simulate a partial temp write, then fail mid-flight
                    let _ = fs::write(temp, b"partial-garbage");
                    Err(std::io::Error::other("injected temp-write failure"))
                },
                |from, to| fs::rename(from, to),
            )
            .unwrap_err();
            assert!(matches!(err.kind, FsErrorKind::Io));
            assert_eq!(fs::read(&target).unwrap(), b"ORIGINAL"); // 100% unchanged
        }
        assert!(no_temp_leftovers(&root), "temp artifact must be cleaned up");
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn injected_rename_failure_leaves_original_unchanged() {
        let root = temp_root();
        let target = root.join("page.json");
        fs::write(&target, b"ORIGINAL").unwrap();
        for _ in 0..25 {
            let err = atomic_write_with(
                &target,
                b"NEWDATA",
                real_write_temp, // temp write succeeds
                |_from, _to| Err(std::io::Error::other("injected rename failure")),
            )
            .unwrap_err();
            assert!(matches!(err.kind, FsErrorKind::Io));
            assert_eq!(fs::read(&target).unwrap(), b"ORIGINAL");
        }
        assert!(
            no_temp_leftovers(&root),
            "temp artifact must be cleaned up after a rename failure"
        );
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn successful_write_through_seam_has_full_content_and_no_temp() {
        let root = temp_root();
        let target = root.join("page.json");
        atomic_write_with(&target, b"FULL-CONTENT", real_write_temp, |from, to| {
            fs::rename(from, to)
        })
        .unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"FULL-CONTENT");
        assert!(no_temp_leftovers(&root));
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn atomic_write_replaces_existing_file_wholesale() {
        let root = temp_root();
        let target = resolve_for_write(&root, "page.json").unwrap();
        atomic_write(&target, b"old-and-longer-content").unwrap();
        atomic_write(&target, b"new").unwrap();
        // wholesale replace — no leftover bytes from the previous (longer) write
        assert_eq!(fs::read_to_string(&target).unwrap(), "new");
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn mkdir_path_logic_creates_within_root_and_is_idempotent() {
        let root = temp_root();
        // mkdir resolution returns a contained target; create_dir_all is idempotent.
        let target = resolve_for_write(&root, "pages").unwrap();
        fs::create_dir_all(&target).unwrap();
        assert!(target.is_dir());
        fs::create_dir_all(&target).unwrap(); // idempotent
        // escape rejected before any creation
        assert!(resolve_for_write(&root, "../escape-dir").is_err());
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn resolve_for_write_rejects_missing_parent_and_escape() {
        let root = temp_root();
        assert!(resolve_for_write(&root, "missing-dir/file.json").is_err());
        assert!(resolve_for_write(&root, "../outside.json").is_err());
        fs::remove_dir_all(&root).ok();
    }
}
