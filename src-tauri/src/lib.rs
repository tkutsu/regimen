use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

/// Per-device settings, kept outside the synced folder.
#[derive(Serialize, Deserialize)]
struct Config {
    dir: PathBuf,
    device: String,
}

/// What a folder holds: whether it exists, and the device logs in it.
#[derive(Serialize)]
struct Folder {
    exists: bool,
    logs: Vec<String>,
}

fn err(e: impl ToString) -> String {
    e.to_string()
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(err)?.join("config.json"))
}

/// A device name becomes a file name, so it can't climb out of the events folder.
fn check_device(device: &str) -> Result<(), String> {
    if device.is_empty() || device.contains(['/', '\\', '.']) {
        return Err(format!("invalid device name: {device:?}"));
    }
    Ok(())
}

/// The saved config, or nothing on first run.
#[tauri::command]
fn load_config(app: AppHandle) -> Option<Config> {
    let text = fs::read_to_string(config_path(&app).ok()?).ok()?;
    serde_json::from_str(&text).ok()
}

/// Where the setup screen starts: a Documents folder and the machine's name.
#[tauri::command]
fn suggest_config(app: AppHandle) -> Config {
    if cfg!(target_os = "android") {
        return Config { dir: "/storage/emulated/0/Documents/regimen".into(), device: "phone".into() };
    }
    let documents = app.path().document_dir().or_else(|_| app.path().home_dir()).unwrap_or_default();
    let host = fs::read_to_string("/etc/hostname").unwrap_or_default();
    let device = host.trim().split('.').next().filter(|name| !name.is_empty()).unwrap_or("desktop");
    Config { dir: documents.join("regimen"), device: device.into() }
}

#[tauri::command]
fn save_config(app: AppHandle, config: Config) -> Result<(), String> {
    if !config.dir.is_absolute() {
        return Err(format!("not a full path: {}", config.dir.display()));
    }
    check_device(&config.device)?;
    let path = config_path(&app)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(err)?;
    fs::write(path, serde_json::to_string_pretty(&config).map_err(err)?).map_err(err)
}

/// The `.jsonl` logs in `<dir>/events`; none when the folder doesn't exist yet.
fn log_paths(dir: &Path) -> Result<Vec<PathBuf>, String> {
    match fs::read_dir(dir.join("events")) {
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(vec![]),
        Err(e) => Err(err(e)),
        Ok(entries) => Ok(entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "jsonl"))
            .collect()),
    }
}

/// Lets the setup screen say what's in a folder before it's chosen.
#[tauri::command]
fn inspect_dir(dir: PathBuf) -> Result<Folder, String> {
    match fs::metadata(&dir) {
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Folder { exists: false, logs: vec![] }),
        Err(e) => return Err(err(e)),
        Ok(meta) if !meta.is_dir() => return Err("not a folder".into()),
        Ok(_) => {}
    }
    // Syncthing conflict copies (`phone.sync-conflict-….jsonl`) are not devices.
    let logs = log_paths(&dir)?
        .iter()
        .filter_map(|path| path.file_stem()?.to_str().filter(|name| !name.contains('.')).map(String::from))
        .collect();
    Ok(Folder { exists: true, logs })
}

/// Every device's raw event log. Parsing and merging happen in the frontend.
#[tauri::command]
fn read_logs(dir: PathBuf) -> Result<Vec<String>, String> {
    log_paths(&dir)?.iter().map(|path| fs::read_to_string(path).map_err(err)).collect()
}

/// Appends to this device's own log. No other device writes it, so Syncthing never conflicts.
#[tauri::command]
fn append_events(dir: PathBuf, device: String, lines: Vec<String>) -> Result<(), String> {
    check_device(&device)?;
    let events = dir.join("events");
    fs::create_dir_all(&events).map_err(err)?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(events.join(format!("{device}.jsonl")))
        .map_err(err)?;
    let text: String = lines.iter().map(|line| format!("{line}\n")).collect();
    file.write_all(text.as_bytes()).map_err(err)?;
    file.sync_all().map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_config, suggest_config, save_config, inspect_dir, read_logs, append_events])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
