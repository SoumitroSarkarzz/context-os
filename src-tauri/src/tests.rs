use crate::{commands::Core, models::*, privacy, tracking::Debouncer};
use std::time::{Duration, Instant};
use tempfile::TempDir;
fn fixture() -> (TempDir, Core, ContextInput) {
    let dir = TempDir::new().unwrap();
    let folder = dir.path().join("project");
    std::fs::create_dir(&folder).unwrap();
    let core = Core::open(&dir.path().join("data/store.sqlite3")).unwrap();
    let input = ContextInput {
        name: "Gundam".into(),
        description: "Chest materials".into(),
        icon: "layers".into(),
        accent: "#b8ee80".into(),
        project_folder: folder.to_string_lossy().into(),
        tracking_preferences: TrackingPreferences::default(),
    };
    (dir, core, input)
}
#[test]
fn migration_crud_settings_and_persistence() {
    let (dir, core, input) = fixture();
    let ctx = core.create_context(input.clone()).unwrap();
    assert_eq!(core.state().unwrap().contexts.len(), 1);
    let mut edited = input;
    edited.name = "Gundam materials".into();
    core.update_context(&ctx.id, edited).unwrap();
    core.archive_context(&ctx.id, true).unwrap();
    assert!(core.state().unwrap().contexts[0].archived);
    assert!(core.start_session(&ctx.id).is_err());
    core.archive_context(&ctx.id, false).unwrap();
    core.save_settings(Settings {
        theme: "light".into(),
        ..Default::default()
    })
    .unwrap();
    drop(core);
    let core = Core::open(&dir.path().join("data/store.sqlite3")).unwrap();
    assert_eq!(core.state().unwrap().settings.theme, "light");
    assert_eq!(core.state().unwrap().contexts[0].name, "Gundam materials");
    core.delete_context(&ctx.id).unwrap();
    assert!(core.state().unwrap().contexts.is_empty());
    assert!(core.search("Gundam").unwrap().is_empty());
}
#[test]
fn session_lifecycle_excludes_paused_time_and_checkpoints() {
    let (_dir, core, input) = fixture();
    let ctx = core.create_context(input).unwrap();
    let s = core.start_session(&ctx.id).unwrap();
    assert!(core.start_session(&ctx.id).is_err());
    assert!(core.delete_context(&ctx.id).is_err());
    std::thread::sleep(Duration::from_millis(30));
    let paused = core.pause_session(&s.id).unwrap();
    let before = paused.elapsed(crate::now());
    std::thread::sleep(Duration::from_millis(70));
    assert_eq!(paused.elapsed(crate::now()), before);
    let resumed = core.continue_session(&s.id).unwrap();
    assert!(resumed.paused_duration >= 70);
    core.save_note(&ctx.id, None, "NEXT: correct the chest UV seam", true)
        .unwrap();
    let checkpoint = core.suspend_session(&s.id).unwrap();
    let finished = core.state().unwrap().sessions[0].clone();
    assert_eq!(
        checkpoint.duration,
        finished.ended_at.unwrap() - finished.started_at - finished.paused_duration
    );
    assert!(checkpoint.next_action.contains("UV seam"));
    assert_eq!(core.state().unwrap().sessions[0].status, "completed");
    assert!(core.suspend_session(&s.id).is_err());
    assert_eq!(core.state().unwrap().checkpoints.len(), 1);
    assert_eq!(core.state().unwrap().contexts[0].status, "suspended");
    assert!(!core.search("chest UV").unwrap().is_empty());
    core.start_session(&ctx.id).unwrap();
}
#[test]
fn restart_recovers_active_session_without_tracking() {
    let (dir, core, input) = fixture();
    let ctx = core.create_context(input).unwrap();
    let s = core.start_session(&ctx.id).unwrap();
    core.state().unwrap();
    drop(core);
    std::thread::sleep(Duration::from_millis(40));
    let core = Core::open(&dir.path().join("data/store.sqlite3")).unwrap();
    let state = core.state().unwrap();
    assert_eq!(state.sessions[0].status, "paused");
    assert!(state.sessions[0].paused_duration >= 40);
    assert!(core.start_session(&ctx.id).is_err());
    core.continue_session(&s.id).unwrap();
    core.suspend_session(&s.id).unwrap();
}
#[test]
fn note_search_updates_and_safe_fts_queries() {
    let (_dir, core, input) = fixture();
    let ctx = core.create_context(input).unwrap();
    let note = core
        .save_note(&ctx.id, None, "enemy collision fixed", false)
        .unwrap();
    assert_eq!(core.search("collision").unwrap().len(), 1);
    core.save_note(&ctx.id, Some(&note.id), "lighting next", true)
        .unwrap();
    assert!(core.search("collision").unwrap().is_empty());
    assert_eq!(core.search("lighting").unwrap().len(), 1);
    for query in ["\" OR *", "' ; DROP TABLE contexts; --", "", "(((("] {
        core.search(query).unwrap();
    }
    core.delete_note(&note.id).unwrap();
    assert!(core.search("lighting").unwrap().is_empty());
}
#[test]
fn path_scope_exclusions_and_debounce() {
    let (dir, _, input) = fixture();
    let root = std::path::Path::new(&input.project_folder);
    assert!(privacy::allowed_path(
        root,
        &root.join("scene.blend"),
        &input.tracking_preferences.exclusions
    ));
    assert!(!privacy::allowed_path(
        root,
        &root.join("node_modules/pkg/index.js"),
        &input.tracking_preferences.exclusions
    ));
    assert!(!privacy::allowed_path(
        root,
        &dir.path().join("private.txt"),
        &[]
    ));
    assert!(!privacy::allowed_path(
        root,
        &root.join("../private.txt"),
        &[]
    ));
    let mut d = Debouncer::default();
    let time = Instant::now();
    assert!(d.accept("path".into(), time));
    assert!(!d.accept("path".into(), time + Duration::from_secs(1)));
    assert!(d.accept("path".into(), time + Duration::from_secs(3)));
}
#[test]
fn real_filesystem_watcher_persists_events_and_stops_when_paused() {
    let (dir, core, mut input) = fixture();
    input.tracking_preferences.files = true;
    let root = std::path::PathBuf::from(&input.project_folder);
    let ctx = core.create_context(input).unwrap();
    let s = core.start_session(&ctx.id).unwrap();
    std::fs::write(root.join("body_texture.png"), b"metadata only").unwrap();
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if core
            .state()
            .unwrap()
            .events
            .iter()
            .any(|e| e.event_type == "file_created" && e.metadata["path"] == "body_texture.png")
        {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "filesystem event was not recorded"
        );
        std::thread::sleep(Duration::from_millis(30));
    }
    std::fs::create_dir(root.join("node_modules")).unwrap();
    std::fs::write(root.join("node_modules/noisy.js"), b"ignored").unwrap();
    std::thread::sleep(Duration::from_millis(100));
    core.pause_session(&s.id).unwrap();
    std::fs::write(root.join("paused.txt"), b"do not track").unwrap();
    std::thread::sleep(Duration::from_millis(100));
    let state = core.state().unwrap();
    assert!(!state
        .events
        .iter()
        .any(|e| e.metadata["path"] == "paused.txt"));
    assert!(!state.events.iter().any(|e| e.metadata["path"]
        .as_str()
        .is_some_and(|p| p.contains("noisy"))));
    let cp = core.suspend_session(&s.id).unwrap();
    assert!(cp.files.contains(&"body_texture.png".into()));
    drop(core);
    let core = Core::open(&dir.path().join("data/store.sqlite3")).unwrap();
    assert_eq!(core.state().unwrap().checkpoints.len(), 1);
    assert!(!core.search("body_texture").unwrap().is_empty());
}
#[test]
fn invalid_context_never_saved() {
    let (_dir, core, mut input) = fixture();
    input.name = " ".into();
    assert!(core.create_context(input.clone()).is_err());
    input.name = "valid".into();
    input.project_folder = "/does/not/exist".into();
    assert!(core.create_context(input).is_err());
    assert!(core.state().unwrap().contexts.is_empty());
}
#[test]
fn duration_math_is_exact() {
    let s = Session {
        id: "id".into(),
        context_id: "context".into(),
        started_at: 1000,
        ended_at: None,
        paused_duration: 500,
        total_duration: 0,
        status: "paused".into(),
        paused_at: Some(3000),
        last_seen_at: 3000,
        summary: String::new(),
    };
    assert_eq!(s.elapsed(10_000), 1500);
}

