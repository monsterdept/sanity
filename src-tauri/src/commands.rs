//! The `invoke` surface. Frontend ↔ Rust is Tauri commands — no server, no sidecar.

use crate::cache::Cache;
use crate::scan::{self, Progress, Scan, Scored};
use crate::surprise::HeuristicModel;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Set by `stop_scan`, cleared at the start of every scan.
///
/// A global rather than per-scan state because there is only ever one scan in flight —
/// the UI disables the button that would start a second — and a global keeps the stop
/// command from having to be handed a handle it would only ever use once.
static CANCEL: std::sync::LazyLock<Arc<AtomicBool>> =
    std::sync::LazyLock::new(|| Arc::new(AtomicBool::new(false)));
use tauri::{AppHandle, Emitter};

/// What to scan. Just a path now.
///
/// It used to carry an Ollama endpoint, model and length floor, chosen in Settings and
/// sent on every scan. All of it is gone: the model path was configuration rather than
/// revelation, and the readings an agent files through MCP are the measurement the app
/// is actually built around. The offline proxy draws the map until a reader improves it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRequest {
    pub path: String,
}

/// Scan a repo and return the whole scored tree.
///
/// The tree is returned in one payload rather than streamed. A large repo is a few MB of
/// JSON, which the webview parses in well under a frame — and the sunburst cannot draw a
/// single ring until it knows the totals anyway, because every wedge's angle depends on
/// its siblings' lines. Streaming would buy nothing and cost the ability to render.
#[tauri::command]
pub async fn scan_repo(
    app: AppHandle,
    state: tauri::State<'_, crate::agentapi::Shared>,
    req: ScanRequest,
) -> Result<Scan, String> {
    let root = PathBuf::from(&req.path);
    let root_for_state = root.clone();
    if !root.is_dir() {
        return Err(format!("{} is not a directory", req.path));
    }

    CANCEL.store(false, Ordering::Relaxed);

    // The scan is CPU-bound and rayon-parallel, so it must never run on the async
    // runtime's threads.
    let scanned = tauri::async_runtime::spawn_blocking(move || {
        let model = HeuristicModel;

        let emit = |p: Progress| {
            let _ = app.emit("scan-progress", p);
        };
        // Per-function scores go out as they land so the sunburst colours in live. The
        // full tree still returns at the end — the stream is an accelerant, not the
        // source of truth, so a dropped event costs a few seconds of grey rather than a
        // permanently wrong wedge.
        let scored = |id: &str, reading: &crate::surprise::Reading| {
            let _ = app.emit(
                "scan-score",
                Scored {
                    id: id.to_string(),
                    surprise: reading.surprise,
                    hotspots: reading.hotspots.clone(),
                },
            );
        };
        // Ephemeral, always. The persistent cache existed for the model path, where a
        // scan ran for tens of minutes; the proxy recomputes the whole repo in about a
        // second, and a cache that saves nothing is a file that can only disagree with
        // the code.
        let cache = Cache::ephemeral();
        scan::scan(&root, &model, &emit, &scored, &CANCEL, &cache).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    // Publish as a project so an MCP client can pull a work queue from the very scan the
    // user is looking at. The window's own Open button and an agent's sanity_open land in
    // the same place — there is one list of projects, however it got filled.
    if let (Ok(mut shared), Ok(scan)) = (state.lock(), scanned.as_ref()) {
        let key = crate::agentapi::project_key(&root_for_state);
        let name = root_for_state
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| key.clone());
        // Same source as the agent path: `.sanity` in the repo. This used to read the
        // machine-local store, so opening a repo from the window and opening it from an
        // agent disagreed about what had been read — the two doors into one project have
        // to land on the same assessment.
        let reports = shared
            .projects
            .get(&key)
            .map(|p| p.reports.clone())
            .unwrap_or_else(|| crate::assessment::load(&root_for_state, scan));
        shared.projects.insert(
            key.clone(),
            crate::agentapi::Project {
                repo: root_for_state,
                name,
                scan: scan.clone(),
                reports,
                leased: std::collections::HashMap::new(),
                touched: 0,
                last_agent: None,
            },
        );
        shared.touch(&key);
    }
    scanned
}


/// The text of one file in the open repo, for the code view.
///
/// Joined onto the repo root and then checked to still be inside it, because `rel_path`
/// arrives from the webview: `../../.ssh/id_rsa` is a valid relative path and this
/// command would otherwise read it. Canonicalising both sides is what makes the check
/// hold against symlinks and `..` alike.
///
/// Capped, because the view renders a span per line and a vendored bundle would freeze
/// the window rather than show anything useful.
#[tauri::command]
pub async fn read_source(repo: String, rel_path: String) -> Result<String, String> {
    const MAX_BYTES: u64 = 2 * 1024 * 1024;
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(&repo)
            .canonicalize()
            .map_err(|e| format!("repo unreadable: {e}"))?;
        let full = root
            .join(&rel_path)
            .canonicalize()
            .map_err(|e| format!("no such file: {e}"))?;
        if !full.starts_with(&root) {
            return Err("outside the open repo".into());
        }
        let meta = std::fs::metadata(&full).map_err(|e| e.to_string())?;
        if meta.len() > MAX_BYTES {
            return Err(format!("{} is too large to display", rel_path));
        }
        std::fs::read_to_string(&full).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Open one file's code view in a window of its own.
///
/// The modal is for a glance; this is for reading beside something else, or on a second
/// screen. The window loads the same bundle with `?code=` set, and the app renders only
/// the code view when it sees it — one entry point, two shapes, rather than a second
/// build.
///
/// Labels are derived from the path and sanitised: Tauri labels must be unique and
/// allow only a restricted character set, and a path contains neither guarantee.
#[tauri::command]
pub fn open_code_window(app: tauri::AppHandle, repo: String, rel_path: String) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let label: String = format!("code-{rel_path}")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect();

    // Already open: focus it rather than stacking a second copy of the same file.
    if let Some(w) = tauri::Manager::get_webview_window(&app, &label) {
        let _ = w.set_focus();
        return Ok(());
    }

    // Encoded by hand rather than pulling in a crate for two strings. Only the
    // characters that would break a query string are escaped — a path can legally
    // contain any of them, and `#` in particular would silently truncate the URL.
    let esc = |v: &str| {
        v.bytes()
            .map(|b| match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                    (b as char).to_string()
                }
                _ => format!("%{b:02X}"),
            })
            .collect::<String>()
    };
    let url = format!("index.html?code={}&repo={}", esc(&rel_path), esc(&repo));
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&rel_path)
        .inner_size(900.0, 800.0)
        .min_inner_size(420.0, 320.0);

    // Same overlay titlebar AND the same traffic-light inset as the main window. Without
    // the inset these windows got the macOS default, which sits at a different offset
    // from every other window in the department — the whole reason that constant exists.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(
            crate::TRAFFIC_LIGHTS.0,
            crate::TRAFFIC_LIGHTS.1,
        ));

    builder.build().map(|_| ()).map_err(|e| e.to_string())
}

