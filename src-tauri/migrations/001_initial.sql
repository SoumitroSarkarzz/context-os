PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS contexts (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT 'layers', accent TEXT NOT NULL DEFAULT '#b8ee80', project_folder TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'inactive' CHECK(status IN ('active','suspended','inactive','archived')), tracking_preferences TEXT NOT NULL,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_active_at INTEGER, archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE, started_at INTEGER NOT NULL, ended_at INTEGER,
 paused_duration INTEGER NOT NULL DEFAULT 0, total_duration INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK(status IN ('active','paused','completed')),
 paused_at INTEGER, last_seen_at INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_session ON sessions((1)) WHERE status IN ('active','paused');
CREATE INDEX IF NOT EXISTS sessions_context ON sessions(context_id,started_at DESC);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE, session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, timestamp INTEGER NOT NULL, source TEXT NOT NULL, metadata_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_context_time ON events(context_id,timestamp DESC);
CREATE INDEX IF NOT EXISTS events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS events_type_time ON events(event_type,timestamp DESC);
CREATE INDEX IF NOT EXISTS events_file_path ON events(context_id,json_extract(metadata_json,'$.path')) WHERE source='filesystem';
CREATE TABLE IF NOT EXISTS notes (
 id TEXT PRIMARY KEY, context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE, session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
 body TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checkpoints (
 id TEXT PRIMARY KEY, context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
 timestamp INTEGER NOT NULL, duration INTEGER NOT NULL, summary TEXT NOT NULL, completed TEXT NOT NULL, unfinished TEXT NOT NULL, next_action TEXT NOT NULL, files TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_context_time ON notes(context_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS checkpoints_context_time ON checkpoints(context_id,timestamp DESC);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS memory_index USING fts5(entity_id UNINDEXED,context_id UNINDEXED,kind UNINDEXED,title,body,timestamp UNINDEXED,tokenize='unicode61');
PRAGMA user_version = 1;
