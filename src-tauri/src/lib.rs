//! Sanity — DaisyDisk for code comprehension.
//!
//! The pipeline, in the order it runs:
//!
//! ```text
//!   scan.rs      walk the repo (honouring .gitignore), group files by directory
//!   parse.rs     tree-sitter → functions, with signatures and doc comments
//!   heuristic.rs the offline surprise proxy + the measured doc-coverage term
//!   surprise.rs  the model-backed scorer, when one is available
//!   churn.rs     git history → the stability axis
//!   model.rs     the tree, LOC-weighted aggregation, temperature and quadrants
//! ```
//!
//! The one invariant worth stating at the top: **size is lines, colour is
//! surprise, and they are independent.** Size is the axis everyone copies and the axis
//! that tells you nothing. Colour is the product.

pub mod agentapi;
pub mod assessment;
pub mod cache;
pub mod churn;
pub mod commands;
pub mod heuristic;
#[cfg(feature = "local-model")]
pub mod local;
pub mod mcp;
pub mod model;
pub mod parse;
pub mod reports;
pub mod scan;
pub mod surprise;

/// Where the macOS traffic lights sit inside the overlay titlebar.
///
/// ONLY the window builder can set this. `trafficLightPosition` is not a tauri.conf.json
/// key — it isn't in Tauri's schema, so putting it there is accepted and silently
/// ignored — and there is no runtime setter on Window. That is why the window is built
/// here rather than declared in config. Tally and Sewcrates use this exact inset, so the
/// department's windows line up when they overlap.
#[cfg(target_os = "macos")]
pub(crate) const TRAFFIC_LIGHTS: (f64, f64) = (16.0, 23.0);

/// Build the main window in code, because the traffic-light inset above cannot be
/// expressed in config. Everything else here is what tauri.conf.json used to declare.
fn build_window(app: &tauri::AppHandle) {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Sanity")
        .inner_size(1180.0, 820.0)
        .min_inner_size(720.0, 560.0);

    // The overlay titlebar and the inset are macOS-only APIs — they don't merely behave
    // differently elsewhere, they don't exist, so calling them unguarded fails to compile
    // on Linux and Windows. Other platforms keep their standard decorations.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(TRAFFIC_LIGHTS.0, TRAFFIC_LIGHTS.1));

    if let Err(e) = builder.build() {
        eprintln!("sanity: main window failed to build: {e}");
    }
}

/// The app menu, which exists so Settings has a door.
///
/// It had none. Nothing in the frontend ever set `showSettings`, so the panel — and with
/// it every control in it, including the whole model configuration — could not be opened
/// by any means. A capability with no surface is a capability nobody has; this is the
/// surface.
///
/// The menu is otherwise the platform default, rebuilt rather than extended because Tauri
/// gives no way to insert one item into the stock menu. Everything here except Settings is
/// a predefined item, so the standard behaviours (Hide, Quit, copy/paste, ⌘W) stay the
/// system's rather than being reimplemented badly.
#[cfg(target_os = "macos")]
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};

    let settings = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
    let app_menu = Submenu::with_items(
        app,
        "Sanity",
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(AboutMetadata::default()))?,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    // Without an Edit menu the standard clipboard shortcuts stop working in text fields —
    // on macOS ⌘C and ⌘V are menu items, not free behaviour, so replacing the stock menu
    // silently breaks typing anywhere until they are put back.
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &edit_menu, &window_menu])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared with the loopback agent API so an MCP client can see the scan that is
    // currently on screen — the whole point is that the human and the agent are looking
    // at the same thing.
    let state: agentapi::Shared = Default::default();
    let api_state = state.clone();

    tauri::Builder::default()
        .manage(state)
        .setup(move |_app| {
            build_window(_app.handle());
            #[cfg(target_os = "macos")]
            {
                use tauri::{Emitter, Manager};
                match build_menu(_app.handle()) {
                    // Sent to the frontend rather than handled here: what "open settings"
                    // means is a piece of window state React owns, and Rust reaching in to
                    // set it would need a second copy of that state to reach into.
                    Ok(menu) => {
                        let _ = _app.set_menu(menu);
                        _app.on_menu_event(|app, event| {
                            if event.id() == "settings" {
                                for w in app.webview_windows().values() {
                                    let _ = w.emit("open-settings", ());
                                }
                            }
                        });
                    }
                    // A menu that fails to build must not take the app with it — losing
                    // ⌘, is a smaller problem than losing the window.
                    Err(e) => eprintln!("sanity: menu unavailable: {e}"),
                }
            }
            // Bring back whatever was open before. The window follows the active
            // project as soon as it reappears, so a restart lands you where you were.
            agentapi::restore(api_state.clone());
            tauri::async_runtime::spawn(async move {
                if let Err(e) = agentapi::serve(api_state).await {
                    eprintln!("agent API not available: {e}");
                }
            });
            Ok(())
        })
        // Opening a second copy should focus the window you already have, not start a
        // second scan of the same repo.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(w) = app.webview_windows().values().next() {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_repo,
            commands::ollama_available,
            commands::ollama_models,
            commands::stop_scan,
            commands::stored_data,
            commands::clear_stored_data,
            commands::explain_function,
            commands::read_source,
            commands::open_code_window,
            commands::agent_reports,
            commands::projects,
            commands::project_scan,
            commands::agent_activity,
            commands::mcp_command,
            commands::mcp_clients,
            commands::mcp_connect,
            commands::mcp_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running sanity");
}
