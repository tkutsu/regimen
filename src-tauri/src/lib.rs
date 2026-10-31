use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::PathBuf};
use tauri::{AppHandle, Manager};

/// Per-device settings, kept outside the synced folder.
#[derive(Serialize, Deserialize)]
struct Config {
    dir: PathBuf,
    device: String,
}

fn err(e: impl ToString) -> String {
    e.to_string()
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(err)?.join("config.json"))
}

fn default_config(app: &AppHandle) -> Config {
    if cfg!(target_os = "android") {
        Config { dir: "/storage/emulated/0/Sync/regimen".into(), device: "phone".into() }
    } else {
        let home = app.path().home_dir().unwrap_or_default();
        Config { dir: home.join("_shared/mobile/regimen"), device: "desktop".into() }
    }
}

#[tauri::command]
fn load_config(app: AppHandle) -> Config {
    config_path(&app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| default_config(&app))
}

#[tauri::command]
fn save_config(app: AppHandle, config: Config) -> Result<(), String> {
    let path = config_path(&app)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(err)?;
    fs::write(path, serde_json::to_string_pretty(&config).map_err(err)?).map_err(err)
}

/// Every device's raw event log. Parsing and merging happen in the frontend.
#[tauri::command]
fn read_logs(dir: PathBuf) -> Result<Vec<String>, String> {
    let Ok(entries) = fs::read_dir(dir.join("events")) else {
        return Ok(vec![]);
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "jsonl"))
        .map(|path| fs::read_to_string(path).map_err(err))
        .collect()
}

/// Appends to this device's own log. No other device writes it, so Syncthing never conflicts.
#[tauri::command]
fn append_events(dir: PathBuf, device: String, lines: Vec<String>) -> Result<(), String> {
    if device.is_empty() || device.contains(['/', '\\', '.']) {
        return Err(format!("invalid device name: {device:?}"));
    }
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
        .invoke_handler(tauri::generate_handler![load_config, save_config, read_logs, append_events])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
