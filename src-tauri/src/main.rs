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
    // Everything else with an argument is the CLI — `serve`, `check` and the read verbs. Same
    // binary as the window, and the headless build is this same file without it: one
    // implementation of the contract and one version writing `.sanity/`. See
    // `docs/notes/conventions.md` on where each build is installed.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if !args.is_empty() {
        std::process::exit(sanity_lib::cli::main(&args));
    }
    // No arguments: the window, which is what double-clicking the app does.
    #[cfg(feature = "gui")]
    sanity_lib::run();
    // A headless build has no window to open, so it prints the help, whose last line says so,
    // and exits the way a missing verb does.
    #[cfg(not(feature = "gui"))]
    {
        sanity_lib::cli::main(&["--help".to_string()]);
        std::process::exit(2);
    }
}
