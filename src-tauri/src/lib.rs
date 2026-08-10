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
pub mod blame;
pub mod cache;
pub mod churn;
pub mod cli;
pub mod commands;
pub mod heuristic;
pub mod history;
#[cfg(feature = "local-model")]
pub mod local;
pub mod mcp;
pub mod model;
pub mod parse;
pub mod reports;
pub mod scan;
pub mod scancache;
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
        // The default opens larger than the minimum, but not by much: the sunburst is a
        // circle in a rectangle, so height is the binding constraint and a window that
        // starts at its own floor has no room to show anything is adjustable.
        .inner_size(1440.0, 900.0)
        // The rings need radius before they need anything else — squeezed below this the
        // inner ring collapses to unreadable slivers and the detail panel starts wrapping
        // every label. Better to refuse the size than to render a picture that cannot be
        // read and let the user conclude the tool is illegible.
        .min_inner_size(1280.0, 720.0);

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

/// The three appearance items, kept so their checkmarks can be moved.
///
/// Managed as app state because a radio group has to be updated as a group: picking Dark
/// means clearing Light and System, and the handler needs all three to do it.
#[cfg(target_os = "macos")]
pub struct ThemeMenu {
    pub light: tauri::menu::CheckMenuItem<tauri::Wry>,
    pub dark: tauri::menu::CheckMenuItem<tauri::Wry>,
    pub system: tauri::menu::CheckMenuItem<tauri::Wry>,
}

#[cfg(target_os = "macos")]
impl ThemeMenu {
    /// Show `which` as the active one. Called from the menu handler and from the frontend
    /// on startup — the preference lives in the webview's localStorage, so Rust cannot
    /// know it at build time and the menu would otherwise open with nothing ticked.
    pub fn select(&self, which: &str) {
        let _ = self.light.set_checked(which == "light");
        let _ = self.dark.set_checked(which == "dark");
        let _ = self.system.set_checked(which == "system");
    }
}

/// The app menu.
///
/// It exists because appearance needs a home and a settings panel does not. There was
/// one — reachable only after this menu was built, since nothing had ever set
/// `showSettings` — and it emptied out: the model configuration went with Ollama, and the
/// delete-all-readings button went when readings moved into the repo, where `rm -rf
/// .sanity` does the same job against a diff you can read. What was left was one
/// three-way toggle behind a modal behind a keystroke.
///
/// The menu is otherwise the platform default, rebuilt rather than extended because Tauri
/// gives no way to insert items into the stock menu. Everything else here is a predefined
/// item, so the standard behaviours (Hide, Quit, copy/paste, ⌘W) stay the system's rather
/// than being reimplemented badly.
#[cfg(target_os = "macos")]
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<(tauri::menu::Menu<tauri::Wry>, ThemeMenu)> {
    use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};

    let app_menu = Submenu::with_items(
        app,
        "Sanity",
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(AboutMetadata::default()))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    // "Connect an Agent…", not "Open Project…".
    //
    // Opening by hand is gone: a project arrives when an agent calls `sanity_open`. The item
    // was left saying "Open Project…" and quietly repointed at the connect sheet, which is
    // worse than either removing it or renaming it — it promises a repo and delivers a
    // dialog, and a menu that does something other than what it says is the same failure as
    // a doc comment describing a function it no longer belongs to.
    //
    // Kept on ⌘O rather than deleted, because the shortcut is muscle memory and connecting
    // is now the one thing that leads to a project. The name is what had to change.
    let open_item =
        MenuItem::with_id(app, "open-project", "Connect an Agent…", true, Some("CmdOrCtrl+O"))?;
    let file_menu = Submenu::with_items(app, "File", true, &[&open_item])?;

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
    // Appearance lives here rather than in a panel: it is one setting, it is a radio
    // group, and macOS has had a place for exactly that shape since before this app.
    let light = CheckMenuItem::with_id(app, "theme-light", "Light", true, false, None::<&str>)?;
    let dark = CheckMenuItem::with_id(app, "theme-dark", "Dark", true, false, None::<&str>)?;
    let system = CheckMenuItem::with_id(app, "theme-system", "System", true, true, None::<&str>)?;
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &Submenu::with_items(app, "Appearance", true, &[&light, &dark, &system])?,
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
    let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])?;
    Ok((menu, ThemeMenu { light, dark, system }))
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
                    Ok((menu, themes)) => {
                        let _ = _app.set_menu(menu);
                        _app.manage(themes);
                        _app.on_menu_event(|app, event| {
                            if event.id() == "open-project" {
                                for w in app.webview_windows().values() {
                                    let _ = w.emit("open-project", ());
                                }
                                return;
                            }
                            let Some(which) = event.id().0.strip_prefix("theme-") else {
                                return;
                            };
                            if let Some(themes) = app.try_state::<ThemeMenu>() {
                                themes.select(which);
                            }
                            // The webview owns the preference and its persistence; Rust
                            // owns the checkmarks. Neither keeps a copy of the other's
                            // state, which is what stops the two drifting.
                            for w in app.webview_windows().values() {
                                let _ = w.emit("set-theme", which);
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
            commands::stop_scan,
            commands::sync_theme_menu,
            commands::read_source,
            commands::open_code_window,
            commands::agent_reports,
            commands::projects,
            commands::project_scan,
            commands::scan_history,
            commands::warm_history,
            commands::agent_activity,
            commands::mcp_command,
            commands::mcp_clients,
            commands::mcp_connect,
            commands::mcp_disconnect,
        ])
        .build(tauri::generate_context!())
        .expect("error while running sanity")
        .run(|_app, event| {
            // The backend is a thread in THIS process, so quitting the window takes the
            // server with it — but the endpoint file naming it survived, and every later
            // caller was sent to a dead port. `mcp.rs` then read the surviving file as
            // "something is there, this is transient" and told readers to retry into a
            // hole. Withdrawing the claim is what makes the app's exit legible to the
            // shim: nothing answering AND no file is a state `sanity_open` knows how to
            // fix by starting a backend.
            if let tauri::RunEvent::Exit = event {
                agentapi::release_endpoint(std::process::id());
            }
        });
}
