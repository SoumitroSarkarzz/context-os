use crate::{models::*, Result};
use rusqlite::{Connection, Row};
use std::path::Path;

pub fn open(path: &Path) -> Result<Connection> {
    let mut db = Connection::open(path)?;
    db.busy_timeout(std::time::Duration::from_secs(5))?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    let version: i64 = db.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version > 1 {
        return Err(crate::Error::Invalid(
            "This database was created by a newer version of Context OS.".into(),
        ));
    }
    if version < 1 {
        let tx = db.transaction()?;
        tx.execute_batch(include_str!("../../migrations/001_initial.sql"))?;
        tx.commit()?;
    }
    Ok(db)
}
pub fn context(r: &Row<'_>) -> rusqlite::Result<Context> {
    let preferences: String = r.get(8)?;
    Ok(Context {
        id: r.get(0)?,
        name: r.get(1)?,
        description: r.get(2)?,
        icon: r.get(3)?,
        accent: r.get(4)?,
        project_folder: r.get(5)?,
        status: r.get(6)?,
        tracking_preferences: serde_json::from_str(&preferences).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(8, rusqlite::types::Type::Text, Box::new(e))
        })?,
        created_at: r.get(9)?,
        updated_at: r.get(10)?,
        last_active_at: r.get(11)?,
        archived: r.get(7)?,
    })
}
pub const CONTEXT_COLUMNS: &str = "id,name,description,icon,accent,project_folder,status,archived,tracking_preferences,created_at,updated_at,last_active_at";
pub fn session(r: &Row<'_>) -> rusqlite::Result<Session> {
    Ok(Session {
        id: r.get(0)?,
        context_id: r.get(1)?,
        started_at: r.get(2)?,
        ended_at: r.get(3)?,
        paused_duration: r.get(4)?,
        total_duration: r.get(5)?,
        status: r.get(6)?,
        paused_at: r.get(7)?,
        last_seen_at: r.get(8)?,
        summary: r.get(9)?,
    })
}
pub const SESSION_COLUMNS:&str = "id,context_id,started_at,ended_at,paused_duration,total_duration,status,paused_at,last_seen_at,summary";
pub fn event(r: &Row<'_>) -> rusqlite::Result<Event> {
    let metadata: String = r.get(6)?;
    Ok(Event {
        id: r.get(0)?,
        context_id: r.get(1)?,
        session_id: r.get(2)?,
        event_type: r.get(3)?,
        timestamp: r.get(4)?,
        source: r.get(5)?,
        metadata: serde_json::from_str(&metadata).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(6, rusqlite::types::Type::Text, Box::new(e))
        })?,
    })
}
pub fn note(r: &Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: r.get(0)?,
        context_id: r.get(1)?,
        session_id: r.get(2)?,
        body: r.get(3)?,
        pinned: r.get(4)?,
        created_at: r.get(5)?,
        updated_at: r.get(6)?,
    })
}
pub fn checkpoint(r: &Row<'_>) -> rusqlite::Result<Checkpoint> {
    fn list(r: &Row<'_>, col: usize) -> rusqlite::Result<Vec<String>> {
        let s: String = r.get(col)?;
        serde_json::from_str(&s).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(col, rusqlite::types::Type::Text, Box::new(e))
        })
    }
    Ok(Checkpoint {
        id: r.get(0)?,
        context_id: r.get(1)?,
        session_id: r.get(2)?,
        timestamp: r.get(3)?,
        duration: r.get(4)?,
        summary: r.get(5)?,
        completed: list(r, 6)?,
        unfinished: list(r, 7)?,
        next_action: r.get(8)?,
        files: list(r, 9)?,
    })
}
pub fn index(
    db: &Connection,
    id: &str,
    context: &str,
    kind: &str,
    title: &str,
    body: &str,
    time: i64,
) -> Result<()> {
    db.execute("DELETE FROM memory_index WHERE entity_id=?1", [id])?;
    db.execute("INSERT INTO memory_index(entity_id,context_id,kind,title,body,timestamp) VALUES (?1,?2,?3,?4,?5,?6)",rusqlite::params![id,context,kind,title,body,time])?;
    Ok(())
}
pub fn insert_event(
    db: &Connection,
    context: &str,
    session: Option<&str>,
    kind: &str,
    source: &str,
    metadata: serde_json::Value,
) -> Result<Event> {
    let event = Event {
        id: crate::id(),
        context_id: context.into(),
        session_id: session.map(str::to_string),
        event_type: kind.into(),
        timestamp: crate::now(),
        source: source.into(),
        metadata,
    };
    db.execute(
        "INSERT INTO events VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![
            event.id,
            event.context_id,
            event.session_id,
            event.event_type,
            event.timestamp,
            event.source,
            event.metadata.to_string()
        ],
    )?;
    index(
        db,
        &event.id,
        context,
        "event",
        &kind.replace('_', " "),
        &event.metadata.to_string(),
        event.timestamp,
    )?;
    Ok(event)
}
