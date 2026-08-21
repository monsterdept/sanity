//! Sanity — DaisyDisk for code comprehension.
//!
//! The pipeline, in the order it runs:
//!
//! ```text
//!   scan.rs      walk the repo (honoring .gitignore), group files by directory
//!   parse.rs     tree-sitter → functions, with signatures and doc comments
//!   heuristic.rs the offline surprise proxy + the measured doc-coverage term
//!   surprise.rs  the model-backed scorer, when one is available
//!   churn.rs     git history → the stability axis
//!   model.rs     the tree, LOC-weighted aggregation, temperature and quadrants
//! ```
//!
//! The one invariant worth stating at the top: **size is lines, color is
//! surprise, and they are independent.** Size is the axis everyone copies and the axis
//! that tells you nothing. Color is the product.

pub mod agentapi;
pub mod assessment;
pub mod blame;
pub mod cache;
pub mod churn;
pub mod clones;
pub mod edges;
pub mod cli;
pub mod commands;
pub mod harness;
pub mod heuristic;
pub mod history;
pub mod links;
#[cfg(feature = "local-model")]
pub mod local;
pub mod mcp;
pub mod model;
pub mod parse;
pub mod reports;
pub mod scan;
pub mod screen;
pub mod scancache;
pub mod treecache;
pub mod surprise;
pub mod watch;

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
/// item, so the standard behaviors (Hide, Quit, copy/paste, ⌘W) stay the system's rather
/// than being reimplemented badly.
#[cfg(target_os = "macos")]
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<(tauri::menu::Menu<tauri::Wry>, ThemeMenu)> {
    use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};

    // **The one thing a downloaded app cannot do for itself.** A Homebrew install puts
    // `sanity` on PATH through the cask's `binary` stanza; a DMG leaves a bundle in
    // /Applications with the binary buried in `Contents/MacOS`, which nothing links out of.
    // The first-run card offers this too, but onboarding is seen once and this is needed
    // whenever somebody wants the terminal half — so it lives where an app's one-off setup
    // actions belong, the same place editors put theirs.
    let install_cli =
        MenuItem::with_id(app, "install-cli", "Install Command Line Tool…", true, None::<&str>)?;
    let app_menu = Submenu::with_items(
        app,
        "Sanity",
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(AboutMetadata::default()))?,
            &PredefinedMenuItem::separator(app)?,
            &install_cli,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    // "Add Project…", which is what ⌘O does again.
    //
    // It has been all three things this menu can be. It said "Open Project…" and opened a
    // repo; then opening by hand was removed and it was quietly repointed at the connect
    // sheet while keeping its name, which is a menu doing something other than what it
    // says; then it was renamed "Connect an Agent…" to match where it actually went.
    //
    // Adding a repo by hand is the entrance now — a reader has no working directory and
    // cannot name one — so the item goes back to naming a repo, and this time the label and
    // the destination agree.
    let open_item =
        MenuItem::with_id(app, "open-project", "Add Project…", true, Some("CmdOrCtrl+O"))?;
    let file_menu = Submenu::with_items(app, "File", true, &[&open_item])?;

    // Without an Edit menu the standard clipboard shortcuts stop working in text fields —
    // on macOS ⌘C and ⌘V are menu items, not free behavior, so replacing the stock menu
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
            crate::harness::warm();
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
                            // Emitted rather than run here, so the window reports the
                            // outcome. The link either lands somewhere already on PATH or
                            // it does not, and that distinction is the whole answer — a
                            // menu item that silently succeeds tells nobody which happened.
                            if event.id() == "install-cli" {
                                for w in app.webview_windows().values() {
                                    let _ = w.emit("install-cli", ());
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
            // The window's own emitter, so a launch draws the map assembling exactly as
            // adding a project does — see `scan-shape`.
            let shape_app = _app.handle().clone();
            let tick_app = _app.handle().clone();
            agentapi::restore(
                api_state.clone(),
                move |key: &str, files: &[crate::scan::ShapeFile]| {
                    use tauri::Emitter;
                    let _ = shape_app.emit("scan-shape", crate::scan::ShapeBatch { project: key, files });
                },
                move |key: &str, p: &crate::scan::Progress| {
                    use tauri::Emitter;
                    let _ = tick_app.emit("scan-progress", crate::scan::Tick { project: key, progress: p });
                },
            );
            // Stamped here for the same reason `serve` stamps it: read lazily on the first
            // `/health`, it would describe whatever binary is at this path by then. The
            // window is never retired over it — a CLI on a newer build says so and carries
            // on — but a wrong answer would send that warning to the wrong person.
            let _ = agentapi::build_id();
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
            commands::stop_history,
            commands::history_tables,
            commands::history_log,
            commands::history_scoped,
            commands::repo_remote,
            commands::history_deltas,
            commands::history_funcs,
            commands::sync_theme_menu,
            commands::read_source,
            commands::open_code_window,
            commands::agent_reports,
            commands::projects,
            commands::project_scan,
            commands::file_functions,
            commands::function_links,
            commands::function_sources,
            commands::function_history,
            commands::commit_detail,
            commands::scan_history,
            commands::warm_history,
            commands::agent_activity,
            commands::add_project,
            commands::harnesses,
            commands::read_curve,
            commands::forget_project,
            commands::reorder_projects,
            commands::select_project,
            commands::install_cli,
            commands::cli_status,
            commands::set_reader,
            commands::start_check,
            commands::stop_check,
            commands::save_movie,
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
                // Before the claim is withdrawn, because the readers still need the
                // backend's address to be told to stop being useful. They are children of
                // this process and nothing about quitting a window kills them: left alone
                // they would go on spending tokens on readings with nowhere to land.
                use tauri::Manager;
                if let Some(state) = _app.try_state::<agentapi::Shared>() {
                    agentapi::stop_all_runs(&state);
                }
                agentapi::release_endpoint(std::process::id());
            }
        });
}
