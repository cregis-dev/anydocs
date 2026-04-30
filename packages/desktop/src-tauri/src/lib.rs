use serde::Serialize;
use std::{
    ffi::OsStr,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Manager, State,
};

const DESKTOP_MENU_EVENT_NAME: &str = "__ANYDOCS_DESKTOP_MENU__";
const MENU_ACTION_OPEN_PROJECT: &str = "open-project";
const MENU_ACTION_NEW_PAGE: &str = "new-page";
const MENU_ACTION_SAVE: &str = "save";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeState {
    app_name: &'static str,
    platform: &'static str,
    runtime: &'static str,
    version: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopContext {
    runtime: &'static str,
    server_base_url: String,
    managed_server: bool,
}

struct DesktopRuntimeState {
    child: Mutex<Option<Child>>,
    context: DesktopContext,
}

fn emit_menu_action(window: &tauri::WebviewWindow, action: &str) {
    let script = format!(
    "window.dispatchEvent(new CustomEvent({event_name:?}, {{ detail: {{ action: {action:?} }} }}));",
    event_name = DESKTOP_MENU_EVENT_NAME,
    action = action,
  );

    let _ = window.eval(script);
}

fn build_app_menu<R: tauri::Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<Menu<R>> {
    let open_project = MenuItem::with_id(
        manager,
        MENU_ACTION_OPEN_PROJECT,
        "Open Project…",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let new_page = MenuItem::with_id(
        manager,
        MENU_ACTION_NEW_PAGE,
        "New Page",
        true,
        Some("CmdOrCtrl+N"),
    )?;
    let save = MenuItem::with_id(manager, MENU_ACTION_SAVE, "Save", true, Some("CmdOrCtrl+S"))?;
    let close_window = PredefinedMenuItem::close_window(manager, None)?;
    let quit = PredefinedMenuItem::quit(manager, None)?;

    let file_menu = Submenu::with_items(
        manager,
        "File",
        true,
        &[
            &open_project,
            &new_page,
            &save,
            &PredefinedMenuItem::separator(manager)?,
            &close_window,
            &quit,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        manager,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(manager, None)?,
            &PredefinedMenuItem::redo(manager, None)?,
            &PredefinedMenuItem::separator(manager)?,
            &PredefinedMenuItem::cut(manager, None)?,
            &PredefinedMenuItem::copy(manager, None)?,
            &PredefinedMenuItem::paste(manager, None)?,
            &PredefinedMenuItem::select_all(manager, None)?,
        ],
    )?;

    Menu::with_items(manager, &[&file_menu, &edit_menu])
}

fn read_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn default_server_base_url() -> String {
    read_env("ANYDOCS_DESKTOP_SERVER_URL").unwrap_or_else(|| "http://127.0.0.1:33440".to_string())
}

fn managed_server_enabled() -> bool {
    !matches!(
        std::env::var("ANYDOCS_DESKTOP_MANAGED_SERVER")
            .ok()
            .as_deref(),
        Some("0")
    )
}

fn resolve_desktop_server_entry() -> PathBuf {
    if let Some(entry) = read_env("ANYDOCS_DESKTOP_SERVER_ENTRY") {
        return PathBuf::from(entry);
    }

    let bundled_entry = bundled_resources_dir()
        .map(|resources_dir| resources_dir.join("desktop-server/dist/index.js"));

    if let Some(entry) = bundled_entry {
        if entry.exists() {
            return entry;
        }
    }

    let source_entry =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../desktop-server/dist/index.js");
    source_entry.canonicalize().unwrap_or(source_entry)
}

fn bundled_resources_dir() -> Option<PathBuf> {
    std::env::current_exe().ok().and_then(|exe| {
        exe.parent().and_then(|macos_dir| {
            macos_dir
                .parent()
                .map(|contents_dir| contents_dir.join("Resources"))
        })
    })
}

fn resolve_node_executable() -> PathBuf {
    if let Some(node_binary) = read_env("ANYDOCS_NODE_BINARY") {
        return PathBuf::from(node_binary);
    }

    let node_file_name = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };
    let platform_key = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);
    let bundled_node = bundled_resources_dir().map(|resources_dir| {
        resources_dir
            .join("node-runtime")
            .join(platform_key)
            .join(node_file_name)
    });

    if let Some(node) = bundled_node {
        if node.exists() {
            return node;
        }
    }

    PathBuf::from("node")
}

fn resolve_bundled_cli_entry() -> Option<PathBuf> {
    bundled_resources_dir()
        .map(|resources_dir| resources_dir.join("cli").join("dist").join("index.js"))
        .filter(|entry| entry.exists())
}

