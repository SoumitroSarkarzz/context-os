use super::*;

impl Core {
    pub fn create_context(&self, mut input: ContextInput) -> Result<Context> {
        privacy::validate(&mut input)?;
        let id = crate::id();
        let time = crate::now();
        let mut db = self.connection()?;
        let tx = db.transaction()?;
        tx.execute("INSERT INTO contexts(id,name,description,icon,accent,project_folder,tracking_preferences,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8)",params![id,input.name,input.description,input.icon,input.accent,input.project_folder,serde_json::to_string(&input.tracking_preferences)?,time])?;
        db::index(
            &tx,
            &id,
            &id,
            "context",
            &input.name,
            &format!("{} {}", input.description, input.project_folder),
            time,
        )?;
        tx.commit()?;
        get_context(&db, &id)
    }
    pub fn update_context(&self, id: &str, mut input: ContextInput) -> Result<Context> {
        privacy::validate(&mut input)?;
        let mut db = self.connection()?;
        get_context(&db, id)?;
        if open_session(&db)?.is_some_and(|s| s.context_id == id) {
            return Err(Error::Invalid(
                "Suspend this context before changing its folder or tracking preferences.".into(),
            ));
        }
        let time = crate::now();
        let tx = db.transaction()?;
        tx.execute("UPDATE contexts SET name=?2,description=?3,icon=?4,accent=?5,project_folder=?6,tracking_preferences=?7,updated_at=?8 WHERE id=?1",params![id,input.name,input.description,input.icon,input.accent,input.project_folder,serde_json::to_string(&input.tracking_preferences)?,time])?;
        db::index(
            &tx,
            id,
            id,
            "context",
            &input.name,
            &format!("{} {}", input.description, input.project_folder),
            time,
        )?;
        tx.commit()?;
        get_context(&db, id)
    }
    pub fn archive_context(&self, id: &str, archived: bool) -> Result<()> {
        let db = self.connection()?;
        get_context(&db, id)?;
        if open_session(&db)?.is_some_and(|s| s.context_id == id) {
            return Err(Error::Invalid(
                "Suspend the current session before archiving.".into(),
            ));
        }
        db.execute(
            "UPDATE contexts SET archived=?2,status=?3,updated_at=?4 WHERE id=?1",
            params![
                id,
                archived,
                if archived { "archived" } else { "suspended" },
                crate::now()
            ],
        )?;
        Ok(())
    }
    pub fn delete_context(&self, id: &str) -> Result<()> {
        let mut db = self.connection()?;
        get_context(&db, id)?;
        if open_session(&db)?.is_some_and(|s| s.context_id == id) {
            return Err(Error::Invalid(
                "Suspend this context before deleting it.".into(),
            ));
        }
        let tx = db.transaction()?;
        tx.execute("DELETE FROM memory_index WHERE context_id=?1", [id])?;
        tx.execute("DELETE FROM contexts WHERE id=?1", [id])?;
        tx.commit()?;
        Ok(())
    }
}
