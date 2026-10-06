# Validation and acceptance

## Evidence from this cloud instance

This host is Linux x86_64 (Debian 13). It cannot run macOS, Finder, the macOS folder picker, or macOS permissions APIs.

- The strict TypeScript frontend and production Vite assets compile.
- The native Linux Tauri desktop binary compiles with the default `desktop` feature and the real GTK/WebKit libraries. `npm run tauri build -- --no-bundle --debug` also succeeds through the Tauri CLI, including its frontend build step.
- **13 backend tests passed**, with zero failed/ignored tests. They use real temporary SQLite databases and real `notify` filesystem watchers. They cover migration versioning, CRUD/archiving/deletion, persistence, notes/search updates, safe FTS expressions, session timing and checkpoints, restart recovery, exclusions, symlink scope, and debouncing.
- Folder restore argument construction is tested using a path containing quotes and shell syntax. This confirms literal argument passing, **not** opening a graphical folder.
- **10 React tests passed**, with zero failed/skipped tests. They cover dashboard navigation, the context wizard with consent off by default, native command contracts for session controls, visible resume failures, search navigation, theme persistence, shortcuts, note autosave/Markdown preview, and persistent action errors. Native IPC and the folder picker are mocked only in those frontend tests.
- A development server startup/HTTP check returned HTTP 200 with the Context OS document and React entrypoint. This validates the Vite service, not desktop functionality.
- Frozen `npm ci --offline` succeeded using the retained cache after the sandbox-blocked esbuild validation was rerun through the approved execution path. Prettier, rustfmt, and Clippy (including desktop targets) pass. The explicit development seed creates four tracking-disabled contexts and refuses to overwrite a nonempty data directory.

A GUI execution request was cancelled during setup. **No real desktop launch, WebView-to-Rust end-to-end test, native folder picker, or graphical folder restore is claimed.** Build success does not satisfy the application’s macOS definition of done.

There is no test evidence for application tracking, Git, AI, browser metadata, terminal hooks, snapshots, momentum, menu bar integration, packaging on macOS, or performance targets. These are future work.

## macOS acceptance still required

Run this on Apple Silicon with macOS Sonoma or newer and the documented development dependencies. Use a disposable project folder with a text file; do not use your entire home folder.

1. From the repository root run `npm ci`, then `npm run tauri dev`. Confirm the window opens without an engine error.
2. Create a named context. Select the **real folder through the native picker**. Confirm file tracking is initially unchecked; opt in explicitly.
3. Enter the context. Confirm Finder opens the selected folder and the persistent session indicator appears.
4. Create, edit, rename/move, and delete files inside the folder. Confirm metadata events reach the timeline/files views. Repeated editor saves should be coalesced.
5. Create files under `node_modules` or another exclusion. Confirm those events do not appear. Confirm a symlink to an outside folder is not monitored.
6. Write a Markdown note, edit it, wait for **Saved**, preview it, and pin it. Navigate away and back; the latest draft must persist. Ensure remote note images do not load.
7. Pause the session. Change a file; confirm no paused activity is recorded and the timer stays fixed. Continue and confirm tracking/timing restart.
8. Suspend. Confirm the session completes, a checkpoint appears, and the timer excludes the pause. The checkpoint should describe observed metadata and use the note as a next-action hint; it must not claim inferred task completion.
9. Quit the app completely. Reopen it. Confirm the context, session, note, events, and checkpoint are still present. No tracking starts on launch.
10. Press **Resume context**. Confirm Finder reopens the correct folder, a new session starts, and the previous checkpoint/next action remain visible.
11. Search for a recorded file name and note phrase. Confirm historical results point to the correct context.
12. Change theme and compact layout. Quit/reopen and confirm preferences persist. Test the command palette and shortcuts; respect Reduce Motion and System theme.
13. While active, quit normally. Reopen: the session should be paused. Continue or suspend it without counting offline time. Repeat with a forced termination and check the documented heartbeat recovery bound.
14. Suspend, archive, restore, and edit the context. Move its folder; confirm the error is visible and editing its location recovers it. Delete the context only after confirming all metadata is removed and project files remain untouched.
15. Run `npm run tauri build` on macOS and repeat the core workflow from the generated `.app`. Signing/notarization and release distribution remain separate work.

Record OS version, architecture, exact commands, results, and any failures. Do not mark the first build complete until steps 1–11 pass natively. Do not mark it production-ready until packaging, recovery, accessibility, performance, and distribution checks are also complete.
