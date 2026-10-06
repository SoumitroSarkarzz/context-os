pub mod checkpoints;
pub mod commands;
pub mod db;
#[cfg(feature = "desktop")]
mod desktop;
pub mod models;
pub mod privacy;
pub mod restore;
pub mod search;
#[cfg(test)]
mod tests;
pub mod tracking;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Invalid(String),
    #[error("Local database operation failed: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Filesystem operation failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("Stored metadata could not be read: {0}")]
    Json(#[from] serde_json::Error),
}
pub type Result<T> = std::result::Result<T, Error>;
pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
pub fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
#[cfg(feature = "desktop")]
pub fn run() {
    desktop::run();
}