#[test]
fn folder_restore_passes_one_literal_argument_without_a_shell() {
    let (_dir, _core, input) = fixture();
    let path =
        std::path::Path::new(&input.project_folder).join("model ; $(touch unwanted) ' \" folder");
    std::fs::create_dir(&path).unwrap();
    let command = crate::restore::folder_command(&path);
    assert_eq!(
        command.get_args().collect::<Vec<_>>(),
        vec![path.as_os_str()]
    );
    assert_ne!(command.get_program(), std::ffi::OsStr::new("sh"));
}
#[cfg(unix)]
#[test]
fn symlinks_cannot_escape_project_scope() {
    let (dir, _core, input) = fixture();
    let root = std::path::Path::new(&input.project_folder);
    let secret = dir.path().join("outside.txt");
    std::fs::write(&secret, "not monitored").unwrap();
    std::os::unix::fs::symlink(&secret, root.join("linked.txt")).unwrap();
    assert!(!privacy::allowed_path(root, &root.join("linked.txt"), &[]));
}
#[test]
fn migration_is_versioned_and_newer_databases_are_rejected() {
    let (dir, core, _) = fixture();
    let connection = core.connection().unwrap();
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(version, 1);
    connection.execute_batch("PRAGMA user_version=2").unwrap();
    drop(connection);
    drop(core);
    assert!(Core::open(&dir.path().join("data/store.sqlite3")).is_err());
}

