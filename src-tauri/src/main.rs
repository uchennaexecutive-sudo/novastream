#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::process::Command;

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    window.minimize().unwrap();
}

#[tauri::command]
fn toggle_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap() {
        window.unmaximize().unwrap();
    } else {
        window.maximize().unwrap();
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    window.close().unwrap();
}

#[tauri::command]
async fn download_update(url: String) -> Result<String, String> {
    let current_exe = env::current_exe().map_err(|e| e.to_string())?;
    let update_dir = current_exe.parent().ok_or("No parent dir")?.join("_update");

    // Create update directory
    fs::create_dir_all(&update_dir).map_err(|e| e.to_string())?;

    let update_path = update_dir.join("NOVA STREAM.exe");

    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    tokio::fs::write(&update_path, &bytes).await.map_err(|e| e.to_string())?;

    Ok(update_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn apply_update() -> Result<(), String> {
    let current_exe = env::current_exe().map_err(|e| e.to_string())?;
    let current_path = current_exe.to_string_lossy().to_string();
    let update_exe = current_exe
        .parent().ok_or("No parent dir")?
        .join("_update")
        .join("NOVA STREAM.exe");
    let update_path = update_exe.to_string_lossy().to_string();

    if !update_exe.exists() {
        return Err("Update file not found".to_string());
    }

    // Create a batch script that waits for the app to exit, then swaps the exe and relaunches
    let batch_path = current_exe
        .parent().ok_or("No parent dir")?
        .join("_update.bat");

    let script = format!(
        "@echo off\r\n\
         timeout /t 2 /nobreak >nul\r\n\
         copy /y \"{}\" \"{}\" >nul\r\n\
         rmdir /s /q \"{}\" >nul 2>&1\r\n\
         start \"\" \"{}\" \r\n\
         del \"%~f0\" >nul 2>&1\r\n",
        update_path,
        current_path,
        current_exe.parent().unwrap().join("_update").to_string_lossy(),
        current_path,
    );

    fs::write(&batch_path, &script).map_err(|e| e.to_string())?;

    // Launch the batch script detached
    Command::new("cmd")
        .args(["/C", "start", "/min", "", &batch_path.to_string_lossy()])
        .spawn()
        .map_err(|e| e.to_string())?;

    // Exit the app
    std::process::exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize,
            close_window,
            download_update,
            apply_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
