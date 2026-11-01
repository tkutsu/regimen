//! The sync folder on desktop: a plain directory, read and written with std::fs.

use crate::{File, err};
use std::{
    fs,
    io::{ErrorKind, Write},
    path::Path,
};
use tauri::AppHandle;

pub const PLATFORM: &str = "desktop";

/// The file names in `<dir>/<sub>`, or none when `dir` doesn't exist yet.
pub async fn list(_: &AppHandle, dir: &str, sub: &str) -> Result<Option<Vec<String>>, String> {
    match fs::metadata(dir) {
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(err(e)),
        Ok(meta) if !meta.is_dir() => return Err("not a folder".into()),
        Ok(_) => {}
    }
    match fs::read_dir(Path::new(dir).join(sub)) {
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(Some(vec![])),
        Err(e) => Err(err(e)),
        Ok(entries) => Ok(Some(entries.filter_map(Result::ok).filter_map(|entry| entry.file_name().into_string().ok()).collect())),
    }
}

/// Every file in `<dir>/<sub>` whose name ends with `suffix`.
pub async fn read(app: &AppHandle, dir: &str, sub: &str, suffix: &str) -> Result<Vec<File>, String> {
    let path = Path::new(dir).join(sub);
    let names = list(app, dir, sub).await?.unwrap_or_default();
    names
        .into_iter()
        .filter(|name| name.ends_with(suffix))
        .map(|name| Ok(File { text: fs::read_to_string(path.join(&name)).map_err(err)?, name }))
        .collect()
}

/// Writes (or appends to) `<dir>/<sub>/<name>` and syncs it to disk, creating the folders.
pub async fn write(_: &AppHandle, dir: &str, sub: &str, name: &str, text: &str, append: bool) -> Result<(), String> {
    let path = Path::new(dir).join(sub);
    fs::create_dir_all(&path).map_err(err)?;
    let mut file = fs::OpenOptions::new().create(true).write(true).append(append).truncate(!append).open(path.join(name)).map_err(err)?;
    file.write_all(text.as_bytes()).map_err(err)?;
    file.sync_all().map_err(err)
}

/// Whether Syncthing shares the folder: it marks each shared folder with `.stfolder`.
pub fn synced(dir: &str) -> Option<bool> {
    Some(Path::new(dir).ancestors().any(|folder| folder.join(".stfolder").exists()))
}

/// The folders Syncthing shares on this machine, from its config.
fn syncthing_folders() -> Vec<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let config = ["/.local/state/syncthing/config.xml", "/.config/syncthing/config.xml"]
        .iter()
        .find_map(|path| fs::read_to_string(format!("{home}{path}")).ok())
        .unwrap_or_default();
    config
        .split("<folder ")
        .skip(1)
        .filter_map(|folder| folder.split("path=\"").nth(1)?.split('"').next())
        .filter(|path| !path.is_empty())
        .map(|path| path.replacen('~', &home, 1))
        .collect()
}

/// A `regimen` folder that Syncthing already brings here, so a second device joins the first.
pub fn find_shared() -> Option<String> {
    syncthing_folders().iter().map(|folder| Path::new(folder).join("regimen")).find(|dir| dir.join("events").is_dir()).map(|dir| dir.to_string_lossy().into())
}
