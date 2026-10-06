use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingPreferences {
    pub files: bool,
    #[serde(default = "default_exclusions")]
    pub exclusions: Vec<String>,
}
pub fn default_exclusions() -> Vec<String> {
    [
        ".git",
        "node_modules",
        "target",
        "dist",
        "build",
        ".cache",
        ".DS_Store",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}
impl Default for TrackingPreferences {
    fn default() -> Self {
        Self {
            files: false,
            exclusions: default_exclusions(),
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextInput {
    pub name: String,
    pub description: String,
    pub icon: String,
    pub accent: String,
    pub project_folder: String,
    pub tracking_preferences: TrackingPreferences,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Context {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub accent: String,
    pub project_folder: String,
    pub status: String,
    pub tracking_preferences: TrackingPreferences,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_active_at: Option<i64>,
    pub archived: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub context_id: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub paused_duration: i64,
    pub total_duration: i64,
    pub status: String,
    pub paused_at: Option<i64>,
    pub last_seen_at: i64,
    pub summary: String,
}
impl Session {
    pub fn elapsed(&self, now: i64) -> i64 {
        if self.status == "completed" {
            self.total_duration
        } else {
            ((self.paused_at.unwrap_or(now) - self.started_at) - self.paused_duration).max(0)
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub context_id: String,
    pub session_id: Option<String>,
    pub event_type: String,
    pub timestamp: i64,
    pub source: String,
    pub metadata: Value,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub context_id: String,
    pub session_id: Option<String>,
    pub body: String,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub context_id: String,
    pub session_id: String,
    pub timestamp: i64,
    pub duration: i64,
    pub summary: String,
    pub completed: Vec<String>,
    pub unfinished: Vec<String>,
    pub next_action: String,
    pub files: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub compact: bool,
    pub reopen_last: bool,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            compact: false,
            reopen_last: true,
        }
    }
}
#[derive(Debug, Clone, Serialize)]
pub struct AppState {
    pub contexts: Vec<Context>,
    pub sessions: Vec<Session>,
    pub events: Vec<Event>,
    pub notes: Vec<Note>,
    pub checkpoints: Vec<Checkpoint>,
    pub settings: Settings,
    pub event_count: i64,
    pub database_bytes: u64,
}
#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub context_id: String,
    pub kind: String,
    pub title: String,
    pub excerpt: String,
    pub timestamp: i64,
}
#[derive(Debug, Clone, Serialize)]
pub struct ResumeResult {
    pub session: Session,
    pub folder_opened: bool,
    pub warning: Option<String>,
}