/// Everything agents have reported for the open repo.
///
/// Polled rather than pushed: an agent reports every several seconds at best, so a poll
/// costs nothing and avoids threading an AppHandle into the loopback server purely to
/// emit events.
/// Readings for one project — the one the WINDOW is showing, which is not always the one
/// an agent last opened.
///
/// This used to answer for `active` only. The moment a second project existed that was
/// wrong: an agent opening a repo makes it active, so the window — still showing the
/// first — began receiving the second's readings, whose ids match nothing in the tree on
/// screen. Switching back through the sidebar loads a fresh proxy-scored tree from here,
/// and the readings that would have recoloured it were never sent. A repo with a thousand
/// assessed functions rendered entirely grey while the sidebar counted them.
#[tauri::command]
pub fn agent_reports(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: Option<String>,
) -> Vec<crate::agentapi::Report> {
    state
        .lock()
        .ok()
        .and_then(|s| {
            let key = key.or_else(|| s.active.clone())?;
            Some(s.projects.get(&key)?.reports.values().cloned().collect())
        })
        .unwrap_or_default()
}

/// Whether an agent is working right now.
///
/// "Recently" is sixty seconds: an agent predicting a function, opening a file and
/// writing a report goes quiet for tens of seconds at a time, and a shorter window would
/// have the indicator flickering between working and asleep during one continuous batch.
#[derive(serde::Serialize)]
pub struct AgentCall {
    /// Which ping this was. The window replays only the ones above the last it saw, so a
    /// burst inside one poll interval animates as a burst rather than as its last frame.
    seq: u64,
    tool: String,
}

#[derive(serde::Serialize)]
pub struct AgentActivity {
    active: bool,
    tool: String,
    nonce: u64,
    events: Vec<AgentCall>,
}

