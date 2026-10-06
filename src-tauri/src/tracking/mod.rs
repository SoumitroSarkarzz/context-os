use crate::{db, models::TrackingPreferences, privacy, Error, Result};
use notify::{
    event::{ModifyKind, RenameMode},
    EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use rusqlite::{Connection, OptionalExtension};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
#[derive(Default)]
pub struct Debouncer {
    seen: HashMap<String, Instant>,
}
impl Debouncer {
    pub fn accept(&mut self, key: String, now: Instant) -> bool {
        self.seen
            .retain(|_, time| now.saturating_duration_since(*time) < Duration::from_secs(3));
        if self
            .seen
            .get(&key)
            .is_some_and(|time| now.saturating_duration_since(*time) < Duration::from_secs(2))
        {
            return false;
        }
        self.seen.insert(key, now);
        true
    }
}
pub struct FileTracker {
    _watcher: RecommendedWatcher,
}
impl FileTracker {
    pub fn start(
        db: Arc<Mutex<Connection>>,
        context_id: String,
        session_id: String,
        root: PathBuf,
        prefs: TrackingPreferences,
        storage_root: PathBuf,
        error_slot: Arc<Mutex<Option<String>>>,
    ) -> Result<Self> {
        let mut debounce = Debouncer::default();
        let watch_root = root.clone();
        let mut watcher=RecommendedWatcher::new(move |result:notify::Result<notify::Event>|{
            let report=|message:&str|{if let Ok(mut e)=error_slot.lock(){*e=Some(message.into());}log::warn!("File tracking could not persist an event");};
            let event=match result{Ok(e)=>e,Err(_)=>{report("The filesystem watcher reported an error. Pause and resume the session to retry.");return;}};
            let kind=match event.kind{
                EventKind::Create(_)=>"file_created",EventKind::Remove(_)=>"file_deleted",
                EventKind::Modify(ModifyKind::Name(RenameMode::Both))=>"file_renamed",
                EventKind::Modify(ModifyKind::Name(RenameMode::From))=>"file_deleted",
                EventKind::Modify(ModifyKind::Name(RenameMode::To))=>"file_created",
                EventKind::Modify(_)=>"file_modified",_=>return,
            };
            let Ok(mut connection)=db.lock() else {report("The local database is unavailable.");return;};
            let active:bool=connection.query_row("SELECT 1 FROM sessions WHERE id=?1 AND status='active'",[&session_id],|r|r.get::<_,i64>(0)).optional().ok().flatten().is_some();
            if !active{return;}
            let Ok(tx)=connection.transaction() else {report("Could not write file activity to the database.");return;};
            let paths:Vec<&PathBuf>=if kind=="file_renamed" {event.paths.last().into_iter().collect()} else {event.paths.iter().collect()};
            for path in paths {
                if path.starts_with(&storage_root) || !privacy::allowed_path(&root,path,&prefs.exclusions){continue;}
                if path.is_dir(){continue;}
                let relative=path.strip_prefix(&root).unwrap_or(path).to_string_lossy().to_string();
                if !debounce.accept(format!("{kind}:{relative}"),Instant::now()){continue;}
                let size=std::fs::metadata(path).ok().map(|m|m.len());
                let previous_path=if kind=="file_renamed"{event.paths.first().and_then(|p|p.strip_prefix(&root).ok()).map(|p|p.to_string_lossy().to_string())}else{None};
                let metadata=serde_json::json!({"path":relative,"event_type":kind,"extension":path.extension().map(|e|e.to_string_lossy().to_string()),"size":size,"previous_path":previous_path});
                if db::insert_event(&tx,&context_id,Some(&session_id),kind,"filesystem",metadata).is_err(){report("Could not save a file event. Check available disk space.");return;}
                if kind=="file_renamed"{break;}
            }
            if tx.commit().is_err(){report("Could not commit file activity. Check available disk space.");}
        }, notify::Config::default().with_follow_symlinks(false)).map_err(|_|Error::Invalid("Unable to start the file watcher. Check project folder permissions.".into()))?;
        watcher.watch(&watch_root,RecursiveMode::Recursive).map_err(|_|Error::Invalid("Unable to watch the project folder. Check folder access and system watcher limits.".into()))?;
        Ok(Self { _watcher: watcher })
    }
}

/// Session-scoped heartbeat preserves elapsed time after an unexpected exit,
/// independently of WebView timers or whether the window is hidden.
pub struct Heartbeat {
    stop: std::sync::mpsc::Sender<()>,
    thread: Option<std::thread::JoinHandle<()>>,
}
impl Heartbeat {
    pub fn start(db: Arc<Mutex<Connection>>, session: String) -> Self {
        let (stop, receiver) = std::sync::mpsc::channel();
        let thread = std::thread::spawn(move || loop {
            if receiver.recv_timeout(Duration::from_secs(30))
                != Err(std::sync::mpsc::RecvTimeoutError::Timeout)
            {
                break;
            }
            let Ok(db) = db.lock() else {
                break;
            };
            if db
                .execute(
                    "UPDATE sessions SET last_seen_at=?2 WHERE id=?1 AND status='active'",
                    rusqlite::params![session, crate::now()],
                )
                .is_err()
            {
                log::warn!("Session heartbeat could not be saved");
            }
        });
        Self {
            stop,
            thread: Some(thread),
        }
    }
}
impl Drop for Heartbeat {
    fn drop(&mut self) {
        let _ = self.stop.send(());
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
