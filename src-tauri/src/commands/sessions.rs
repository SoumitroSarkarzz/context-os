use super::*;

impl Core {
    pub fn start_session(&self, context_id: &str) -> Result<Session> {
        let session = {
            let mut db = self.connection()?;
            let context = get_context(&db, context_id)?;
            if context.archived {
                return Err(Error::Invalid(
                    "Restore the archived context before starting a session.".into(),
                ));
            }
            privacy::canonical_folder(&context.project_folder)?;
            if open_session(&db)?.is_some() {
                return Err(Error::Invalid(
                    "Suspend the open session before entering another context.".into(),
                ));
            }
            let id = crate::id();
            let time = crate::now();
            let tx = db.transaction()?;
            tx.execute("INSERT INTO sessions(id,context_id,started_at,status,last_seen_at) VALUES (?1,?2,?3,'active',?3)",params![id,context_id,time])?;
            tx.execute(
                "UPDATE contexts SET status='active',last_active_at=?2,updated_at=?2 WHERE id=?1",
                params![context_id, time],
            )?;
            db::insert_event(
                &tx,
                context_id,
                Some(&id),
                "session_started",
                "session",
                serde_json::json!({}),
            )?;
            db::index(
                &tx,
                &id,
                context_id,
                "session",
                &format!("Session — {}", context.name),
                "Active work session",
                time,
            )?;
            tx.commit()?;
            get_session(&db, &id)?
        };
        if let Err(e) = self.start_tracker(&session) {
            self.pause_session(&session.id)?;
            return Err(e);
        }
        Ok(session)
    }
    fn start_tracker(&self, session: &Session) -> Result<()> {
        let context = {
            let db = self.connection()?;
            get_context(&db, &session.context_id)?
        };
        let mut slot = self
            .watcher
            .lock()
            .map_err(|_| Error::Invalid("File watcher unavailable.".into()))?;
        *self
            .tracking_error
            .lock()
            .map_err(|_| Error::Invalid("Tracking status unavailable.".into()))? = None;
        if context.tracking_preferences.files {
            *slot = Some(FileTracker::start(
                self.db.clone(),
                context.id,
                session.id.clone(),
                PathBuf::from(context.project_folder),
                context.tracking_preferences,
                self.database_path
                    .parent()
                    .unwrap_or(Path::new("."))
                    .canonicalize()?,
                self.tracking_error.clone(),
            )?);
        }
        *self
            .heartbeat
            .lock()
            .map_err(|_| Error::Invalid("Session clock unavailable.".into()))? =
            Some(Heartbeat::start(self.db.clone(), session.id.clone()));
        Ok(())
    }
    fn stop_tracker(&self) -> Result<()> {
        let heartbeat = self
            .heartbeat
            .lock()
            .map_err(|_| Error::Invalid("Session clock unavailable.".into()))?
            .take();
        drop(heartbeat);
        let tracker = self
            .watcher
            .lock()
            .map_err(|_| Error::Invalid("File watcher unavailable.".into()))?
            .take();
        drop(tracker);
        Ok(())
    }
    pub fn pause_session(&self, id: &str) -> Result<Session> {
        let session = {
            let mut db = self.connection()?;
            let session = get_session(&db, id)?;
            if session.status != "active" {
                return Err(Error::Invalid(
                    "Only an active session can be paused.".into(),
                ));
            }
            let time = crate::now();
            let tx = db.transaction()?;
            tx.execute(
                "UPDATE sessions SET status='paused',paused_at=?2,last_seen_at=?2 WHERE id=?1",
                params![id, time],
            )?;
            db::insert_event(
                &tx,
                &session.context_id,
                Some(id),
                "session_paused",
                "session",
                serde_json::json!({}),
            )?;
            tx.commit()?;
            get_session(&db, id)?
        };
        self.stop_tracker()?;
        Ok(session)
    }
    pub fn continue_session(&self, id: &str) -> Result<Session> {
        let session = {
            let mut db = self.connection()?;
            let session = get_session(&db, id)?;
            if session.status != "paused" {
                return Err(Error::Invalid(
                    "Only a paused session can be continued.".into(),
                ));
            }
            privacy::canonical_folder(&get_context(&db, &session.context_id)?.project_folder)?;
            let time = crate::now();
            let tx = db.transaction()?;
            tx.execute("UPDATE sessions SET status='active',paused_duration=paused_duration+MAX(0,?2-paused_at),paused_at=NULL,last_seen_at=?2 WHERE id=?1",params![id,time])?;
            db::insert_event(
                &tx,
                &session.context_id,
                Some(id),
                "session_resumed",
                "session",
                serde_json::json!({}),
            )?;
            tx.commit()?;
            get_session(&db, id)?
        };
        if let Err(e) = self.start_tracker(&session) {
            self.pause_session(id)?;
            return Err(e);
        }
        Ok(session)
    }
    pub fn suspend_session(&self, id: &str) -> Result<Checkpoint> {
        let checkpoint = {
            let mut db = self.connection()?;
            let session = get_session(&db, id)?;
            if session.status == "completed" {
                return Err(Error::Invalid("This session is already completed.".into()));
            }
            let time = crate::now();
            let duration = session.elapsed(time);
            let tx = db.transaction()?;
            tx.execute("UPDATE sessions SET status='completed',ended_at=?2,total_duration=?3,last_seen_at=?2,paused_duration=paused_duration+CASE WHEN status='paused' THEN MAX(0,?2-paused_at) ELSE 0 END,paused_at=NULL WHERE id=?1",params![id,time,duration])?;
            tx.execute("UPDATE contexts SET status='suspended',last_active_at=?2,updated_at=?2 WHERE id=?1",params![session.context_id,time])?;
            db::insert_event(
                &tx,
                &session.context_id,
                Some(id),
                "session_finished",
                "session",
                serde_json::json!({"duration":duration}),
            )?;
            let completed = get_session(&tx, id)?;
            let checkpoint = checkpoints::generate(&tx, &completed)?;
            tx.execute(
                "UPDATE sessions SET summary=?2 WHERE id=?1",
                params![id, checkpoint.summary],
            )?;
            db::index(
                &tx,
                id,
                &session.context_id,
                "session",
                "Completed session",
                &checkpoint.summary,
                time,
            )?;
            db::insert_event(
                &tx,
                &session.context_id,
                Some(id),
                "checkpoint_created",
                "checkpoint",
                serde_json::json!({"checkpoint_id":checkpoint.id}),
            )?;
            tx.commit()?;
            checkpoint
        };
        self.stop_tracker()?;
        Ok(checkpoint)
    }
    pub fn resume_context(&self, id: &str) -> Result<ResumeResult> {
        let context = {
            let db = self.connection()?;
            get_context(&db, id)?
        };
        let session = self.start_session(id)?;
        let opened = restore::open_folder(&context.project_folder);
        Ok(ResumeResult {
            session,
            folder_opened: opened.is_ok(),
            warning: opened.err().map(|e| e.to_string()),
        })
    }
}
