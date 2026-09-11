fn main() {
    // **The icons are read at compile time and nothing else watches them.** `generate_context!`
    // embeds `icon.icns` as the Dock icon under `just dev`, and tauri-build's own
    // `rerun-if-changed` lines switch off Cargo's default of rebuilding on any file in the
    // package — so `just icons-mac` wrote a new icon and a dev build went on showing the old one
    // until some unrelated Rust file moved. Measured: touching only `icon.icns` rebuilt nothing.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
