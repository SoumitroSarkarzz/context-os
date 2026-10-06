use crate::{privacy, Error, Result};
use std::{path::Path, process::Command};

pub(crate) fn folder_command(folder: &Path) -> Command {
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut command = Command::new("xdg-open");
    command.arg(folder);
    command
}
pub fn open_folder(path: &str) -> Result<()> {
    let folder = privacy::canonical_folder(path)?;
    match folder_command(&folder).status() {
        Ok(status) if status.success() => Ok(()),
        _ => Err(Error::Invalid("The folder could not be opened by your operating system. The session is still available.".into())),
    }
}
