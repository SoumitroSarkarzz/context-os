use super::*;

impl Core {
    pub fn save_note(
        &self,
        context: &str,
        id: Option<&str>,
        body: &str,
        pinned: bool,
    ) -> Result<Note> {
        if body.trim().is_empty() {
            return Err(Error::Invalid("Write a note before saving.".into()));
        }
        if body.len() > 100_000 {
            return Err(Error::Invalid("Notes must be smaller than 100 KB.".into()));
        }
        let mut db = self.connection()?;
        get_context(&db, context)?;
        let session = open_session(&db)?
            .filter(|s| s.context_id == context)
            .map(|s| s.id);
        let note_id = id.map(str::to_string).unwrap_or_else(crate::id);
        let time = crate::now();
        let tx = db.transaction()?;
        if id.is_some() {
            let changed = tx.execute(
                "UPDATE notes SET body=?3,pinned=?4,updated_at=?5 WHERE id=?1 AND context_id=?2",
                params![note_id, context, body, pinned, time],
            )?;
            if changed == 0 {
                return Err(Error::Invalid("Note not found.".into()));
            }
        } else {
            tx.execute(
                "INSERT INTO notes VALUES (?1,?2,?3,?4,?5,?6,?6)",
                params![note_id, context, session, body, pinned, time],
            )?;
            db::insert_event(
                &tx,
                context,
                session.as_deref(),
                "note_created",
                "notes",
                serde_json::json!({"note_id":note_id}),
            )?;
        }
        db::index(&tx, &note_id, context, "note", "Project note", body, time)?;
        tx.commit()?;
        Ok(db.query_row("SELECT id,context_id,session_id,body,pinned,created_at,updated_at FROM notes WHERE id=?1",[note_id],db::note)?)
    }
    pub fn delete_note(&self, id: &str) -> Result<()> {
        let mut db = self.connection()?;
        let tx = db.transaction()?;
        tx.execute("DELETE FROM notes WHERE id=?1", [id])?;
        tx.execute("DELETE FROM memory_index WHERE entity_id=?1", [id])?;
        tx.commit()?;
        Ok(())
    }
    pub fn save_settings(&self, settings: Settings) -> Result<()> {
        if !["system", "dark", "light"].contains(&settings.theme.as_str()) {
            return Err(Error::Invalid("Invalid appearance setting.".into()));
        }
        self.connection()?.execute("INSERT INTO settings VALUES ('preferences',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[serde_json::to_string(&settings)?])?;
        Ok(())
    }
    pub fn search(&self, query: &str) -> Result<Vec<SearchResult>> {
        {
            let db = self.connection()?;
            search::search(&db, query)
        }
    }
}
