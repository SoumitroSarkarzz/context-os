use crate::{models::ContextInput, Error, Result};
use std::path::{Path, PathBuf};
pub fn canonical_folder(path: &str) -> Result<PathBuf> {
    if path.trim().is_empty() {
        return Err(Error::Invalid("Choose a project folder.".into()));
    }
    let folder = std::fs::canonicalize(path).map_err(|_| {
        Error::Invalid("Project folder is unavailable. Locate it before continuing.".into())
    })?;
    if !folder.is_dir() {
        return Err(Error::Invalid("The project path must be a folder.".into()));
    }
    if folder.parent().is_none() {
        return Err(Error::Invalid(
            "Choose a project folder rather than the entire filesystem.".into(),
        ));
    }
    std::fs::read_dir(&folder).map_err(|_| {
        Error::Invalid("Context OS cannot read this folder. Check its permissions.".into())
    })?;
    Ok(folder)
}
pub fn validate(input: &mut ContextInput) -> Result<()> {
    input.name = input.name.trim().to_string();
    if input.name.is_empty() || input.name.chars().count() > 100 {
        return Err(Error::Invalid(
            "Use a context name between 1 and 100 characters.".into(),
        ));
    }
    if input.description.len() > 4000 {
        return Err(Error::Invalid("Description is too long.".into()));
    }
    if input.accent.len() != 7
        || !input.accent.starts_with('#')
        || !input.accent[1..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err(Error::Invalid("Choose a valid accent color.".into()));
    }
    input.project_folder = canonical_folder(&input.project_folder)?
        .to_string_lossy()
        .into();
    input
        .tracking_preferences
        .exclusions
        .retain(|s| !s.trim().is_empty());
    if input.tracking_preferences.exclusions.len() > 100 {
        return Err(Error::Invalid("Use at most 100 exclusion names.".into()));
    }
    if input
        .tracking_preferences
        .exclusions
        .iter()
        .any(|s| s.contains('/') || s.contains('\\') || s == "..")
    {
        return Err(Error::Invalid(
            "Exclusions must be file or folder names, not paths.".into(),
        ));
    }
    Ok(())
}
pub fn allowed_path(root: &Path, path: &Path, exclusions: &[String]) -> bool {
    let Ok(relative) = path.strip_prefix(root) else {
        return false;
    };
    if relative.as_os_str().is_empty() {
        return false;
    }
    if relative.components().any(|c| {
        !matches!(c, std::path::Component::Normal(_))
            || exclusions
                .iter()
                .any(|s| c.as_os_str() == std::ffi::OsStr::new(s))
    }) {
        return false;
    }
    // Existing paths must stay within scope even if a symlink is encountered.
    if path.exists() {
        return path.canonicalize().is_ok_and(|p| p.starts_with(root));
    }
    let mut parent = path.parent();
    while let Some(p) = parent {
        if p.exists() {
            return p.canonicalize().is_ok_and(|v| v.starts_with(root));
        }
        parent = p.parent();
    }
    false
}
