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
