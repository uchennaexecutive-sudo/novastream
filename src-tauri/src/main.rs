#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::StreamExt;
use tauri::ipc::Response;
use tauri::webview::NewWindowResponse;
use tauri::{Emitter, Manager, WebviewUrl};

const STREAM_CAPTURE_SCHEME: &str = "novastream-capture";
const STREAM_CAPTURE_SCRIPT: &str = r#"
(() => {
  if (window.__NOVA_STREAM_CAPTURE__) return;
  window.__NOVA_STREAM_CAPTURE__ = true;

  const patterns = [/\.m3u8(?:$|\?)/i, /\.mp4(?:$|\?)/i, /manifest/i, /playlist/i, /stream/i, /video/i];
  let reported = false;

  const matches = (value) => {
    const url = String(value || '');
    return url && patterns.some((pattern) => pattern.test(url));
  };

  const report = (value) => {
    const url = String(value || '');
    if (!matches(url) || reported) return;
    reported = true;
    window.location.replace('novastream-capture://stream?url=' + encodeURIComponent(url));
  };

  const scanPage = () => {
    try {
      performance.getEntriesByType('resource').forEach((entry) => report(entry.name));
    } catch (_) {}

    try {
      document.querySelectorAll('video, source').forEach((node) => {
        if (node.src) report(node.src);
        if (node.currentSrc) report(node.currentSrc);
      });
    } catch (_) {}
  };

  const wrapProperty = (prototype, property) => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
      if (!descriptor || !descriptor.set) return;

      Object.defineProperty(prototype, property, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
          report(value);
          return descriptor.set.call(this, value);
        }
      });
    } catch (_) {}
  };

  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function(input, init) {
      try {
        report(typeof input === 'string' ? input : input && input.url);
      } catch (_) {}

      return originalFetch.apply(this, arguments).then((response) => {
        try {
          report(response && response.url);
        } catch (_) {}
        return response;
      });
    };
  }

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    report(url);
    return originalXhrOpen.apply(this, arguments);
  };

  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (['src', 'data-src', 'href'].includes(String(name).toLowerCase())) {
      report(value);
    }
    return originalSetAttribute.apply(this, arguments);
  };

  if (typeof HTMLMediaElement !== 'undefined') {
    wrapProperty(HTMLMediaElement.prototype, 'src');
  }
  if (typeof HTMLSourceElement !== 'undefined') {
    wrapProperty(HTMLSourceElement.prototype, 'src');
  }
  if (typeof HTMLIFrameElement !== 'undefined') {
    wrapProperty(HTMLIFrameElement.prototype, 'src');
  }

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => report(entry.name));
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch (_) {}
  }

  window.addEventListener('load', scanPage);
  document.addEventListener('DOMContentLoaded', scanPage);
  setInterval(scanPage, 1000);
  scanPage();
})();
"#;

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
async fn fetch_hls_segment(url: String) -> Result<Response, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Referer", "https://hianime.to")
        .header("Origin", "https://hianime.to")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HLS fetch failed: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    Ok(Response::new(bytes.to_vec()))
}

fn capture_window_label() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("stream-capture-{timestamp}")
}

fn destroy_capture_window(app: &tauri::AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.close();
        let _ = window.destroy();
    }
}

fn handle_capture_navigation(
    app: &tauri::AppHandle,
    label: &str,
    capture_complete: &Arc<AtomicBool>,
    url: &reqwest::Url,
) -> bool {
    if url.scheme() != STREAM_CAPTURE_SCHEME {
        return true;
    }

    if capture_complete.swap(true, Ordering::SeqCst) {
        return false;
    }

    let stream_url = url
        .query_pairs()
        .find(|(key, _)| key == "url")
        .map(|(_, value)| value.into_owned());

    if let Some(stream_url) = stream_url {
        let _ = app.emit("stream-captured", stream_url);
    } else {
        let _ = app.emit("stream-capture-failed", ());
    }

    destroy_capture_window(app, label);
    false
}

fn create_capture_window(app: tauri::AppHandle, embed_url: String) -> Result<(), String> {
    let embed_url = reqwest::Url::parse(&embed_url).map_err(|e| e.to_string())?;
    let label = capture_window_label();
    let capture_complete = Arc::new(AtomicBool::new(false));
    let app_for_navigation = app.clone();
    let app_for_timeout = app.clone();
    let label_for_navigation = label.clone();
    let label_for_timeout = label.clone();
    let capture_for_navigation = capture_complete.clone();
    let capture_for_timeout = capture_complete.clone();

    tauri::WebviewWindowBuilder::new(&app, label.clone(), WebviewUrl::External(embed_url))
        .title("stream-capture")
        .visible(false)
        .focused(false)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(1.0, 1.0)
        .initialization_script_for_all_frames(STREAM_CAPTURE_SCRIPT)
        .on_navigation(move |url| {
            handle_capture_navigation(
                &app_for_navigation,
                &label_for_navigation,
                &capture_for_navigation,
                url,
            )
        })
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .build()
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(15)).await;

        if !capture_for_timeout.swap(true, Ordering::SeqCst) {
            let _ = app_for_timeout.emit("stream-capture-failed", ());
            destroy_capture_window(&app_for_timeout, &label_for_timeout);
        }
    });

    Ok(())
}

#[tauri::command]
async fn capture_stream(app: tauri::AppHandle, embed_url: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || create_capture_window(app, embed_url))
        .await
        .map_err(|e| e.to_string())??;

    Ok(())
}

