//! How Sanity spawns a reader, per coding agent.
//!
//! **Sanity used to print a sentence and let a human drive.** `study` said "ask your agent
//! to study this project" precisely so the tool would not own model choice, auth,
//! concurrency or resumption — the configuration that got `OllamaModel` deleted. That
//! bargain was correct while a reader had to be a subagent of somebody's session: owning
//! the spawn would have meant owning an inference endpoint.
//!
//! It changed when the reader became a plain MCP client. A reader now needs no filesystem,
//! no repo, no cwd and no knowledge of anything but three tools, so spawning one is
//! shelling out to a CLI the user has already installed and already authenticated. What
//! Sanity owns is the isolation, and that is the whole reason to own the spawn:
//!
//! - **Cold context.** One process per reader, which every harness can do. Only Claude
//!   Code and Roo can fan out subagents in a turn, so asking the agent to do it confined
//!   Sanity to one client and silently produced warm readings on the others.
//! - **No repo access.** The reader is given the sanity tools and, where the harness can
//!   express it, nothing else. "Do not read `.sanity/`" stops being a rule readers have
//!   improvised around three times and becomes a capability they do not have.
//! - **No brief.** `--setting-sources` on Claude and a working directory outside the repo
//!   on both keep the repo's own `CLAUDE.md`/`AGENTS.md` out of the reader's context.
//!   That is the priming hazard, fixed at the only point where it can be fixed — the
//!   launch — rather than warned about afterwards.
//!
//! **A harness that cannot express those is absent rather than half-present.** The same
//! rule extensions follow: a language that would have functions invented in every repo
//! ships nowhere, and a harness that leaks the repo into its readers would produce warm
//! readings that look exactly like cold ones.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

/// One model a harness offers, as the harness describes it.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ModelChoice {
    /// What goes on the command line.
    pub id: String,
    /// What the harness calls it. Equal to `id` where there is nothing better.
    pub label: String,
    /// The model to start on when nothing else has decided.
    ///
    /// **It used to be shown and never selected**, on the grounds that which model reads IS
    /// the measurement and a pre-ticked box is Sanity choosing the scale quietly. What that
    /// actually produced was a dialog you could not press: no model, no run, and a first-time
    /// user asked to pick from a list of ids with nothing to tell them apart. The scale is
    /// still a choice — it is two clicks away, it is remembered per project, and the corpus
    /// overrides it the moment a repo has one — but declining to have an opinion is not the
    /// same as staying out of the way.
    ///
    /// At most one per harness. Where the agent reports its own it is that; where it does
    /// not, it is ours and the source says so.
    pub default: bool,
}

/// A coding agent Sanity knows how to run headlessly as a reader.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Harness {
    Claude,
    Codex,
    OpenCode,
    Agy,
}

impl Harness {
    /// **`gemini` is deliberately absent rather than aliased to `agy`.** The Gemini CLI
    /// prints a deprecation notice of its own and points at Antigravity, so the two are not
    /// the same instrument wearing two names — and silently redirecting a project configured
    /// for one harness to a different one would change what its readings mean without saying
    /// so. A project whose stored `harness` is `gemini` fails to parse, which reads as "no
    /// agent configured" and asks the human to pick again. That is the honest shape.
    pub fn parse(s: &str) -> Option<Harness> {
        match s.trim().to_ascii_lowercase().as_str() {
            "claude" | "claude-code" => Some(Harness::Claude),
            "codex" => Some(Harness::Codex),
            "opencode" => Some(Harness::OpenCode),
            "agy" | "antigravity" => Some(Harness::Agy),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Harness::Claude => "claude",
            Harness::Codex => "codex",
            Harness::OpenCode => "opencode",
            Harness::Agy => "agy",
        }
    }

