# Architecture and privacy boundaries

## Commands and data

The frontend invokes explicitly registered Tauri commands through `src/services/api.ts`; it never uses a browser-only substitute database. `ContextInput`, serialized Rust models, and strict TypeScript interfaces define the IPC boundary. Native commands report errors as strings, surfaced in the application; status-refresh errors and action errors remain separate.

The `Core` owns an `Arc<Mutex<rusqlite::Connection>>`, a session-scoped watcher, and a session-scoped heartbeat. Desktop commands and watcher callbacks serialize writes through the connection. Lifecycle writes and checkpoint generation use transactions. Startup migration is atomic and versioned through `PRAGMA user_version`. A newer schema is rejected, not rewritten. WAL and a five-second busy timeout support local writes.

The initial schema intentionally includes only working V0.1 features: contexts, sessions, events, notes, checkpoints, settings, and an FTS5 memory index. Future resources and snapshots should use context/session foreign keys and later migrations; unused tables are not presented as implemented integrations.

One partial unique index enforces one open session globally, including paused sessions. Only completed sessions can coexist with another open session. Stop is represented by suspension: a completed session and deterministic checkpoint commit together.

## Activity collection

Watchers exist only for opted-in **active** sessions. Each callback rechecks the persisted session status under the database lock, rejecting late events after pause/suspend. Folder selection is canonicalized and checked for readability. The filesystem root is rejected. Captured paths must remain within the project; symlinks are not followed. File/folder exclusions are component names, not user-supplied shell expressions. The application-data directory is excluded independently of the user’s preferences.

Metadata includes a relative path, extension, size when available, event type, timestamp, and an optional previous rename path. File contents are not read. Access events are ignored. Events are coalesced by type/path within a two-second window. The timeline groups consecutive nearby events of the same type/context, with expandable file paths. The UI loads the most recent 1,000 events; FTS search indexes the full history.

The OS watcher can still register directories that are subsequently excluded from recorded events. Extremely large project trees or low OS watcher limits need native benchmarking; V0.1 does not claim a measured resource budget.

## Checkpoints and search

A checkpoint is a deterministic description of observed activity, not a prediction of task completion. It includes unique affected paths, recorded event counts, session duration, and a next-action hint from the pinned/recent note. Without a note, it recommends reviewing a tracked file or the project notes. User-written completion/blocker notes remain the authority.

FTS5 indexes context names/descriptions/folder paths, normalized event metadata, session summaries, notes, and checkpoints. Queries are parameterized; user input is converted to quoted prefix terms joined with AND. Arbitrary FTS operators and SQL are not executed. Note updates replace their search entry. Context deletion removes its FTS entries in the same transaction as metadata deletion.

## Time and restart

Timestamps and durations are milliseconds. Pauses are excluded from elapsed time. A backend heartbeat updates only an active session once every 30 seconds; it stops on pause/suspend. Unexpected-exit recovery conservatively treats time after the last heartbeat as offline/paused, potentially losing approximately one heartbeat interval under normal scheduling. Native exit handling pauses active work. Restart never automatically monitors folders.

Changing folders/tracking is blocked while the context has an open session. Watcher startup failures pause the session and report the error. Watcher runtime failures are stored in a visible tracking-status error instead of silently discarding the failure.

## Restore and local security

Resume validates the folder, starts a session, and uses `std::process::Command` with a separate literal argument: `open` on macOS, `xdg-open` on Linux, and Explorer on Windows. There is no shell interpolation. The folder opener’s failure is returned as a warning with the successful session. No applications or files are automatically relaunched in V0.1.

Tauri capabilities allow core window behavior and user-initiated native open/save dialogs. Production CSP limits connections to local IPC and bundled assets. Notes render with raw HTML skipped; images are represented as text and links do not navigate externally. Secrets are not stored or requested. Debug logs avoid user activity payloads and note contents.

Local storage is not application-level encryption. OS protections and full-disk encryption remain relevant. Context deletion is logical deletion, not guaranteed secure erasure from SQLite free pages, journals, OS snapshots, or backups.
