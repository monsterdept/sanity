# NSOpenPanel in list view returns the parent directory when a folder is double-clicked

## Summary

In a directories-only `NSOpenPanel`, double-clicking a folder while the panel is in **list view** returns the *enclosing* directory instead of the folder that was double-clicked.

The panel appears to treat the double-click as "toggle disclosure" rather than "choose this item": the row expands in place, the selection is cleared, and the confirm path then runs with no selection. In a panel where `canChooseDirectories = YES` and `canChooseFiles = NO`, no selection resolves to the directory currently being browsed — so `URL`, `URLs` and `directoryURL` all come back as the parent.

The same gesture returns the double-clicked folder correctly in **icon view** and in **column view**. Only list view is affected — the one view with disclosure triangles, and the only one where a folder row has something else for a double-click to do.

## Steps to reproduce

1. Build and run the attached `OpenPanelListViewRepro.swift`: `swiftc -o repro OpenPanelListViewRepro.swift && ./repro`. It opens a directories-only panel at `~/` and prints the panel's persisted view mode before and after the modal, along with everything the panel reports.
2. Ensure the panel is in **list view** (the second view-mode button; the output line `after: …ForOpenMode2=2` confirms it).
3. Navigate to a directory containing at least one subfolder.
4. **Double-click** a subfolder.

## Expected

The panel returns the double-clicked folder, or descends into it. Either is defensible; returning a folder the user did not indicate is not.

## Actual

The panel closes and returns the *parent* directory:

```
after:    NSNavPanelFileListModeForOpenMode2=2   (list view)
response: 1
URL:      /Users/me/projects
URLs:     ["/Users/me/projects"]
directory:/Users/me/projects
```

Repeating with the panel in **icon view** returns the correct folder:

```
after:    NSNavPanelFileListModeForOpenMode2=1   (icon view)
response: 1
URL:      /Users/me/projects/wormhole
URLs:     ["/Users/me/projects/wormhole"]
directory:/Users/me/projects/wormhole
```

Same binary, same gesture, one variable.

## What the panel looks like at the moment of failure

Immediately after the double-click, before the panel closes:

- the double-clicked row's disclosure triangle is **expanded**
- the row is **no longer selected**
- the **Open button is disabled**

That last one is the tell: the panel has no selection to confirm, so the confirm path falls back to the browse directory.

## Notes

- Only list view (mode 2) fails. Icon (1) and column (3) both return the double-clicked folder, which is consistent with the disclosure toggle being what consumes the click.
- Reproduced with a bare `NSOpenPanel` — no delegate, no accessory view, no app bundle, no third-party libraries.
- `allowsMultipleSelection = YES` makes no difference; `URLs` is still `[parent]`.
- With a delegate implementing `panel:validateURL:error:`, the failure changes shape rather than going away: the panel descends into the *previously selected* folder, which suggests a stale selection surviving the toggle in that path.
- Impact: an application cannot trust the result of its own folder picker. The user points at one folder and the app is handed another, with nothing to distinguish that from a deliberate choice of the parent.

## Configuration

The panel is configured the ordinary way for choosing a folder:

```swift
panel.canChooseDirectories = true
panel.canChooseFiles = false
panel.allowsMultipleSelection = false
```
