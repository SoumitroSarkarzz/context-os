//! Explicit development seed; never called during application startup.
use context_os::{
    commands::Core,
    models::{ContextInput, TrackingPreferences},
};
use std::path::PathBuf;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let output = std::env::args().nth(1).ok_or(
        "Provide an EMPTY development data directory. This does not seed production automatically.",
    )?;
    let output = PathBuf::from(output);
    if output.exists() && std::fs::read_dir(&output)?.next().is_some() {
        return Err("The seed directory must be empty; existing data is never overwritten.".into());
    }
    std::fs::create_dir_all(&output)?;
    let core = Core::open(&output.join("data/context-os.sqlite3"))?;
    for (name, folder, icon, color, description) in [
        (
            "Blender — Gundam",
            "gundam",
            "box",
            "#b8ee80",
            "Chest materials and texture alignment",
        ),
        (
            "Horror Game",
            "horror-game",
            "braces",
            "#d0a5f7",
            "Enemy patrol routes and collision",
        ),
        (
            "Physics — Rotational Motion",
            "physics",
            "orbit",
            "#89b8f8",
            "Work, torque, and angular momentum",
        ),
        (
            "Minecraft Build",
            "minecraft",
            "layers",
            "#eab787",
            "A new world, one block at a time",
        ),
    ] {
        let project = output.join("projects").join(folder);
        std::fs::create_dir_all(&project)?;
        core.create_context(ContextInput {
            name: name.into(),
            description: description.into(),
            icon: icon.into(),
            accent: color.into(),
            project_folder: project.to_string_lossy().into(),
            tracking_preferences: TrackingPreferences::default(),
        })?;
    }
    println!("Created four development contexts with tracking disabled in {}. Production data was not changed.",output.display());
    Ok(())
}
