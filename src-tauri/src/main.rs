// Release builds on Windows must not open a console behind the window. Only the window's: a
// headless build is a console program, and marked as a GUI one it would print nothing at all.
#![cfg_attr(all(not(debug_assertions), feature = "gui"), windows_subsystem = "windows")]

fn main() {
    // `sanity mcp` runs the stdio MCP server instead of opening a window. Same binary,
    // so the command an agent is told to launch is one that definitely exists wherever
    // the app was installed.
    if std::env::args().nth(1).as_deref() == Some("mcp") {
        sanity_lib::mcp::run();
        return;
    }
    use std::io::IsTerminal;
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    match sanity_lib::cli::launch_target(&args, &cwd, std::io::stdin().is_terminal()) {
        Err(why) => {
            eprintln!("sanity: {why}");
            std::process::exit(1);
        }
        // `sanity .`, or `sanity` alone at a terminal in a repo: the window, on that repo.
        Ok(Some(repo)) => window(Some(repo), args.is_empty()),
        // No arguments: the window, which is what double-clicking the app does.
        Ok(None) if args.is_empty() => window(None, true),
        // Everything else with an argument is the CLI — `serve`, `check` and the read verbs.
        // Same binary as the window, and the headless build is this same file without it: one
        // implementation of the contract and one version writing `.sanity/`. See
        // `docs/notes/conventions.md` on where each build is installed.
        Ok(None) => std::process::exit(sanity_lib::cli::main(&args)),
    }
}

/// Open the window, on `repo` if there is one.
#[cfg(feature = "gui")]
fn window(repo: Option<std::path::PathBuf>, _bare: bool) {
    match repo {
        Some(repo) => {
            sanity_lib::cli::name_for_window(&repo);
            sanity_lib::run_opening(Some(repo));
        }
        None => sanity_lib::run(),
    }
}

/// A headless build has no window to open. Bare `sanity` prints the help, whose last line says
/// so; `sanity .` says it cannot open the repo. Both exit the way a missing verb does.
#[cfg(not(feature = "gui"))]
fn window(repo: Option<std::path::PathBuf>, bare: bool) {
    match repo {
        Some(repo) if !bare => eprintln!(
            "sanity: this build has no window, so it cannot open {}. Every verb works; see `sanity --help`.",
            repo.display()
        ),
        _ => {
            sanity_lib::cli::main(&["--help".to_string()]);
        }
    }
    std::process::exit(2);
}