#[tauri::command]
pub fn agent_activity(
    state: tauri::State<'_, crate::agentapi::Shared>,
) -> AgentActivity {
    const IDLE_AFTER: std::time::Duration = std::time::Duration::from_secs(60);
    state
        .lock()
        .map(|s| AgentActivity {
            active: s.last_agent.is_some_and(|t| t.elapsed() < IDLE_AFTER),
            tool: s.last_tool.clone(),
            nonce: s.pings,
            events: s
                .recent
                .iter()
                .map(|(seq, tool)| AgentCall { seq: *seq, tool: tool.clone() })
                .collect(),
        })
        .unwrap_or(AgentActivity {
            active: false,
            tool: String::new(),
            nonce: 0,
            events: Vec::new(),
        })
}

/// What the window should be showing, and everything else on offer.
///
/// Polled by the frontend so an agent calling `sanity_open` switches the window with no
/// click anywhere. That is the whole point of the inversion: the session that knows which
/// repo you are in should be the thing that decides what is on screen.
#[tauri::command]
pub fn projects(
    state: tauri::State<'_, crate::agentapi::Shared>,
) -> crate::agentapi::ProjectList {
    state
        .lock()
        .map(|s| crate::agentapi::ProjectList::from_state(&s))
        .unwrap_or_default()
}

/// The full scored tree for one project, fetched when the window switches to it.
#[tauri::command]
pub fn project_scan(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
) -> Option<Scan> {
    state.lock().ok()?.projects.get(&key).map(|p| p.scan.clone())
}

/// What Sanity has written on this machine, itemised for the panel that offers to
/// delete it.
///
/// Itemised on purpose. A single "clear 400 KB" is not something anyone can agree to,
/// because the interesting question is not the size — it is whether the thing about to
/// be deleted can be got back. Scores can (slowly). Legacy readings cannot.
/// Tick the appearance item the webview is actually using.
///
/// The preference is stored in localStorage, so Rust cannot know it when the menu is
/// built — without this the menu opens with System ticked whatever you last chose. The
/// frontend calls it on mount and on every change; nothing is stored on this side, so the
/// two cannot disagree about which is current.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn sync_theme_menu(app: tauri::AppHandle, theme: String) {
    use tauri::Manager;
    if let Some(themes) = app.try_state::<crate::ThemeMenu>() {
        themes.select(&theme);
    }
}

/// Nothing to sync where there is no app menu.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn sync_theme_menu(_app: tauri::AppHandle, _theme: String) {}

/// Stop the model pass. Everything scored so far is kept and returned.
///
/// With the length floor gone nothing is excluded from analysis, so this is how a scan
/// is bounded: the queue is ordered by how promising each function looks, and the user
/// stops when the picture has told them enough.
#[tauri::command]
pub fn stop_scan() {
    CANCEL.store(true, Ordering::Relaxed);
}

// ── Connecting an agent ────────────────────────────────────────────────────────
//
// Lifted from tally, which learned the shape the hard way: detection and configuration
// are ONE list. They were two — a table telling you what was connected, and a separate
// button that connected one particular client — which made you read a status in one place
// and act on it in another, and left every other client with a status and no action.
// A row that can say "not connected" should be the row that connects it.

/// The exact stdio command an MCP client must launch to talk to this install.
#[derive(serde::Serialize)]
pub struct McpCommand {
    command: String,
    args: Vec<String>,
    /// Ready to paste into any `mcpServers` map.
    json: String,
}

