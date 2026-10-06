# Context OS

**Your work is not apps and files. It is contexts.**

Context OS is a local-first Tauri 2 desktop workspace manager. Create a context around a real project folder, choose whether to track file metadata, work in a session, and suspend it to leave a checkpoint. Return to the context to reopen its folder and continue with your notes and history.

This repository implements the **V0.1 foundation**. It is a real Rust/SQLite application, with a React/TypeScript interface and native folder selection. Advanced integrations are explicitly marked as future scope. **macOS acceptance is still outstanding; this is not a production release.**

## Implemented

- Native Tauri desktop shell with a dark/light/system appearance, collapsible sidebar, dashboard, and keyboard commands.
- Context creation wizard with native directory selection and explicit opt-in file tracking; edit, archive, restore, and delete.
- Versioned, atomic SQLite migration; UUID identities, foreign keys, WAL, indexes, and FTS5 memory search.
- One open work session at a time, pause/continue, suspension, and persisted session timing.
- Session-scoped `notify` watchers: creation, modification, rename/move, deletion, metadata-only storage, exclusions, and two-second event coalescing.
- Timeline with context/type/date filters and expandable groups; file filters by event, extension, and session.
- Markdown notes with local autosave, pinning, privacy-preserving preview, and search.
- Deterministic checkpoints with observed files, duration, activity summary, and a next action from a pinned/recent note. They do not invent completed tasks.
- Resume starts a new session and invokes the platform folder opener using separate process arguments. A folder-open failure is visible and does not discard the session.
- Settings, local storage counts, privacy explanation, and optional development seed data.

## Requirements

The initial product target is **Apple Silicon, macOS Sonoma 14 or newer**. Intel macOS should be evaluated separately.

- Xcode Command Line Tools (`xcode-select --install`).
- Rust **1.99.0**, pinned in `rust-toolchain.toml`; rustup installs the formatter and Clippy components.
- Node.js **22.12+** (Node 24 was used here), npm, and the local Git binary for development.
- No account, API keys, server, or Ollama installation is required.

On a normal Debian/Ubuntu development machine, Tauri also needs its native Linux libraries. Follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/); typical packages are `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`, `build-essential`, and `pkg-config`. Linux is useful for backend/compilation validation; it does not establish macOS acceptance.

## Develop on macOS

From the repository root:

```bash
npm ci
npm run tauri dev
```

The Tauri CLI starts Vite and the Rust application. Create a context with a **dedicated project folder**, enable file metadata tracking explicitly, and enter the context. Changes appear in its timeline after a short refresh interval. Pausing stops tracking; suspending completes the session and writes a checkpoint atomically.

`npm run dev` alone serves only the frontend. It **does not** provide a fake database or emulate desktop commands: the UI explains that the native engine is unavailable. Use `npm run tauri dev` for the working application.

### Build

```bash
npm run tauri build
```

On macOS this produces `.app` and `.dmg` bundles under `src-tauri/target/release/bundle`. Distribution signing, notarization, updates, and a release installer acceptance run are future work. Do not distribute the development build as a verified production release.

To compile the native app without packaging:

```bash
npm run build
cargo build --locked --manifest-path src-tauri/Cargo.toml
```

### Tests and code quality

```bash
npm test
npm run build
npm run format:check
cargo test --locked --manifest-path src-tauri/Cargo.toml --no-default-features
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --no-default-features --all-targets -- -D warnings
cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
```

The no-default-features Rust suite exercises the actual SQLite database and filesystem watcher without a GUI/WebKit dependency. Frontend tests use mocks at the native IPC/folder-picker boundary and test user interactions; they are not native end-to-end tests. See [validation and acceptance](docs/VALIDATION.md) for exact coverage and remaining checks.

### Prepared cloud workspace

This cloud machine is Debian 13, not macOS. Its system directories are read-only and it has no root installer. The toolchain and signed Debian native-library packages were prepared **outside the checkout** in `/workspace/.context-toolchain` and `/workspace/.context-linux`.

In this existing prepared workspace:

```bash
cd /workspace/context-os
source scripts/cloud-env.sh
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --no-default-features
cargo build --locked --manifest-path src-tauri/Cargo.toml
```

The helper activates retained tools and the Linux pkg-config/library sysroot. It does not install anything or change source files. These paths are cloud-specific, and are not prerequisites on a Mac. GUI execution needs a display and was not validated here. The local development server was tested separately.

## First end-to-end acceptance