    /// What a person calls it.
    pub fn label(self) -> &'static str {
        match self {
            Harness::Claude => "Claude Code",
            Harness::Codex => "Codex",
            Harness::OpenCode => "opencode",
            Harness::Agy => "Antigravity",
        }
    }

    /// The executable this harness is driven by, as it would be found on `PATH`.
    pub fn program(self) -> &'static str {
        self.name()
    }

    /// Whether this agent can be found and run on this machine.
    ///
    /// Checked before a wave rather than discovered from a hundred failed spawns. The
    /// error a missing binary produces is the same `NotFound` whatever went wrong, so a
    /// run that started anyway would report a hundred identical failures and no cause.
    pub fn available(self) -> bool {
        let Some(path) = self.resolve() else {
            return false;
        };
        // Resolved AND runnable. `resolve` only proves a file exists with an execute bit,
        // which a broken install, a stub on PATH or a half-deleted package all satisfy —
        // and the Read dialog turns this into "ready to read with claude", which is a
        // promise about something that has never been run. Cheap because `resolve` caches
        // and this runs once per dialog.
        std::process::Command::new(path)
            .arg("--version")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    pub fn all() -> [Harness; 4] {
        [Harness::Claude, Harness::Codex, Harness::OpenCode, Harness::Agy]
    }

    /// Whether [`models`] is the agent's own catalog, or a list of ours.
    ///
    /// **Three of the four enumerate properly and one does not.** Codex answers `model/list`
    /// over JSON-RPC, opencode and Antigravity each have a `models` subcommand — all real,
    /// versioned ids that move when the agent updates. Claude Code has no such thing, so
    /// what it offers is four ALIASES written down here, and an alias names a family rather
    /// than a model: `sonnet` has meant three different ones.
    ///
    /// The window uses this to decide whether to offer a text field beside the list. Where
    /// the catalog is real the list is the whole truth and a free-text box invites people
    /// to type ids that will be rejected at spawn time, minutes later. Where it is aliases,
    /// typing a full version is the only way to pin the scale, and pinning it is the thing
    /// the `model` column exists to make possible.
    pub fn enumerates(self) -> bool {
        !matches!(self, Harness::Claude)
    }

    /// Model names to offer, asked of the installed agent rather than hardcoded.
    ///
    /// **A list in our source is stale the week a new model ships, and both of ours were.**
    /// The shipped set said `sonnet/opus/haiku` while `claude --help` on this machine
    /// already named `fable`; it said `gpt-5.1-codex` while Codex actually offers
    /// `gpt-5.6-terra`. Neither was a typo — they were both true when written.
    ///
    /// The two harnesses answer very differently, and the difference is worth knowing:
    ///
    /// - **Codex enumerates properly.** Its app server speaks JSON-RPC and has a
    ///   `model/list` method returning real ids with display names and a default. That is
    ///   the good case: versioned, authoritative, and it moves when Codex updates.
    /// - **Claude does not.** There is no `models` subcommand, its invalid-model error
    ///   names none, and its local caches hold nothing usable — `modelAccessCache` in
    ///   `~/.claude.json` is empty and `additionalModelOptionsCache` held a single entry.
    ///   So we take the ALIASES its `--help` names, which is dynamic per install and
    ///   honest about being aliases.
    ///
    /// **`ant models list` was tried and removed, and the reason is not the API key.**
    /// `GET /v1/models` is the only supported enumeration of versioned Claude ids, so it
    /// looked like the answer — but `ant` authenticates against an Anthropic CONSOLE
    /// account and prompts you to pick a workspace, which is a different login from the
    /// Claude Code subscription that is actually doing the reading. Sending somebody to
    /// create an org account to populate a dropdown is not a feature. It also lists what
    /// the API offers rather than what `claude --model` accepts, and aliases are absent
    /// from it entirely. Do not reach for it again; the text field is the answer.
    ///
    /// **An alias is not a version, and that gap is a measurement problem.** `sonnet`
    /// resolved to two different models across one repo's corpus — 708 `claude-sonnet-5`
    /// against 66 `claude-sonnet-4.5` — which is precisely the two-scale mixture the
    /// `model` field exists to expose. Pinning a full id is the user's lever, which is why
    /// whatever this returns is a suggestion beside a field that takes anything.
    pub fn models(self) -> Vec<ModelChoice> {
        static CACHE: std::sync::OnceLock<
            std::sync::Mutex<HashMap<&'static str, Vec<ModelChoice>>>,
        > = std::sync::OnceLock::new();
        let cache = CACHE.get_or_init(Default::default);
        if let Some(hit) = cache.lock().ok().and_then(|c| c.get(self.name()).cloned()) {
            return hit;
        }
        let found = match self {
            Harness::Codex => self.codex_models(),
            Harness::Claude => self.claude_aliases(),
            Harness::OpenCode => self.opencode_models(),
            Harness::Agy => self.agy_models(),
        };
        if let Ok(mut c) = cache.lock() {
            c.insert(self.name(), found.clone());
        }
        found
    }

    /// Ask Codex's app server for its catalog.
    ///
    /// Two lines of JSON-RPC on stdin — `initialize`, then `model/list` — and the first
    /// reply carrying our id is the answer. Read on a thread with a deadline because a
    /// server that never answers must cost a dialog a second, not hang it; anything that
    /// goes wrong yields an empty list, which the picker renders as "type one in".
    fn codex_models(self) -> Vec<ModelChoice> {
        let Some(path) = self.resolve() else {
            return Vec::new();
        };
        let Ok(mut child) = std::process::Command::new(path)
            .arg("app-server")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        else {
            return Vec::new();
        };
        // **Held open until the answer arrives, not dropped after writing.** Closing stdin
        // makes the app server shut down, and it does so before it replies: measured, with
        // stdin closed it never answers at all and with it held it returns the catalog
        // every time. Dropping it at the end of a `if let` block is exactly what the tidy
        // version of this code did, and the symptom was an empty model list in the window
        // while the same two lines of JSON-RPC worked by hand.
        let mut keep_open = child.stdin.take();
        if let Some(stdin) = keep_open.as_mut() {
            use std::io::Write;
            let hello = serde_json::json!({
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": { "clientInfo": { "name": "sanity", "title": "sanity", "version": env!("CARGO_PKG_VERSION") } }
            });
            let ask = serde_json::json!({
                "jsonrpc": "2.0", "id": 2, "method": "model/list", "params": {}
            });
            let _ = writeln!(stdin, "{hello}");
            let _ = writeln!(stdin, "{ask}");
            let _ = stdin.flush();
        }
        let stdout = child.stdout.take();
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let Some(out) = stdout else { return };
            for line in std::io::BufRead::lines(std::io::BufReader::new(out)).map_while(Result::ok)
            {
                let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else {
                    continue;
                };
                // Notifications arrive interleaved and carry no id; ours is 2.
                if v.get("id").and_then(|i| i.as_u64()) == Some(2) {
                    let _ = tx.send(v);
                    return;
                }
            }
        });
        let answer = rx.recv_timeout(Duration::from_secs(10)).ok();
        // Only now: see `keep_open`.
        drop(keep_open);
        let _ = child.kill();
        let _ = child.wait();
        let Some(v) = answer else {
            return Vec::new();
        };
        v["result"]["data"]
            .as_array()
            .map(|list| {
                list.iter()
                    // `hidden` is the catalog saying "not in the default picker", and
                    // this is a picker.
                    .filter(|m| !m["hidden"].as_bool().unwrap_or(false))
                    .filter_map(|m| {
                        let id = m["id"].as_str()?.to_string();
                        let label = m["displayName"].as_str().unwrap_or(&id).to_string();
                        Some(ModelChoice {
                            default: m["isDefault"].as_bool().unwrap_or(false),
                            id,
                            label,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Everything `opencode models` prints, as `provider/model`.
    ///
    /// A proper enumeration, and a big one — 341 on this machine, across every provider it
    /// knows whether or not you have credentials for them. Too many for chips, which is
    /// why the picker is a text field with completion rather than a row of buttons.
    fn opencode_models(self) -> Vec<ModelChoice> {
        let Some(path) = self.resolve() else {
            return Vec::new();
        };
        let Ok(out) = std::process::Command::new(path)
            .arg("models")
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
        else {
            return Vec::new();
        };
        // Narrowed to providers there are credentials for. The bare list is every model of
        // every provider opencode has ever heard of — 341 here — and all but one provider's
        // worth of that is unusable: picking one fails at spawn time with an auth error
        // minutes later. `auth.json` is opencode's own credential store, and its keys are
        // exact provider ids, so this is filtering by what the install can actually reach.
        //
        // An empty or unreadable store means show everything rather than nothing: a wrong
        // long list is a nuisance, an empty one looks like a broken picker.
        let mine = opencode_providers();
        String::from_utf8_lossy(&out.stdout)
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && l.contains('/'))
            .filter(|l| mine.is_empty() || mine.iter().any(|p| l.starts_with(&format!("{p}/"))))
            .map(|l| ModelChoice { id: l.to_string(), label: l.to_string(), default: false })
            .collect()
    }

    /// What `agy models` prints: `id<TAB>display name`, one per line.
    ///
    /// The good case, like Codex and unlike Claude — real versioned ids from the harness
    /// itself, and a short enough list to render as chips. It is a mixed catalog (Gemini,
    /// Claude and GPT-OSS ids all appear), which matters here more than usual: the reader IS
    /// the scale, so picking a Claude model inside Antigravity is not the same measurement as
    /// picking a Gemini one, and both are on the same menu.
    ///
    /// Lines without a tab are skipped — it prints a "Fetching available models..." banner
    /// first, and a banner rendered as a model is a chip that fails at spawn time.
    fn agy_models(self) -> Vec<ModelChoice> {
        let Some(path) = self.resolve() else {
            return Vec::new();
        };
        let Ok(out) = std::process::Command::new(path)
            .arg("models")
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
        else {
            return Vec::new();
        };
        String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(|l| l.split_once('\t'))
            .filter(|(id, _)| !id.trim().is_empty())
            .map(|(id, label)| ModelChoice {
                id: id.trim().to_string(),
                label: label.trim().to_string(),
                default: false,
            })
            .collect()
    }

    /// The four aliases Claude Code takes for `--model`.
    ///
    /// **Written down, and that is a different bargain from Codex's list.** Codex is
    /// enumerated live because its ids are VERSIONS — `gpt-5.6-terra` — and a version list
    /// in our source is stale within weeks; ours already was. These are aliases, which
    /// name a family and always point at its latest member, so they age like a `latest`
    /// tag rather than like a pin. `sonnet` has meant three different models and is still
    /// spelled `sonnet`.
    ///
    /// **Parsing them out of `--help` was tried and is worse than this.** The help says
    /// "an alias for the latest model (e.g. 'fable', 'opus', or 'sonnet')" — *e.g.* — so it
    /// is an illustration, not the set, and `haiku` is missing from it. Scraping the
    /// interactive `/model` picker with a PTY would reach the real list and is the least
    /// stable contract in the product: ANSI escapes, a scrollable list, display names
    /// rather than ids, and nothing at all on Windows.
    ///
    /// So: four names that change about once a year, beside a field that takes any id.
    /// **The thing this list must never become is versions.** If a version ever gets added
    /// here, delete it — that is the mistake the Codex branch exists to avoid.
    fn claude_aliases(self) -> Vec<ModelChoice> {
        ["haiku", "sonnet", "opus", "fable"]
            .into_iter()
            .map(|id| ModelChoice {
                id: id.to_string(),
                label: id.to_string(),
                // **Sonnet, and this one is ours rather than reported.** Claude Code names
                // no default anywhere a program can read — see the `--help` scraping note
                // above — so the alternative to choosing is a dialog that opens with no
                // model and cannot be pressed. It is the middle of the range on both cost
                // and capability, which is what a default should be when the thing being
                // defaulted is a scale.
                default: id == "sonnet",
            })
            .collect()
    }

    /// The absolute path to this agent's binary, or `None` if it is not installed.
    ///
    /// **A GUI app does not inherit your shell's PATH, and that is the whole reason this
    /// is not just `Command::new("claude")`.** An app launched from Finder gets roughly
    /// `/usr/bin:/bin:/usr/sbin:/sbin` — and coding agents install nowhere near there:
    /// `~/.local/bin`, `/opt/homebrew/bin`, a node prefix. So the same machine that runs
    /// `sanity check` happily from a terminal would open the app, press Read, and be told
    /// no agent is installed. That failure is invisible in development, where everything
    /// is launched from a shell, and universal in distribution.
    ///
    /// Resolving to an absolute path rather than fixing up PATH is deliberate: the readers
    /// are then spawned by a path that does not depend on how Sanity itself was started,
    /// so a run means the same thing from the window, the CLI and a chat client.
    ///
    /// **This function is the memo, and [`Harness::look`] is the search** — the three sources
    /// and the order they are tried in are documented there. Kept apart because the answer is
    /// asked for far more often than it can change: every row of the Read dialog asks, and so
    /// does every wave.
    pub fn resolve(self) -> Option<PathBuf> {
        // Cached: this is called for every row of the Read dialog and again before every
        // wave, and asking a login shell costs a process each time.
        static CACHE: std::sync::OnceLock<
            std::sync::Mutex<HashMap<&'static str, Option<PathBuf>>>,
        > = std::sync::OnceLock::new();
        let cache = CACHE.get_or_init(Default::default);
        if let Some(hit) = cache.lock().ok().and_then(|c| c.get(self.name()).cloned()) {
            return hit;
        }
        let found = self.look();
        if let Ok(mut c) = cache.lock() {
            c.insert(self.name(), found.clone());
        }
        found
    }

    /// Where this agent's binary is, asked for real — the uncached half of [`Harness::resolve`].
    ///
    /// Three sources, cheapest first. The inherited PATH is right whenever Sanity was
    /// started from a shell. Failing that, the user's LOGIN SHELL is asked, which is the
    /// only thing that actually knows where their tools are — it reads the same profile
    /// that put them there. The fixed list is last, for a shell that fails or is exotic.
    fn look(self) -> Option<PathBuf> {
        let prog = self.program();
        if let Some(p) = which(prog) {
            return Some(p);
        }
        if let Some(p) = via_login_shell(prog) {
            return Some(p);
        }
        // Last resort, and deliberately short. A long list of guesses is a way of being
        // wrong in more places; these are where the two supported agents actually install.
        let home = dirs::home_dir();
        let candidates = [
            home.as_ref().map(|h| h.join(".local/bin")),
            Some(PathBuf::from("/opt/homebrew/bin")),
            Some(PathBuf::from("/usr/local/bin")),
            home.as_ref().map(|h| h.join(".bun/bin")),
            home.as_ref().map(|h| h.join(".volta/bin")),
        ];
        candidates.into_iter().flatten().map(|d| d.join(prog)).find(|p| is_runnable(p))
    }
}

/// Whether a path is a file we could execute.
fn is_runnable(p: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(p)
            .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        p.is_file()
    }
}

/// Look a program up on the PATH this process inherited.
pub fn which(prog: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path).map(|d| d.join(prog)).find(|p| is_runnable(p))
}

/// Ask the user's login shell where a program is.
///
/// `-l` is the point: it reads the profile that put the tool on PATH in the first place,
/// which is knowledge that exists nowhere else on the machine. `command -v` rather than
/// `which`, because it is a shell builtin and cannot itself be missing.
#[cfg(unix)]
pub fn via_login_shell(prog: &str) -> Option<PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
    let out = std::process::Command::new(shell)
        .arg("-lc")
        .arg(format!("command -v {prog}"))
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let p = PathBuf::from(line);
    is_runnable(&p).then_some(p)
}

#[cfg(not(unix))]
pub fn via_login_shell(_prog: &str) -> Option<PathBuf> {
    None
}

/// The MCP server definition a reader is launched with, as JSON.
///
/// Written per invocation and never into the user's own config. A reader's server has an
/// environment its own — the role and the project — and putting that in `~/.claude.json`
/// would make every session the user starts by hand a reader for whichever repo was
/// checked last.
fn mcp_config(exe: &Path, backend: &str, project: &str) -> String {
    serde_json::json!({
        "mcpServers": {
            "sanity": {
                "command": exe.to_string_lossy(),
                "args": ["mcp"],
                "env": {
                    // What the reader is. Decides the tool surface it is offered — see
                    // `mcp::Role`.
                    "SANITY_ROLE": "reader",
                    // Which repo its readings belong to. A reader never calls
                    // `sanity_open`, so without this its shim would fall back to the last
                    // repo anybody opened, and two runs at once would cross.
                    "SANITY_PROJECT": project,
                    // Where the backend is. Also stops the shim starting one of its own.
                    "SANITY_BACKEND": backend,
                },
            }
        }
    })
    .to_string()
}

/// The tools a reader is allowed to call, in Claude's naming.
const CLAUDE_TOOLS: &str = "mcp__sanity__sanity_next \
                            mcp__sanity__sanity_reveal \
                            mcp__sanity__sanity_report";

/// Provider ids opencode holds credentials for.
///
/// Read from its own store rather than parsed out of `opencode providers list`, whose
/// output is a drawn box with color codes and display names — "OpenRouter" — where this
/// needs the id, `openrouter`. A file the tool maintains beats scraping the tool's screen,
/// the same argument that ruled out driving Claude's `/model` picker with a PTY.
fn opencode_providers() -> Vec<String> {
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|h| h.join(".local/share")));
    let Some(path) = base.map(|b| b.join("opencode/auth.json")) else {
        return Vec::new();
    };
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str::<serde_json::Value>(&text)
        .ok()
        .and_then(|v| v.as_object().cloned())
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default()
}

