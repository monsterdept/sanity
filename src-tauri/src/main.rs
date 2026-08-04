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
    sanity_lib::run()
}