fn this_exe() -> String {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[tauri::command]
pub fn mcp_command() -> Result<McpCommand, String> {
    let command = this_exe();
    let args = vec!["mcp".to_string()];
    let json = serde_json::to_string_pretty(&serde_json::json!({
        "mcpServers": { "sanity": { "command": command, "args": args } }
    }))
    .map_err(|e| e.to_string())?;
    Ok(McpCommand { command, args, json })
}

struct ClientDef {
    id: &'static str,
    name: &'static str,
    path: PathBuf,
    /// Where servers live in that file.
    key: &'static str,
    /// JSON we can safely rewrite; TOML (Codex) we only read.
    json: bool,
}

fn client_defs() -> Vec<ClientDef> {
    let home = dirs::home_dir().unwrap_or_default();
    vec![
        ClientDef {
            id: "claude-desktop",
            name: "Claude Desktop",
            path: dirs::config_dir()
                .unwrap_or_default()
                .join("Claude/claude_desktop_config.json"),
            key: "mcpServers",
            json: true,
        },
        ClientDef {
            id: "claude-code",
            name: "Claude Code",
            path: home.join(".claude.json"),
            key: "mcpServers",
            json: true,
        },
        ClientDef {
            id: "cursor",
            name: "Cursor",
            path: home.join(".cursor/mcp.json"),
            key: "mcpServers",
            json: true,
        },
        ClientDef {
            id: "windsurf",
            name: "Windsurf",
            path: home.join(".codeium/windsurf/mcp_config.json"),
            key: "mcpServers",
            json: true,
        },
        ClientDef {
            id: "codex",
            name: "Codex",
            path: home.join(".codex/config.toml"),
            key: "mcp_servers",
            json: false,
        },
    ]
}

/// What one MCP client's config says about sanity.
#[derive(serde::Serialize)]
pub struct McpClient {
    id: &'static str,
    name: &'static str,
    path: String,
    /// The client keeps a config here — a decent proxy for "it is installed".
    present: bool,
    registered: bool,
    /// That entry launches THIS binary. False means it points somewhere else — usually a
    /// copy that has since moved, which reads as configured and is dead.
    current: bool,
    /// We can edit this file. False for TOML, which we read but never rewrite.
    writable: bool,
}

#[tauri::command]
pub fn mcp_clients() -> Vec<McpClient> {
    let exe = this_exe();
    client_defs()
        .into_iter()
        .map(|d| {
            let raw = std::fs::read_to_string(&d.path).ok();
            let present = raw.is_some();
            let (registered, current) = match raw.as_deref() {
                None => (false, false),
                Some(text) => match serde_json::from_str::<serde_json::Value>(text) {
                    Ok(v) => {
                        let entry = v.get(d.key).and_then(|m| m.get("sanity"));
                        let cmd = entry
                            .and_then(|e| e.get("command"))
                            .and_then(|c| c.as_str())
                            .unwrap_or_default();
                        (entry.is_some(), !exe.is_empty() && cmd == exe)
                    }
                    // Not JSON (Codex is TOML): match on the binary path, which still
                    // distinguishes current from stale.
                    Err(_) => (
                        text.contains("sanity"),
                        !exe.is_empty() && text.contains(&exe),
                    ),
                },
            };
            McpClient {
                id: d.id,
                name: d.name,
                path: d.path.to_string_lossy().to_string(),
                present,
                registered,
                current,
                writable: d.json,
            }
        })
        .collect()
}

/// Add or remove sanity's entry in one client's config, leaving everything else alone.
///
/// Only ever edits a file that already EXISTS and already PARSES. That is the line
/// between helpful and destructive: creating a config for a client that isn't installed
/// means inventing a schema, and rewriting one we couldn't parse means discarding
/// somebody's settings. Both refuse loudly instead.
fn edit_client(id: &str, connect: bool) -> Result<String, String> {
    let def = client_defs()
        .into_iter()
        .find(|d| d.id == id)
        .ok_or_else(|| format!("unknown client '{id}'"))?;
    if !def.json {
        return Err(format!(
            "{} keeps its config in TOML; copy the server entry in manually",
            def.name
        ));
    }

    let mut cfg: serde_json::Value = if def.path.exists() {
        let text = std::fs::read_to_string(&def.path).map_err(|e| e.to_string())?;
        if text.trim().is_empty() {
            serde_json::json!({})
        } else {
            serde_json::from_str(&text).map_err(|e| {
                format!(
                    "{}'s config isn't valid JSON, so sanity won't rewrite it ({e})",
                    def.name
                )
            })?
        }
    } else if connect && def.id == "claude-desktop" {
        // The one client we create a config for: Claude Desktop ships without one until
        // its first server is added, and this is the button that adds it.
        serde_json::json!({})
    } else if connect {
        return Err(format!("no config found at {}", def.path.display()));
    } else {
        return Ok(def.path.to_string_lossy().to_string());
    };

    if !cfg.get(def.key).map(|v| v.is_object()).unwrap_or(false) {
        cfg[def.key] = serde_json::json!({});
    }
    if connect {
        cfg[def.key]["sanity"] =
            serde_json::json!({ "command": this_exe(), "args": ["mcp"] });
    } else if let Some(map) = cfg[def.key].as_object_mut() {
        map.remove("sanity");
    }

    if let Some(parent) = def.path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(
        &def.path,
        serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(def.path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn mcp_connect(id: String) -> Result<String, String> {
    edit_client(&id, true)
}

#[tauri::command]
pub fn mcp_disconnect(id: String) -> Result<String, String> {
    edit_client(&id, false)
}