/// Fill the resolver and model caches in the background, at startup.
///
/// **The Read button was slow, and none of the cost was Sanity's own work.** Opening the
/// dialog is the first thing that asks which agents exist, and answering means, per harness:
/// resolving a binary — which on a miss runs the user's LOGIN SHELL, a profile and all —
/// running it once for `--version`, and then asking it to enumerate models, where Codex
/// spins up an app server and waits up to ten seconds for a reply. Four of those in series
/// is seconds of nothing happening after a click, and every one of them is cached after the
/// first call. So the first call is made before anybody clicks.
///
/// One thread, not four: these are dominated by process startup rather than by CPU, they
/// share caches guarded by a mutex, and the goal is to be finished before a human can open
/// a dialog rather than to be finished as fast as possible. Nothing waits on it and nothing
/// reads its result — a warm cache is the entire product, and if the thread is still going
/// when the dialog opens, the dialog simply pays what it used to.
///
/// Deliberately NOT called by the CLI: `sanity check` resolves exactly one harness and needs
/// it immediately, so warming the other three would be three subprocesses for nothing.
pub fn warm() {
    std::thread::spawn(|| {
        for h in Harness::all() {
            if h.available() {
                let _ = h.models();
            }
        }
    });
}

/// Every agent Sanity can run, as a comma-separated list for an error message.
///
/// Derived from [`Harness::all`] rather than written out, because the hardcoded copies of
/// this sentence — "Supported: claude, codex." in two places — went stale the moment a
/// third harness landed, and an error that names two of four teaches somebody the tool
/// cannot do what it can.
pub fn supported() -> String {
    Harness::all().map(|h| h.name()).join(", ")
}

