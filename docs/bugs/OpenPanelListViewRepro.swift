import AppKit

// Plain directories-only panel, plus a readout of which VIEW MODE the panel was in — the
// panel persists it to NSGlobalDomain when it closes, so this removes the "did I actually
// switch to column view?" doubt from the result.
//
// Modes, as AppKit writes them: 1 = icon, 2 = list (disclosure triangles), 3 = column.
func mode() -> String {
    let d = UserDefaults.standard.persistentDomain(forName: UserDefaults.globalDomain) ?? [:]
    let keys = [
        "NSNavPanelFileListModeForOpenMode2",
        "NSNavPanelFileLastListModeForOpenModeKey",
        "NavPanelFileListModeForOpenMode",
    ]
    return keys.map { "\($0)=\(d[$0].map { "\($0)" } ?? "unset")" }.joined(separator: "  ")
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let panel = NSOpenPanel()
panel.title = "Choose a folder"
panel.canChooseDirectories = true
panel.canChooseFiles = false
panel.allowsMultipleSelection = false
panel.directoryURL = URL(fileURLWithPath: NSHomeDirectory())
print("before:   \(mode())")
app.activate(ignoringOtherApps: true)
let r = panel.runModal()
// Read after the modal: the panel writes the mode it was last showing.
UserDefaults.standard.synchronize()
print("after:    \(mode())")
print("response: \(r.rawValue)")
print("URL:      \(panel.url?.path ?? "nil")")
print("URLs:     \(panel.urls.map { $0.path })")
print("directory:\(panel.directoryURL?.path ?? "nil")")
