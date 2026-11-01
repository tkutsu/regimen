use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[cfg(target_os = "android")]
#[path = "android.rs"]
mod store;
#[cfg(not(target_os = "android"))]
#[path = "files.rs"]
mod store;

/// Per-device settings, kept outside the synced folder. `dir` is a path on desktop
/// and a `content://` folder URI on Android.
#[derive(Serialize, Deserialize)]
struct Config {
    dir: String,
    device: String,
}

/// What a folder holds: whether it exists, the device logs in it, and whether
/// Syncthing shares it (unknown on Android).
#[derive(Serialize)]
struct Folder {
    exists: bool,
    logs: Vec<String>,
    synced: Option<bool>,
}

/// A file read from the folder.
#[derive(Deserialize)]
struct File {
    name: String,
    text: String,
}

/// A device's check-in, `devices/<name>.json`. Each device rewrites its own whenever
/// the app opens, so the others see where it keeps the folder and when it last synced.
#[derive(Serialize, Deserialize)]
struct Device {
    name: String,
    platform: String,
    dir: String,
    /// Unix seconds.
    seen: u64,
}

/// Everything the app shows, read from the folder.
#[derive(Serialize)]
struct Loaded {
    logs: Vec<String>,
    devices: Vec<Device>,
    synced: Option<bool>,
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

fn check_dir(dir: &str) -> Result<(), String> {
    let ok = if cfg!(target_os = "android") { dir.starts_with("content://") } else { PathBuf::from(dir).is_absolute() };
    if ok { Ok(()) } else { Err(format!("not a folder: {dir}")) }
}

/// The saved config, or nothing on first run. A config from before Android picked
/// folders holds a plain path, which counts as first run too.
#[tauri::command]
fn load_config(app: AppHandle) -> Option<Config> {
    let text = fs::read_to_string(config_path(&app).ok()?).ok()?;
    serde_json::from_str(&text).ok().filter(|config: &Config| check_dir(&config.dir).is_ok())
}

/// Where the setup screen starts: a Regimen folder Syncthing already brings here, or
/// one in Documents, and the machine's name. Android has no folder until one is picked.
#[tauri::command]
fn suggest_config(app: AppHandle) -> Config {
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Config { dir: String::new(), device: "phone".into() }
    }
    #[cfg(not(target_os = "android"))]
    {
        let documents = app.path().document_dir().or_else(|_| app.path().home_dir()).unwrap_or_default();
        let dir = store::find_shared().unwrap_or_else(|| documents.join("regimen").to_string_lossy().into());
        let host = fs::read_to_string("/etc/hostname").unwrap_or_default();
        let device = host.trim().split('.').next().filter(|name| !name.is_empty()).unwrap_or("desktop");
        Config { dir, device: device.into() }
    }
}

#[tauri::command]
fn save_config(app: AppHandle, config: Config) -> Result<(), String> {
    check_dir(&config.dir)?;
    check_device(&config.device)?;
    let path = config_path(&app)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(err)?;
    fs::write(path, serde_json::to_string_pretty(&config).map_err(err)?).map_err(err)
}

/// The system folder picker. Android only: desktop types a path.
#[tauri::command]
async fn pick_dir(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    return store::pick(&app).await;
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("no folder picker on desktop".into())
    }
}

/// Lets the setup screen say what's in a folder before it's chosen.
#[tauri::command]
async fn inspect_dir(app: AppHandle, dir: String) -> Result<Folder, String> {
    let synced = store::synced(&dir);
    let Some(names) = store::list(&app, &dir, "events").await? else {
        return Ok(Folder { exists: false, logs: vec![], synced });
    };
    // Syncthing conflict copies (`phone.sync-conflict-….jsonl`) are not devices.
    let logs = names.iter().filter_map(|name| name.strip_suffix(".jsonl")).filter(|stem| !stem.contains('.')).map(String::from).collect();
    Ok(Folder { exists: true, logs, synced })
}

/// Checks this device in, then reads every device's raw event log and check-in.
/// Parsing and merging the logs happen in the frontend.
#[tauri::command]
async fn load_folder(app: AppHandle, dir: String, device: String) -> Result<Loaded, String> {
    check_device(&device)?;
    let seen = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(err)?.as_secs();
    let me = Device { name: device.clone(), platform: store::PLATFORM.into(), dir: dir.clone(), seen };
    store::write(&app, &dir, "devices", &format!("{device}.json"), &serde_json::to_string(&me).map_err(err)?, false).await?;

    let logs = store::read(&app, &dir, "events", ".jsonl").await?.into_iter().map(|file| file.text).collect();
    let devices = store::read(&app, &dir, "devices", ".json")
        .await?
        .iter()
        .filter(|file| !file.name.trim_end_matches(".json").contains('.'))
        .filter_map(|file| serde_json::from_str(&file.text).ok())
        .collect();
    Ok(Loaded { logs, devices, synced: store::synced(&dir) })
}

/// Appends to this device's own log. No other device writes it, so Syncthing never conflicts.
#[tauri::command]
async fn append_events(app: AppHandle, dir: String, device: String, lines: Vec<String>) -> Result<(), String> {
    check_device(&device)?;
    let text: String = lines.iter().map(|line| format!("{line}\n")).collect();
    store::write(&app, &dir, "events", &format!("{device}.jsonl"), &text, true).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "android")]
    let builder = builder.plugin(store::plugin());
    builder
        .invoke_handler(tauri::generate_handler![load_config, suggest_config, save_config, pick_dir, inspect_dir, load_folder, append_events])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