fn wait_for_file_event(core: &Core, kind: &str, path: &str, since: i64) -> crate::models::Event {
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if let Some(event) =
            core.state().unwrap().events.into_iter().find(|e| {
                e.event_type == kind && e.metadata["path"] == path && e.timestamp >= since
            })
        {
            return event;
        }
        assert!(Instant::now() < deadline, "Expected {kind} for {path}");
        std::thread::sleep(Duration::from_millis(25));
    }
}
#[test]
fn real_watcher_records_modification_rename_and_deletion() {
    let (_dir, core, mut input) = fixture();
    input.tracking_preferences.files = true;
    let root = std::path::PathBuf::from(&input.project_folder);
    let context = core.create_context(input).unwrap();
    let session = core.start_session(&context.id).unwrap();
    let file = root.join("scene.blend");
    std::fs::write(&file, b"initial").unwrap();
    wait_for_file_event(&core, "file_created", "scene.blend", 0);
    // Move beyond the intentional event-coalescing interval before another save.
    std::thread::sleep(Duration::from_millis(2100));
    let edit_time = crate::now();
    std::fs::write(&file, b"changed").unwrap();
    let modified = wait_for_file_event(&core, "file_modified", "scene.blend", edit_time);
    assert!(modified.timestamp >= edit_time);
    std::fs::rename(&file, root.join("scene-final.blend")).unwrap();
    let renamed = wait_for_file_event(&core, "file_renamed", "scene-final.blend", 0);
    assert_eq!(renamed.metadata["previous_path"], "scene.blend");
    std::fs::remove_file(root.join("scene-final.blend")).unwrap();
    wait_for_file_event(&core, "file_deleted", "scene-final.blend", 0);
    let checkpoint = core.suspend_session(&session.id).unwrap();
    assert!(checkpoint.files.contains(&"scene-final.blend".to_string()));
}
#[test]
fn app_storage_is_never_recorded_even_when_inside_selected_project() {
    let (dir, core, mut input) = fixture();
    input.project_folder = dir.path().to_string_lossy().into_owned();
    input.tracking_preferences.files = true;
    input.tracking_preferences.exclusions.clear();
    let context = core.create_context(input).unwrap();
    let session = core.start_session(&context.id).unwrap();
    std::fs::write(dir.path().join("work.txt"), b"work").unwrap();
    wait_for_file_event(&core, "file_created", "work.txt", 0);
    std::thread::sleep(Duration::from_millis(100));
    let events = core.state().unwrap().events;
    assert!(!events.iter().any(|e| e.metadata["path"]
        .as_str()
        .is_some_and(|p| p.starts_with("data/"))));
    core.suspend_session(&session.id).unwrap();
}
