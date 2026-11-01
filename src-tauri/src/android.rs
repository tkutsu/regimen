//! The sync folder on Android: a `content://` folder the user picked, reached through
//! Android's document APIs so the app needs no storage permission. The file work is
//! in Kotlin (`FolderPlugin.kt`); these calls forward to it and mirror `files.rs`.

use crate::{File, err};
use serde_json::json;
use tauri::{
    AppHandle, Manager, Wry,
    plugin::{Builder, PluginHandle, TauriPlugin},
};

pub const PLATFORM: &str = "mobile";

struct Folder(PluginHandle<Wry>);

pub fn plugin() -> TauriPlugin<Wry> {
    Builder::new("folder")
        .setup(|app, api| {
            app.manage(Folder(api.register_android_plugin("dev.themos.regimen", "FolderPlugin")?));
            Ok(())
        })
        .build()
}

async fn call<T: serde::de::DeserializeOwned>(app: &AppHandle, command: &str, args: serde_json::Value) -> Result<T, String> {
    app.state::<Folder>().0.run_mobile_plugin_async(command, args).await.map_err(err)
}

/// Opens the system folder picker; none when cancelled.
pub async fn pick(app: &AppHandle) -> Result<Option<String>, String> {
    call(app, "pick", json!({})).await
}

/// A picked folder always exists, so this is never `None`.
pub async fn list(app: &AppHandle, dir: &str, sub: &str) -> Result<Option<Vec<String>>, String> {
    call(app, "list", json!({ "dir": dir, "sub": sub })).await.map(Some)
}

pub async fn read(app: &AppHandle, dir: &str, sub: &str, suffix: &str) -> Result<Vec<File>, String> {
    call(app, "read", json!({ "dir": dir, "sub": sub, "suffix": suffix })).await
}

pub async fn write(app: &AppHandle, dir: &str, sub: &str, name: &str, text: &str, append: bool) -> Result<(), String> {
    call(app, "write", json!({ "dir": dir, "sub": sub, "name": name, "text": text, "append": append })).await
}

pub async fn remove(app: &AppHandle, dir: &str, sub: &str, name: &str) -> Result<(), String> {
    call(app, "remove", json!({ "dir": dir, "sub": sub, "name": name })).await
}

/// A picked folder can't see its parents, so whether Syncthing shares it is unknown.
pub fn synced(_: &str) -> Option<bool> {
    None
}
