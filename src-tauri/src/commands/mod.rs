mod contexts;
mod notes;
mod sessions;

use crate::{
    checkpoints, db,
    models::*,
    privacy, restore, search,
    tracking::{FileTracker, Heartbeat},
    Error, Result,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
};

pub struct Core {
    pub db: Arc<Mutex<Connection>>,
    watcher: Mutex<Option<FileTracker>>,
    heartbeat: Mutex<Option<Heartbeat>>,
    pub tracking_error: Arc<Mutex<Option<String>>>,
    database_path: PathBuf,
}
impl Core {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700))?;
            }
        }
        let mut connection = db::open(path)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
        }
        // Live processes do not survive restart. Recover without charging offline time.
        let timestamp = crate::now();
        let tx = connection.transaction()?;
        let recovered: Vec<(String, String)> = {
            let mut query =
                tx.prepare("SELECT id,context_id FROM sessions WHERE status='active'")?;
            let values = query
                .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            values
        };
        tx.execute("UPDATE sessions SET status='paused',paused_duration=paused_duration+MAX(0,?1-last_seen_at),paused_at=?1 WHERE status='active'",[timestamp])?;
        for (session, context) in recovered {
            db::insert_event(
                &tx,
                &context,
                Some(&session),
                "session_paused",
                "recovery",
                serde_json::json!({"reason":"App restarted; tracking is paused until you resume."}),
            )?;
        }
        tx.commit()?;
        Ok(Self {
            db: Arc::new(Mutex::new(connection)),
            watcher: Mutex::new(None),
            heartbeat: Mutex::new(None),
            tracking_error: Arc::new(Mutex::new(None)),
            database_path: path.into(),
        })
    }
    pub fn connection(&self) -> Result<MutexGuard<'_, Connection>> {
        self.db.lock().map_err(|_| {
            Error::Invalid("The local database is unavailable. Restart Context OS.".into())
        })
    }
    pub fn state(&self) -> Result<AppState> {
        let db = self.connection()?;
        let time = crate::now();
        db.execute(
            "UPDATE sessions SET last_seen_at=?1 WHERE status='active'",
            [time],
        )?;
        let contexts = collect(
            &db,
            &format!(
                "SELECT {} FROM contexts ORDER BY COALESCE(last_active_at,created_at) DESC",
                db::CONTEXT_COLUMNS
            ),
            db::context,
        )?;
        let sessions = collect(
            &db,
            &format!(
                "SELECT {} FROM sessions ORDER BY started_at DESC",
                db::SESSION_COLUMNS
            ),
            db::session,
        )?;
        let events=collect(&db,"SELECT id,context_id,session_id,event_type,timestamp,source,metadata_json FROM events ORDER BY timestamp DESC LIMIT 1000",db::event)?;
        let notes=collect(&db,"SELECT id,context_id,session_id,body,pinned,created_at,updated_at FROM notes ORDER BY pinned DESC,updated_at DESC",db::note)?;
        let checkpoints=collect(&db,"SELECT id,context_id,session_id,timestamp,duration,summary,completed,unfinished,next_action,files FROM checkpoints ORDER BY timestamp DESC",db::checkpoint)?;
        let settings = db
            .query_row(
                "SELECT value FROM settings WHERE key='preferences'",
                [],
                |r| r.get::<_, String>(0),
            )
            .optional()?
            .map(|s| serde_json::from_str(&s))
            .transpose()?
            .unwrap_or_default();
        let event_count = db.query_row("SELECT count(*) FROM events", [], |r| r.get(0))?;
        let database_bytes = std::fs::metadata(&self.database_path)
            .map(|m| m.len())
            .unwrap_or(0)
            + std::fs::metadata(format!("{}-wal", self.database_path.display()))
                .map(|m| m.len())
                .unwrap_or(0);
        Ok(AppState {
            contexts,
            sessions,
            events,
            notes,
            checkpoints,
            settings,
            event_count,
            database_bytes,
        })
    }
}
fn collect<T>(
    db: &Connection,
    sql: &str,
    map: fn(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
) -> Result<Vec<T>> {
    let mut query = db.prepare(sql)?;
    let values = query
        .query_map([], map)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(values)
}
pub fn get_context(db: &Connection, id: &str) -> Result<Context> {
    db.query_row(
        &format!("SELECT {} FROM contexts WHERE id=?1", db::CONTEXT_COLUMNS),
        [id],
        db::context,
    )
    .optional()?
    .ok_or_else(|| Error::Invalid("Context not found.".into()))
}
pub fn get_session(db: &Connection, id: &str) -> Result<Session> {
    db.query_row(
        &format!("SELECT {} FROM sessions WHERE id=?1", db::SESSION_COLUMNS),
        [id],
        db::session,
    )
    .optional()?
    .ok_or_else(|| Error::Invalid("Session not found.".into()))
}
pub fn open_session(db: &Connection) -> Result<Option<Session>> {
    Ok(db
        .query_row(
            &format!(
                "SELECT {} FROM sessions WHERE status IN ('active','paused') LIMIT 1",
                db::SESSION_COLUMNS
            ),
            [],
            db::session,
        )
        .optional()?)
}
