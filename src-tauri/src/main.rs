// Release builds on Windows must not open a console behind the window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `sanity mcp` runs the stdio MCP server instead of opening a window. Same binary,
    // so the command an agent is told to launch is one that definitely exists wherever
    // the app was installed.
    if std::env::args().nth(1).as_deref() == Some("mcp") {
        sanity_lib::mcp::run();
        return;
    }
    // Everything else with an argument is the headless half — `serve`, `check` and the
    // read verbs. Same binary again, and for the same reason: one artifact means one
    // implementation of the contract and one version writing `.sanity/`. A second
    // installable that could drift from this one is the `mcp/sanity.mjs` mistake with a
    // longer fuse.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if !args.is_empty() {
        std::process::exit(sanity_lib::cli::main(&args));
    }
    // No arguments: the window, which is what double-clicking the app does.
    sanity_lib::run()
}