fn append_updater_log(message: &str) {
    let log_path = env::temp_dir().join("nova-stream-updater.log");

    if let Ok(mut log_file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = writeln!(log_file, "[{timestamp}] {message}");
    }
}

#[tauri::command]
async fn download_update(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let current_exe = env::current_exe().map_err(|e| e.to_string())?;
    let update_dir = current_exe.parent().ok_or("No parent dir")?.join("_update");
    fs::create_dir_all(&update_dir).map_err(|e| e.to_string())?;
    let update_path = update_dir.join("nova-stream.exe");
    let temp_update_path = update_dir.join("nova-stream.exe.part");

    append_updater_log(&format!("download start url={} target={}", url, update_path.display()));

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .user_agent("NOVA STREAM Updater/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            append_updater_log(&format!("download request failed url={} error={e}", url));
            e.to_string()
        })?;

    if !response.status().is_success() {
        append_updater_log(&format!(
            "download failed url={} status={}",
            url,
            response.status()
        ));
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    append_updater_log(&format!(
        "download response status={} content_length={}",
        response.status(),
        total
    ));
    let mut downloaded: u64 = 0;
    let mut file_bytes: Vec<u8> = if total > 0 {
        Vec::with_capacity(total as usize)
    } else {
        Vec::new()
    };

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| {
            append_updater_log(&format!(
                "download stream failed url={} downloaded={} error={e}",
                url, downloaded
            ));
            e.to_string()
        })?;
        downloaded += chunk.len() as u64;
        file_bytes.extend_from_slice(&chunk);

        if total > 0 {
            let percent = (downloaded * 100 / total) as u8;
            let _ = app.emit("download-progress", percent);
        }
    }

    if total > 0 && downloaded != total {
        append_updater_log(&format!(
            "download size mismatch url={} expected={} actual={}",
            url, total, downloaded
        ));
        return Err("Download incomplete".to_string());
    }

    if downloaded < 1_000_000 {
        append_updater_log(&format!(
            "download too small url={} bytes={}",
            url, downloaded
        ));
        return Err("Downloaded file is unexpectedly small".to_string());
    }

    let _ = app.emit("download-progress", 100u8);

    tokio::fs::write(&temp_update_path, &file_bytes)
        .await
        .map_err(|e| {
            append_updater_log(&format!(
                "download write failed path={} error={e}",
                temp_update_path.display()
            ));
            e.to_string()
        })?;

    if update_path.exists() {
        let _ = fs::remove_file(&update_path);
    }

    tokio::fs::rename(&temp_update_path, &update_path)
        .await
        .map_err(|e| {
            append_updater_log(&format!(
                "download rename failed from={} to={} error={e}",
                temp_update_path.display(),
                update_path.display()
            ));
            e.to_string()
        })?;

    let file_size = fs::metadata(&update_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    append_updater_log(&format!(
        "download complete path={} bytes={}",
        update_path.display(),
        file_size
    ));

    Ok(update_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn apply_update() -> Result<(), String> {
    let current_exe = env::current_exe().map_err(|e| e.to_string())?;
    let current_path = current_exe.to_string_lossy().to_string();
    let update_exe = current_exe
        .parent().ok_or("No parent dir")?
        .join("_update")
        .join("nova-stream.exe");
    let update_path = update_exe.to_string_lossy().to_string();
    let updater_log_path = env::temp_dir().join("nova-stream-updater.log");

    append_updater_log(&format!(
        "apply start current={} update={}",
        current_path, update_path
    ));

    if !update_exe.exists() {
        append_updater_log("apply aborted: update file not found");
        return Err("Update file not found".to_string());
    }

    let batch_path = current_exe
        .parent().ok_or("No parent dir")?
        .join("_update.bat");

    let script = format!(
        "@echo off\r\n\
         echo [%date% %time%] apply script started >> \"{}\"\r\n\
         timeout /t 2 /nobreak >nul\r\n\
         copy /y \"{}\" \"{}\" >> \"{}\" 2>&1\r\n\
         if errorlevel 1 exit /b 1\r\n\
         echo [%date% %time%] copy succeeded >> \"{}\"\r\n\
         rmdir /s /q \"{}\" >nul 2>&1\r\n\
         echo [%date% %time%] cleanup complete >> \"{}\"\r\n\
         start \"\" \"{}\"\r\n\
         echo [%date% %time%] restart launched >> \"{}\"\r\n\
         del \"%~f0\" >nul 2>&1\r\n",
        updater_log_path.to_string_lossy(),
        update_path,
        current_path,
        updater_log_path.to_string_lossy(),
        updater_log_path.to_string_lossy(),
        current_exe.parent().unwrap().join("_update").to_string_lossy(),
        updater_log_path.to_string_lossy(),
        current_path,
        updater_log_path.to_string_lossy(),
    );

    fs::write(&batch_path, &script).map_err(|e| {
        append_updater_log(&format!("apply failed writing batch file error={e}"));
        e.to_string()
    })?;

    Command::new("cmd")
        .args(["/C", "start", "/min", "", &batch_path.to_string_lossy()])
        .spawn()
        .map_err(|e| {
            append_updater_log(&format!("apply failed launching batch file error={e}"));
            e.to_string()
        })?;

    append_updater_log(&format!(
        "apply launched batch file={}",
        batch_path.display()
    ));

    std::process::exit(0)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize,
            close_window,
            fetch_hls_segment,
            capture_stream,
            download_update,
            apply_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