Use [the macOS acceptance checklist](docs/VALIDATION.md#macos-acceptance-still-required). The first build is accepted only after the native folder picker, real file events, notes, checkpoints, quit/reopen persistence, folder restoration, another session, and historical search all pass on macOS.

## Data and privacy

The database is `context-os.sqlite3` in Tauri’s application data directory:

- macOS: `~/Library/Application Support/dev.contextos.desktop/`
- Linux: the corresponding `$XDG_DATA_HOME/dev.contextos.desktop/` directory (normally `~/.local/share/`).
- Windows: the application’s local app-data directory, as resolved by Tauri.

All persisted timestamps and durations use **Unix milliseconds**. UUIDs identify contexts, sessions, events, notes, and checkpoints. The application-data directory/database use restrictive permissions on Unix. Storage is local but **not encrypted at the application level**; use device encryption and your OS account protections.

File tracking is off by default, runs only in an active session, and is limited to the selected folder. Symlinks are not followed outside the scope. Default exclusions are `.git`, `node_modules`, `target`, `dist`, `build`, `.cache`, and `.DS_Store`; users can configure exclusion names. The app’s own storage directory is always excluded to prevent self-generated event loops. File contents are never read for checkpoints, and access/open events are not captured.

No keystrokes, clipboard, screenshots, microphone, passwords, command contents, browser pages, or window titles are captured. Notes are intentionally stored as text; Markdown preview does not load remote images or navigate external links. The app has no telemetry or cloud service. Production CSP permits local IPC and bundled assets, not arbitrary network connections.

Deleting a context removes its metadata/history/notes/checkpoints, not the project folder or files. SQLite deletion is not secure erasure of old disk pages or backups. See [architecture and privacy boundaries](docs/ARCHITECTURE.md).

## Session recovery

A normal app exit pauses an active session. After an unexpected termination, startup recovers an active session as **paused**. A session-scoped backend heartbeat records the last known active time every 30 seconds, independently of UI visibility; approximately one heartbeat interval of unconfirmed activity can be lost under normal scheduling. Offline time is excluded. Tracking never starts automatically on launch, even when the last selected context view reopens.

Only one open session is allowed. Suspend it before entering a different context or changing its folder/tracking preferences. Suspend saves the completed session, checkpoint, and events in one transaction. If watcher startup fails, the session is paused and a visible error explains the failure.

## Architecture

```text
src/
  app/          shell and theme styling
  components/   native context wizard, session controls, timeline, notes, palettes
  pages/        home, contexts, context detail, memory, search, settings
  hooks/        theme, shortcuts, refresh, optional view restoration
  services/     typed Tauri IPC and native dialog adapter
  stores/       Zustand state, mutations, connection/action errors
  types/        strict shared frontend contracts
  test/         user-interaction tests
src-tauri/
  migrations/   versioned SQLite schema
  src/
    commands/   context CRUD, session lifecycle, notes, settings, state
    db/         connections, row models, event and FTS indexing
    tracking/   scoped watchers, coalescing, session heartbeat
    checkpoints/ deterministic summaries
    privacy/    path/permission/exclusion validation
    restore/    platform-specific safe folder opening
    search/     parameterized FTS5 queries
    models/     serialized command/data contracts
    desktop.rs Tauri command registration and app lifecycle
  examples/seed.rs explicit development-only seed
```

### Optional development sample data

Nothing seeds production on first launch. To create the four sample contexts in a new empty directory:

```bash
cargo run --locked --manifest-path src-tauri/Cargo.toml --no-default-features \
  --example seed -- /tmp/context-os-sample
```

The example refuses to overwrite a nonempty directory and creates project folders with tracking disabled. It writes a separate development database; it does not automatically import that database into the desktop app.

## Keyboard

| Action | Shortcut |
| --- | --- |
| Command palette | ⌘ K |
| Create context | ⌘ N |
| Toggle sidebar | ⌘ B |
| Search memory | ⌘ ⇧ F |
| Quick capture | ⌘ ⇧ Space |

Ctrl replaces ⌘ on Linux/Windows. These are app-focused shortcuts, not global OS hooks. Modals support Escape, focus trapping, and keyboard navigation. Reduced Motion disables decorative animations.

## Permissions and troubleshooting

- **Folder unavailable:** suspend any open session, edit the context, and choose its new location. Nothing silently substitutes another folder.
- **No file events:** ensure the session is active and file tracking was enabled; check the context’s exclusions. The UI refreshes every five seconds while visible. File-open/access events are intentionally ignored.
- **Watcher error:** the UI reports it. Pause and continue to retry; check permissions and watcher limits.
- **macOS folder access denied:** grant access to that selected folder in System Settings if needed, or choose another folder. Accessibility permission is not required or requested by V0.1.
- **Another context has an open session:** suspend it first. Paused sessions also remain open.
- **Interrupted session after restart:** continue the recovered paused session, or suspend it to create a checkpoint.
- **No Ollama:** expected; V0.1 does not connect to AI. All core behavior works without it.
- **Frontend shows desktop engine required:** run the Tauri command, not the browser-only Vite server.
- **Newer database version:** use the application version that created it; the app refuses to downgrade or overwrite its schema.

For diagnostics, `RUST_LOG=context_os=debug npm run tauri dev` changes Rust console log verbosity. Tracking error logs avoid note contents, paths, and event payloads. There is no telemetry or automatic diagnostics upload.

## Roadmap

- **V0.2:** optional foreground applications, local Git activity, launch rules, snapshots, explainable momentum, and menu bar integration.
- **V0.3:** optional local Ollama at `http://localhost:11434`, structured summaries with timeout/validation and deterministic fallback. No connection or model download is implemented in V0.1.
- **V0.4:** optional Accessibility/window metadata, shell integration, and explicitly paired browser extension. See [integration boundaries](docs/INTEGRATIONS.md).
- **V1.0:** native acceptance and performance benchmarking, onboarding polish, export/import, diagnostics, signing/notarization, installers, and updates.

Idle CPU/memory targets have not been measured on macOS. No advanced integration should be presented as implemented until the foundation passes native acceptance.

## Screenshots

_Screenshot placeholder: capture the Home and context detail views from a validated macOS run._