fn spawn_managed_server() -> Result<Option<Child>, String> {
    if !managed_server_enabled() {
        return Ok(None);
    }

    let server_entry = resolve_desktop_server_entry();
    if !server_entry.exists() {
        return Err(format!(
            "Managed desktop server entry not found at {}",
            server_entry.display()
        ));
    }

    let host = read_env("ANYDOCS_DESKTOP_SERVER_HOST").unwrap_or_else(|| "127.0.0.1".to_string());
    let port = read_env("ANYDOCS_DESKTOP_SERVER_PORT").unwrap_or_else(|| "33440".to_string());
    let node_executable = resolve_node_executable();
    let bundled_cli_entry = resolve_bundled_cli_entry();
    let cli_mode = read_env("ANYDOCS_DESKTOP_CLI_MODE").unwrap_or_else(|| {
        if bundled_cli_entry.is_some() {
            "bundled".to_string()
        } else {
            "system".to_string()
        }
    });
    let bundled_cli_present = bundled_cli_entry
        .as_ref()
        .map(|entry| entry.exists())
        .unwrap_or(false);

    eprintln!(
        "Starting Anydocs managed desktop server: node={}, cli_mode={}, bundled_cli_entry={}",
        node_executable.display(),
        cli_mode,
        bundled_cli_entry
            .as_ref()
            .map(|entry| entry.display().to_string())
            .unwrap_or_else(|| "none".to_string())
    );

    let mut command = Command::new(&node_executable);
    command
        .arg(server_entry)
        .env("ANYDOCS_NODE_BINARY", &node_executable)
        .env("ANYDOCS_DESKTOP_CLI_MODE", &cli_mode)
        .env("ANYDOCS_DESKTOP_SERVER_HOST", host)
        .env("ANYDOCS_DESKTOP_SERVER_PORT", port)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    if cli_mode != "system" {
        if let Some(cli_entry) = bundled_cli_entry {
            command.env("ANYDOCS_DESKTOP_CLI_ENTRY", cli_entry);
        } else if cli_mode == "bundled" || !bundled_cli_present {
            eprintln!(
                "Anydocs bundled CLI entry is not present; preview/build will require a configured CLI entry or system CLI fallback."
            );
        }
    }

    command
        .spawn()
        .map(Some)
        .map_err(|error| {
            format!(
                "Failed to spawn managed desktop server with Node at {}: {error}. The lite package requires Node.js to be installed and available on PATH.",
                node_executable.display()
            )
        })
}

fn create_runtime_state() -> Result<Arc<DesktopRuntimeState>, String> {
    let managed_server = managed_server_enabled();
    let child = spawn_managed_server()?;
    let context = DesktopContext {
        runtime: "tauri",
        server_base_url: default_server_base_url(),
        managed_server,
    };

    Ok(Arc::new(DesktopRuntimeState {
        child: Mutex::new(child),
        context,
    }))
}

#[tauri::command]
fn get_bridge_state() -> BridgeState {
    BridgeState {
        app_name: "Anydocs",
        platform: std::env::consts::OS,
        runtime: "tauri",
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
fn get_desktop_context(state: State<'_, Arc<DesktopRuntimeState>>) -> DesktopContext {
    state.context.clone()
}

#[tauri::command]
fn pick_project_directory() -> Option<String> {
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
fn open_path(path: String) -> Result<bool, String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let runtime_state = create_runtime_state().expect("failed to initialize desktop runtime state");

    tauri::Builder::default()
        .manage(runtime_state.clone())
        .setup(|app| {
            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;

            if let Some(window) = app.get_webview_window("main") {
                window.on_menu_event(|window, event| {
                    let Some(webview_window) =
                        window.app_handle().get_webview_window(window.label())
                    else {
                        return;
                    };

                    match event.id().as_ref() {
                        MENU_ACTION_OPEN_PROJECT => {
                            emit_menu_action(&webview_window, MENU_ACTION_OPEN_PROJECT)
                        }
                        MENU_ACTION_NEW_PAGE => {
                            emit_menu_action(&webview_window, MENU_ACTION_NEW_PAGE)
                        }
                        MENU_ACTION_SAVE => emit_menu_action(&webview_window, MENU_ACTION_SAVE),
                        _ => {}
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bridge_state,
            get_desktop_context,
            pick_project_directory,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Anydocs desktop shell");

    let child_to_kill = {
        runtime_state
            .child
            .lock()
            .expect("desktop runtime state poisoned")
            .take()
    };

    if let Some(mut child) = child_to_kill {
        let _ = child.kill();
        let _ = child.wait();
    }
}
