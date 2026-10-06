use crate::{commands::Core, models::*};
use tauri::{Manager, State};
type CommandResult<T> = std::result::Result<T, String>;
fn result<T>(value: crate::Result<T>) -> CommandResult<T> {
    value.map_err(|e| e.to_string())
}
#[tauri::command]
fn get_state(core: State<'_, Core>) -> CommandResult<AppState> {
    result(core.state())
}
#[tauri::command]
fn create_context(core: State<'_, Core>, input: ContextInput) -> CommandResult<Context> {
    result(core.create_context(input))
}
#[tauri::command]
fn update_context(
    core: State<'_, Core>,
    id: String,
    input: ContextInput,
) -> CommandResult<Context> {
    result(core.update_context(&id, input))
}
#[tauri::command]
fn archive_context(core: State<'_, Core>, id: String, archived: bool) -> CommandResult<()> {
    result(core.archive_context(&id, archived))
}
#[tauri::command]
fn delete_context(core: State<'_, Core>, id: String) -> CommandResult<()> {
    result(core.delete_context(&id))
}
#[tauri::command]
fn start_session(core: State<'_, Core>, context_id: String) -> CommandResult<Session> {
    result(core.start_session(&context_id))
}
#[tauri::command]
fn pause_session(core: State<'_, Core>, id: String) -> CommandResult<Session> {
    result(core.pause_session(&id))
}
#[tauri::command]
fn continue_session(core: State<'_, Core>, id: String) -> CommandResult<Session> {
    result(core.continue_session(&id))
}
#[tauri::command]
fn suspend_session(core: State<'_, Core>, id: String) -> CommandResult<Checkpoint> {
    result(core.suspend_session(&id))
}
#[tauri::command]
fn resume_context(core: State<'_, Core>, id: String) -> CommandResult<ResumeResult> {
    result(core.resume_context(&id))
}
#[tauri::command]
fn save_note(
    core: State<'_, Core>,
    context_id: String,
    id: Option<String>,
    body: String,
    pinned: bool,
) -> CommandResult<Note> {
    result(core.save_note(&context_id, id.as_deref(), &body, pinned))
}
#[tauri::command]
fn delete_note(core: State<'_, Core>, id: String) -> CommandResult<()> {
    result(core.delete_note(&id))
}
#[tauri::command]
fn save_settings(core: State<'_, Core>, settings: Settings) -> CommandResult<()> {
    result(core.save_settings(settings))
}
#[tauri::command]
fn search_memory(core: State<'_, Core>, query: String) -> CommandResult<Vec<SearchResult>> {
    result(core.search(&query))
}
#[tauri::command]
fn open_project_folder(core: State<'_, Core>, id: String) -> CommandResult<()> {
    let db = core.connection().map_err(|e| e.to_string())?;
    let context = result(crate::commands::get_context(&db, &id))?;
    drop(db);
    result(crate::restore::open_folder(&context.project_folder))
}
#[tauri::command]
fn get_tracking_error(core: State<'_, Core>) -> CommandResult<Option<String>> {
    core.tracking_error
        .lock()
        .map(|e| e.clone())
        .map_err(|_| "Tracking status unavailable".into())
}
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn")).init();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let path = app.path().app_data_dir()?.join("context-os.sqlite3");
            app.manage(Core::open(&path)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            create_context,
            update_context,
            archive_context,
            delete_context,
            start_session,
            pause_session,
            continue_session,
            suspend_session,
            resume_context,
            save_note,
            delete_note,
            save_settings,
            search_memory,
            open_project_folder,
            get_tracking_error
        ])
        .build(tauri::generate_context!())
        .expect("Unable to launch Context OS")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let core = app.state::<Core>();
                if let Ok(state) = core.state() {
                    if let Some(session) = state.sessions.iter().find(|s| s.status == "active") {
                        if core.pause_session(&session.id).is_err() {
                            log::warn!("Session could not be paused during exit");
                        }
                    }
                }
            }
        });
}
