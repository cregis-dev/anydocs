//! Tauri command handlers exposed to the renderer over IPC.
//!
//! Story 9.1 extracted these from `lib.rs` into a dedicated command module
//! directory so that Story 9.2's native filesystem bridge (`fs_commands.rs`)
//! has a home alongside the existing bridge commands. Commands stay thin: they
//! adapt I/O only — domain logic lives in `@anydocs/core` (architecture.md
//! §"No duplicate domain logic").

use std::{
    ffi::OsStr,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Arc,
};

use serde::Serialize;
use tauri::State;

use crate::{DesktopContext, DesktopRuntimeState};

/// Native filesystem commands (Story 9.2) — read/write/list/delete confined to
/// the active project root, with atomic writes. Re-exported for `generate_handler!`.
pub mod fs_commands;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeState {
    app_name: &'static str,
    platform: &'static str,
    runtime: &'static str,
    version: &'static str,
}

#[tauri::command]
pub fn get_bridge_state() -> BridgeState {
    BridgeState {
        app_name: "Anydocs",
        platform: std::env::consts::OS,
        runtime: "tauri",
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
pub fn get_desktop_context(state: State<'_, Arc<DesktopRuntimeState>>) -> DesktopContext {
    state.context.clone()
}

#[tauri::command]
pub fn pick_project_directory() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Select an Anydocs project directory")
        .pick_folder()
        .map(|path| path.display().to_string())
}

fn spawn_open_command(program: &str, args: &[&OsStr]) -> Result<(), String> {
    Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to launch {program}: {error}"))
}

#[tauri::command]
pub fn open_path(path: String) -> Result<bool, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is required.".to_string());
    }

    let target = PathBuf::from(trimmed);
    if !target.exists() {
        return Err(format!("Path does not exist: {}", target.display()));
    }

    #[cfg(target_os = "macos")]
    {
        spawn_open_command("open", &[target.as_os_str()])?;
    }

    #[cfg(target_os = "windows")]
    {
        spawn_open_command("explorer", &[target.as_os_str()])?;
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        spawn_open_command("xdg-open", &[target.as_os_str()])?;
    }

    Ok(true)
}
