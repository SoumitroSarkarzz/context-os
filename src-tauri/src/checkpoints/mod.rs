use crate::{db, models::*, Result};
use rusqlite::{params, Connection};
use std::collections::BTreeSet;
pub fn generate(db: &Connection, session: &Session) -> Result<Checkpoint> {
    let mut query=db.prepare("SELECT id,context_id,session_id,event_type,timestamp,source,metadata_json FROM events WHERE session_id=?1 ORDER BY timestamp")?;
    let events = query
        .query_map([&session.id], db::event)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let files: Vec<String> = events
        .iter()
        .filter(|e| e.event_type.starts_with("file_"))
        .filter_map(|e| e.metadata["path"].as_str().map(str::to_string))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let edits = events
        .iter()
        .filter(|e| e.event_type.starts_with("file_"))
        .count();
    let minutes = session.total_duration / 60_000;
    let summary = if files.is_empty() {
        format!(
            "A {} minute session. No tracked file changes were recorded.",
            minutes
        )
    } else {
        format!(
            "Worked for {} minutes across {} files; {} file events recorded. Recent work: {}.",
            minutes,
            files.len(),
            edits,
            files.iter().take(3).cloned().collect::<Vec<_>>().join(", ")
        )
    };
    let latest_note:Option<String>=db.query_row("SELECT body FROM notes WHERE context_id=?1 ORDER BY pinned DESC,updated_at DESC LIMIT 1",[&session.context_id],|r|r.get(0)).optional()?;
    let next_action = latest_note
        .as_deref()
        .and_then(|body| body.lines().find(|l| !l.trim().is_empty()))
        .map(|s| s.chars().take(250).collect())
        .unwrap_or_else(|| {
            files
                .first()
                .map(|p| format!("Review {} and your previous checkpoint.", p))
                .unwrap_or_else(|| "Review your project notes and choose the next step.".into())
        });
    let checkpoint=Checkpoint{id:crate::id(),context_id:session.context_id.clone(),session_id:session.id.clone(),timestamp:crate::now(),duration:session.total_duration,summary,completed:vec![format!("Saved a checkpoint with {} tracked file events.",edits)],unfinished:vec!["Completion and unfinished work are not inferred from filenames. Record these in your notes.".into()],next_action,files};
    db.execute(
        "INSERT INTO checkpoints VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            checkpoint.id,
            checkpoint.context_id,
            checkpoint.session_id,
            checkpoint.timestamp,
            checkpoint.duration,
            checkpoint.summary,
            serde_json::to_string(&checkpoint.completed)?,
            serde_json::to_string(&checkpoint.unfinished)?,
            checkpoint.next_action,
            serde_json::to_string(&checkpoint.files)?
        ],
    )?;
    db::index(
        db,
        &checkpoint.id,
        &checkpoint.context_id,
        "checkpoint",
        "Session checkpoint",
        &format!(
            "{} {} {}",
            checkpoint.summary,
            checkpoint.next_action,
            checkpoint.files.join(" ")
        ),
        checkpoint.timestamp,
    )?;
    Ok(checkpoint)
}
use rusqlite::OptionalExtension;