/// A TOML string literal, quoted and escaped.
fn toml_string(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

/// Write whatever a harness needs to find Sanity, into the directory it will run in.
///
/// **Only one of the four takes MCP config as a flag, and this is how the rest are
/// supported anyway.** Claude has `--mcp-config`, so for it this does nothing. The others
/// read config from a directory — opencode from `opencode.json` in its working directory,
/// Antigravity from `.agents/mcp_config.json` in its workspace, Codex from `CODEX_HOME` —
/// and the readers already run in a scratch directory outside the repo, for isolation. So
/// the isolation directory becomes the config directory, and the config is as
/// per-invocation as a flag would be.
///
/// Verified rather than assumed, and in both directions: `opencode mcp list` run in such a
/// directory names the server, and an Antigravity reader in one returns a real task from
/// `sanity_next` while the user's global config stays empty. **A harness that cannot be
/// configured per invocation cannot be a reader here** — one global file is not something
/// two concurrent runs can share, and a crash would leave somebody's own sessions pointed
/// at a backend that is gone.
pub fn write_config(
    harness: Harness,
    dir: &Path,
    exe: &Path,
    backend: &str,
    project: &str,
) -> std::io::Result<()> {
    let env = serde_json::json!({
        "SANITY_ROLE": "reader",
        "SANITY_PROJECT": project,
        "SANITY_BACKEND": backend,
    });
    match harness {
        // Carries it on the command line already.
        Harness::Claude => Ok(()),
        // **A CODEX_HOME of its own, which is the third thing tried and the only one that
        // works.** `--ignore-user-config` silently discards the `-c` overrides along with
        // the user's config, leaving a reader no sanity server at all. Overriding one key
        // of somebody else's server — `mcp_servers.github.enabled=false` — REPLACES that
        // whole table, so its transport vanishes and Codex refuses to load any config:
        // "invalid transport in `mcp_servers.github`". A private home is the only way to
        // say "this server and no others".
        //
        // Nothing of the user's is modified: their real `~/.codex` is untouched and their
        // own sessions still see everything they configured. What changes is only what a
        // READER can see, and handing one somebody's authenticated GitHub tools is not
        // isolation.
        //
        // `auth.json` is SYMLINKED, never copied. Codex reads credentials from its home, so
        // the reader needs one — and writing somebody's token into a temp directory to
        // achieve isolation would be a poor trade.
        Harness::Codex => {
            let home = dir.join(".codex");
            std::fs::create_dir_all(&home)?;
            let real = std::env::var_os("CODEX_HOME")
                .map(PathBuf::from)
                .or_else(|| dirs::home_dir().map(|h| h.join(".codex")));
            if let Some(auth) = real.map(|r| r.join("auth.json")).filter(|p| p.exists()) {
                let link = home.join("auth.json");
                let _ = std::fs::remove_file(&link);
                #[cfg(unix)]
                std::os::unix::fs::symlink(&auth, &link)?;
                #[cfg(not(unix))]
                std::fs::copy(&auth, &link).map(|_| ())?;
            }
            let cfg = format!(
                "[mcp_servers.sanity]\ncommand = {}\nargs = [\"mcp\"]\nenv = {{ SANITY_ROLE = \"reader\", SANITY_PROJECT = {}, SANITY_BACKEND = {} }}\n",
                toml_string(&exe.to_string_lossy()),
                toml_string(project),
                toml_string(backend),
            );
            std::fs::write(home.join("config.toml"), cfg)
        }
        Harness::OpenCode => {
            let cfg = serde_json::json!({
                "$schema": "https://opencode.ai/config.json",
                "mcp": {
                    "sanity": {
                        "type": "local",
                        "command": [exe.to_string_lossy(), "mcp"],
                        "enabled": true,
                        "environment": env,
                    }
                }
            });
            std::fs::write(dir.join("opencode.json"), cfg.to_string())
        }
        // **`.agents/mcp_config.json`, and it is inert without `--add-dir` — see
        // [`reader_command`].** Antigravity's own `mcp_servers.md` lists only two locations,
        // global and plugin, and neither is per-invocation; the workspace scope is documented
        // one file over, in `agy-customizations/SKILL.md`. Writing the global file was tried
        // and rejected on the obvious grounds — two runs would fight over it and a crash
        // would leave the user's own sessions pointed at a dead backend.
        //
        // A private `HOME`, which is how Codex is isolated, does NOT work here and the route
        // is properly closed: symlinking every entry of `~/.gemini`, and then the whole
        // directory as one, still leaves agy unauthenticated, so the credential lives
        // somewhere HOME also moves (the login keychain under `~/Library`). A strings scan
        // of the binary found no config-path override to reach past it.
        Harness::Agy => {
            std::fs::create_dir_all(dir.join(".agents"))?;
            let cfg = serde_json::json!({
                "mcpServers": {
                    "sanity": {
                        "command": exe.to_string_lossy(),
                        "args": ["mcp"],
                        "env": env,
                    }
                }
            });
            std::fs::write(dir.join(".agents/mcp_config.json"), cfg.to_string())
        }
    }
}

/// Build the command that runs one reader.
///
/// `cwd` is always somewhere outside the repo: it is what keeps the repo's own brief out of
/// a reader's context on a harness with no flag for it, what stops one that has file tools
/// from finding the code by accident, and — see [`write_config`] — where three of the four
/// look for their configuration.
pub fn reader_command(
    harness: Harness,
    exe: &Path,
    backend: &str,
    project: &str,
    model: &str,
    prompt: &str,
    cwd: &Path,
) -> tokio::process::Command {
    // The resolved path, not the bare name — see `Harness::resolve`. Falling back to the
    // name keeps this infallible; a spawn that fails is reported by the wave, and by then
    // `check` has already refused on `available()`.
    let program = harness.resolve().unwrap_or_else(|| PathBuf::from(harness.program()));
    let mut c = tokio::process::Command::new(program);
    match harness {
        Harness::Claude => {
            c.arg("-p").arg(prompt);
            // `--strict-mcp-config` is not decoration. Without it the reader also gets
            // every MCP server the user has configured, which is an unknown set of tools
            // pointed at unknown places — and at minimum a second, human-surface `sanity`
            // entry that would let it call `sanity_open`.
            let cfg = mcp_config(exe, backend, project);
            c.arg("--mcp-config").arg(&cfg).arg("--strict-mcp-config");
            c.arg("--allowedTools").arg(CLAUDE_TOOLS);
            // The reader has no business editing anything, and nothing it is allowed to
            // call can. This is so it never stops to ask.
            c.arg("--permission-mode").arg("dontAsk");
            // The priming fix, applied where it works. `user` keeps the person's own
            // settings and drops the project's, so no repo `CLAUDE.md` reaches the reader.
            c.arg("--setting-sources").arg("user");
            if !model.is_empty() {
                c.arg("--model").arg(model);
            }
        }
        Harness::Codex => {
            c.arg("exec").arg("--skip-git-repo-check");
            // **`--dangerously-bypass-approvals-and-sandbox`, and it is not decoration.**
            // Measured: with anything weaker every MCP call returns "user canceled MCP
            // tool call" — `codex exec` reports `approval: never`, and never means DENIED
            // rather than waved through, so a reader loads the tools, calls one, is
            // refused, and exits SUCCESSFULLY having done nothing. A wave looked like
            // three spawned, three finished, zero readings, zero failures.
            //
            // The cost is real: it drops the read-only sandbox too, so a Codex reader is
            // isolated by where it is rather than by what it may touch. Claude's readers
            // get a hard `--allowedTools`; Codex has no equivalent.
            c.arg("--dangerously-bypass-approvals-and-sandbox");
            // Its own home, written by `write_config` — see there for why neither
            // `--ignore-user-config` nor `-c` overrides can do this job.
            c.env("CODEX_HOME", cwd.join(".codex"));
            c.arg("-C").arg(cwd);
            if !model.is_empty() {
                c.arg("-m").arg(model);
            }
            c.arg(prompt);
        }
        Harness::OpenCode => {
            // No per-invocation MCP flag; it reads `opencode.json` from the working
            // directory, which `write_config` has already put there.
            c.arg("run");
            c.arg("--dir").arg(cwd);
            if !model.is_empty() {
                c.arg("-m").arg(model);
            }
            // Non-interactive means nothing can answer a permission prompt.
            c.arg("--dangerously-skip-permissions");
            c.arg(prompt);
        }
        Harness::Agy => {
            // **`--add-dir` is what makes the config in `cwd` exist at all, and being `cwd`
            // is not enough.** Antigravity discovers `.agents/` from the WORKSPACE, and a
            // directory becomes the workspace by being named — with no `--add-dir` it loads
            // no MCP whatsoever, silently, and a reader starts with only its builtin tools.
            //
            // That failure is unusually hard to see, and the way it hid is worth keeping:
            // agy exposes MCP through a generic `call_mcp_tool` dispatcher rather than as
            // named tools, so a probe asking whether it can call `sanity_next` is answered
            // "no" whether the server is loaded or not. Ask it to LIST its tools instead —
            // `call_mcp_tool`, `list_resources` and `read_resource` appear only when a
            // server did load, and that is the signal to test against.
            c.arg("--dangerously-skip-permissions");
            c.arg("--add-dir").arg(cwd);
            if !model.is_empty() {
                c.arg("--model").arg(model);
            }
            c.arg("--print").arg(prompt);
        }
    }
    c.current_dir(cwd);
    // The reader talks over MCP; its own chatter is not a result and nothing reads it.
    c.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    // **A reader must not outlive the thing that started it.** It is a whole coding agent
    // spending somebody's tokens against a backend that is no longer there to receive the
    // readings. This covers the task being dropped; a backend shutting down kills its
    // children explicitly (see `run_wave`).
    c.kill_on_drop(true);
    c
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A stripped PATH — what a Finder-launched app actually gets — still finds an agent.
    ///
    /// This is the bug this whole resolver exists for: a GUI app inherits roughly
    /// `/usr/bin:/bin:/usr/sbin:/sbin`, coding agents install in `~/.local/bin` or
    /// `/opt/homebrew/bin`, and the result is an app telling somebody no agent is
    /// installed on a machine that has two. It never reproduces in development, because
    /// everything there is launched from a shell.
    ///
    /// Skipped when the machine genuinely has no agent, rather than asserting something
    /// untrue about the test runner — CI has neither installed, and a test that demands
    /// one would fail for the wrong reason.
    #[test]
    fn an_agent_is_found_without_a_shell_path() {
        let Some(found) = Harness::all().into_iter().find(|h| h.resolve().is_some()) else {
            return;
        };
        let real = found.resolve().expect("just checked");

        // The GUI's environment, near enough.
        let saved = std::env::var_os("PATH");
        std::env::set_var("PATH", "/usr/bin:/bin:/usr/sbin:/sbin");
        // `look`, not `resolve`: the cache is already warm from the call above, and a
        // cache hit would pass this test without exercising anything.
        let blind = found.look();
        match saved {
            Some(p) => std::env::set_var("PATH", p),
            None => std::env::remove_var("PATH"),
        }

        assert_eq!(
            blind.as_deref(),
            Some(real.as_path()),
            "{} is invisible to an app launched from Finder",
            found.name()
        );
    }

    #[test]
    fn a_harness_name_round_trips() {
        for h in Harness::all() {
            assert_eq!(Harness::parse(h.name()), Some(h));
        }
        assert_eq!(Harness::parse("Claude-Code"), Some(Harness::Claude));
        assert_eq!(Harness::parse("cursor"), None);
    }

    /// Every reader is launched pointed away from the repo it is reading.
    ///
    /// This is the whole of the priming fix on Codex and half of it on Claude. A reader
    /// whose working directory is the repo finds its `CLAUDE.md`/`AGENTS.md` the way any
    /// session does, and reports itself honestly `cold` while being substantially recall.
    #[test]
    fn a_reader_is_never_launched_inside_the_repo() {
        let exe = Path::new("/bin/sanity");
        let away = Path::new("/tmp");
        for h in Harness::all() {
            let c = reader_command(h, exe, "http://127.0.0.1:1", "/repo", "sonnet", "go", away);
            assert_eq!(
                c.as_std().get_current_dir(),
                Some(away),
                "{} launches a reader in the repo",
                h.name()
            );
        }
    }

    /// The project and the role reach the reader's shim, and never the model.
    ///
    /// They are in the MCP server's environment rather than in the prompt because a model
    /// cannot garble, forget or compact away what it never carries — the same argument
    /// that keeps the project key out of the tool schema.
    #[test]
    fn the_shims_environment_carries_the_project_and_the_role() {
        let cfg = mcp_config(Path::new("/bin/sanity"), "http://127.0.0.1:7777", "/repo/tally");
        for needle in [
            "\"SANITY_ROLE\":\"reader\"",
            "\"SANITY_PROJECT\":\"/repo/tally\"",
            "\"SANITY_BACKEND\":\"http://127.0.0.1:7777\"",
        ] {
            assert!(cfg.contains(needle), "{needle} missing from {cfg}");
        }
    }

    /// A Claude reader is offered the reader tools and nothing else.
    ///
    /// `--allowedTools` is the difference between "was asked not to read the repo" and
    /// "cannot". The three names are Claude's own MCP spelling, so a rename in `mcp.rs`
    /// has to be made here too — hence naming them rather than counting them.
    #[test]
    fn a_claude_reader_cannot_reach_the_filesystem() {
        let c = reader_command(
            Harness::Claude,
            Path::new("/bin/sanity"),
            "http://127.0.0.1:1",
            "/repo",
            "",
            "go",
            Path::new("/tmp"),
        );
        let args: Vec<String> =
            c.as_std().get_args().map(|a| a.to_string_lossy().into_owned()).collect();
        assert!(args.contains(&"--strict-mcp-config".to_string()));
        assert!(args.contains(&"--allowedTools".to_string()));
        let tools = args.iter().find(|a| a.contains("sanity_next")).expect("no tool allowlist");
        for t in ["sanity_next", "sanity_reveal", "sanity_report"] {
            assert!(tools.contains(t), "{t} is not allowed, so the loop cannot complete");
        }
        assert!(!tools.contains("Read"), "a reader was handed a filesystem tool");
        // No model flag when none was chosen: the harness default is the user's business,
        // and inventing one here would be Sanity choosing the scale.
        assert!(!args.contains(&"--model".to_string()));
    }

    /// The deprecated Gemini CLI does not quietly become Antigravity.
    ///
    /// They are different instruments, so a project configured for one must not start
    /// reading with the other — that would change the scale of its readings with nothing on
    /// screen saying so, which is the mixture `model` exists to expose.
    #[test]
    fn gemini_is_not_an_alias_for_antigravity() {
        assert_eq!(Harness::parse("agy"), Some(Harness::Agy));
        assert_eq!(Harness::parse("antigravity"), Some(Harness::Agy));
        assert_eq!(Harness::parse("gemini"), None);
        // And every supported name round-trips, so the list in an error message is the list
        // the parser will actually accept.
        for h in Harness::all() {
            assert_eq!(Harness::parse(h.name()), Some(h));
            assert!(supported().contains(h.name()));
        }
    }

    /// An Antigravity reader gets its config where agy looks, and is told where to look.
    ///
    /// **Both halves, because either alone is silent.** The file in the wrong place and the
    /// missing `--add-dir` produce the identical symptom: a reader that starts happily with
    /// no sanity tools at all and reports nothing wrong.
    #[test]
    fn an_antigravity_reader_is_pointed_at_its_own_config() {
        let dir = std::env::temp_dir().join(format!("sanity-agy-cfg-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        write_config(Harness::Agy, &dir, Path::new("/bin/sanity"), "http://127.0.0.1:1", "/repo")
            .expect("write");

        let cfg = dir.join(".agents/mcp_config.json");
        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&cfg).expect("config")).expect("json");
        assert_eq!(v["mcpServers"]["sanity"]["env"]["SANITY_ROLE"], "reader");
        assert_eq!(v["mcpServers"]["sanity"]["env"]["SANITY_PROJECT"], "/repo");

        let c = reader_command(
            Harness::Agy,
            Path::new("/bin/sanity"),
            "http://127.0.0.1:1",
            "/repo",
            "",
            "go",
            &dir,
        );
        let args: Vec<String> =
            c.as_std().get_args().map(|a| a.to_string_lossy().into_owned()).collect();
        let at = args.iter().position(|a| a == "--add-dir").expect("no --add-dir: MCP is inert");
        assert_eq!(args.get(at + 1).map(String::as_str), Some(&*dir.to_string_lossy()));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
