#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, Response, StatusCode},
    routing::any,
    Router,
};
use futures_util::StreamExt;
use percent_encoding::{percent_decode_str, utf8_percent_encode, NON_ALPHANUMERIC};
use serde::Deserialize;
use tauri::webview::NewWindowResponse;
use tauri::{Emitter, Manager, WebviewUrl};
use tower_http::cors::CorsLayer;
use url::Url;

const STREAM_CAPTURE_SCHEME: &str = "novastream-capture";
const HLS_PROXY_BIND_ADDRESS: &str = "127.0.0.1:9876";
const HLS_PROXY_BASE_URL: &str = "http://localhost:9876/proxy";
const HLS_REFERER: &str = "https://hianime.to";
const HLS_ORIGIN: &str = "https://hianime.to";
const HLS_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
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

#[derive(Clone)]
struct HlsProxyState {
    client: reqwest::Client,
    log_path: PathBuf,
}

#[derive(Deserialize)]
struct ProxyQuery {
    url: String,
    headers: Option<String>,
}

type ProxyHeaders = HashMap<String, String>;

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
fn proxy_hls_url(url: String, headers: Option<ProxyHeaders>) -> String {
    let mut proxy_url = format!(
        "{HLS_PROXY_BASE_URL}?url={}",
        utf8_percent_encode(&url, NON_ALPHANUMERIC)
    );

    if let Some(headers) = headers.filter(|headers| !headers.is_empty()) {
        if let Ok(headers_json) = serde_json::to_string(&headers) {
            proxy_url.push_str("&headers=");
            proxy_url.push_str(&utf8_percent_encode(&headers_json, NON_ALPHANUMERIC).to_string());
        }
    }

    proxy_url
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

fn parse_proxy_target(url: &str) -> Result<Url, String> {
    Url::parse(url).or_else(|_| {
        let decoded = percent_decode_str(url).decode_utf8_lossy();
        Url::parse(&decoded)
    })
    .map_err(|e| format!("Invalid proxy URL: {e}"))
}

fn encode_proxy_headers(headers: &ProxyHeaders) -> Option<String> {
    if headers.is_empty() {
        return None;
    }

    serde_json::to_string(headers)
        .ok()
        .map(|headers_json| utf8_percent_encode(&headers_json, NON_ALPHANUMERIC).to_string())
}

fn parse_proxy_headers(headers: Option<&str>) -> ProxyHeaders {
    let Some(headers) = headers else {
        return ProxyHeaders::new();
    };

    let decoded = percent_decode_str(headers).decode_utf8_lossy();
    serde_json::from_str::<ProxyHeaders>(&decoded).unwrap_or_default()
}

fn proxy_url_for(url: &Url, headers: &ProxyHeaders) -> String {
    let mut proxy_url = format!(
        "{HLS_PROXY_BASE_URL}?url={}",
        utf8_percent_encode(url.as_str(), NON_ALPHANUMERIC)
    );

    if let Some(encoded_headers) = encode_proxy_headers(headers) {
        proxy_url.push_str("&headers=");
        proxy_url.push_str(&encoded_headers);
    }

    proxy_url
}

fn resolve_target_url(reference: &str, base_url: &Url) -> Option<Url> {
    if reference.starts_with("http://") || reference.starts_with("https://") {
        Url::parse(reference).ok()
    } else {
        base_url.join(reference).ok()
    }
}

fn rewrite_uri_attributes(line: &str, base_url: &Url, headers: &ProxyHeaders) -> String {
    let mut output = String::new();
    let mut remaining = line;

    while let Some(start) = remaining.find("URI=\"") {
        let prefix = &remaining[..start];
        output.push_str(prefix);
        output.push_str("URI=\"");

        let after_prefix = &remaining[start + 5..];
        if let Some(end) = after_prefix.find('"') {
            let raw_uri = &after_prefix[..end];
            let rewritten = resolve_target_url(raw_uri, base_url)
                .map(|url| proxy_url_for(&url, headers))
                .unwrap_or_else(|| raw_uri.to_string());
            output.push_str(&rewritten);
            output.push('"');
            remaining = &after_prefix[end + 1..];
        } else {
            output.push_str(after_prefix);
            remaining = "";
            break;
        }
    }

    output.push_str(remaining);
    output
}

fn rewrite_playlist_line(line: &str, base_url: &Url, headers: &ProxyHeaders) -> String {
    let trimmed = line.trim();

    if trimmed.is_empty() {
        return line.to_string();
    }

    if trimmed.starts_with('#') {
        return rewrite_uri_attributes(line, base_url, headers);
    }

    resolve_target_url(trimmed, base_url)
        .map(|url| proxy_url_for(&url, headers))
        .unwrap_or_else(|| line.to_string())
}

fn rewrite_playlist(body: &str, base_url: &Url, headers: &ProxyHeaders) -> String {
    body.lines()
        .map(|line| rewrite_playlist_line(line, base_url, headers))
        .collect::<Vec<_>>()
        .join("\n")
}

fn is_playlist_response(url: &Url, content_type: &str) -> bool {
    let content_type = content_type.to_ascii_lowercase();
    content_type.contains("mpegurl")
        || content_type.contains("x-mpegurl")
        || url.path().ends_with(".m3u8")
}

fn append_hls_proxy_log(log_path: &PathBuf, message: &str) {
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

fn apply_proxy_response_headers(headers: &mut HeaderMap) {
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET,HEAD,OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("*"),
    );
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static(
            "accept-ranges,cache-control,content-length,content-range,content-type,etag,last-modified",
        ),
    );
}

fn copy_upstream_headers(upstream_headers: &HeaderMap, proxy_headers: &mut HeaderMap) {
    let headers_to_copy = [
        header::CONTENT_TYPE,
        header::CONTENT_LENGTH,
        header::CONTENT_RANGE,
        header::CONTENT_DISPOSITION,
        header::ACCEPT_RANGES,
        header::CACHE_CONTROL,
        header::ETAG,
        header::EXPIRES,
        header::LAST_MODIFIED,
    ];

    for header_name in headers_to_copy {
        if let Some(value) = upstream_headers.get(&header_name) {
            proxy_headers.insert(header_name, value.clone());
        }
    }
}

fn apply_upstream_headers(
    mut request: reqwest::RequestBuilder,
    proxy_headers: &ProxyHeaders,
    request_headers: &HeaderMap,
) -> reqwest::RequestBuilder {
    request = request
        .header(header::REFERER, HLS_REFERER)
        .header(header::ORIGIN, HLS_ORIGIN)
        .header(header::USER_AGENT, HLS_USER_AGENT)
        .header(header::ACCEPT, "*/*")
        .header(header::ACCEPT_LANGUAGE, "en-US,en;q=0.9");

    for passthrough_header in [
        header::RANGE,
        header::IF_NONE_MATCH,
        header::IF_MODIFIED_SINCE,
    ] {
        if let Some(value) = request_headers.get(&passthrough_header) {
            request = request.header(passthrough_header, value.clone());
        }
    }

    for (key, value) in proxy_headers {
        let Ok(header_name) = HeaderName::from_bytes(key.as_bytes()) else {
            continue;
        };
        let Ok(header_value) = HeaderValue::from_str(value) else {
            continue;
        };
        request = request.header(header_name, header_value);
    }

    request
}

async fn handle_hls_proxy(
    State(state): State<HlsProxyState>,
    method: Method,
    headers: HeaderMap,
    Query(query): Query<ProxyQuery>,
) -> Result<Response<Body>, (StatusCode, String)> {
    let target_url =
        parse_proxy_target(&query.url).map_err(|error| (StatusCode::BAD_REQUEST, error))?;
    let proxy_headers = parse_proxy_headers(query.headers.as_deref());
    let proxy_kind = target_url
        .path_segments()
        .and_then(|segments| segments.last())
        .unwrap_or("unknown");

    append_hls_proxy_log(
        &state.log_path,
        &format!(
            "REQ method={} target={} range={} headers={:?}",
            method,
            target_url,
            headers
                .get(header::RANGE)
                .and_then(|value| value.to_str().ok())
                .unwrap_or("-"),
            proxy_headers
        ),
    );

    let request = apply_upstream_headers(
        state.client.request(method.clone(), target_url.clone()),
        &proxy_headers,
        &headers,
    );

    let response = request
        .send()
        .await
        .map_err(|error| {
            append_hls_proxy_log(
                &state.log_path,
                &format!("ERR request target={} error={error}", target_url),
            );
            (StatusCode::BAD_GATEWAY, error.to_string())
        })?;

    let upstream_status = response.status();
    let upstream_headers = response.headers().clone();
    let content_type = upstream_headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let is_playlist = is_playlist_response(&target_url, &content_type);

    append_hls_proxy_log(
        &state.log_path,
        &format!(
            "RES method={} kind={} playlist={} status={} content_type={} length={} final_url={}",
            method,
            proxy_kind,
            is_playlist,
            upstream_status,
            content_type,
            upstream_headers
                .get(header::CONTENT_LENGTH)
                .and_then(|value| value.to_str().ok())
                .unwrap_or("-"),
            response.url()
        ),
    );

    if method == Method::HEAD {
        let mut proxy_response = Response::new(Body::empty());
        *proxy_response.status_mut() = upstream_status;
        copy_upstream_headers(&upstream_headers, proxy_response.headers_mut());
        apply_proxy_response_headers(proxy_response.headers_mut());
        return Ok(proxy_response);
    }

    if is_playlist {
        let playlist = response
            .text()
            .await
            .map_err(|error| {
                append_hls_proxy_log(
                    &state.log_path,
                    &format!("ERR playlist-read target={} error={error}", target_url),
                );
                (StatusCode::BAD_GATEWAY, error.to_string())
            })?;
        let rewritten_playlist = rewrite_playlist(&playlist, &target_url, &proxy_headers);

        let mut proxy_response = Response::new(Body::from(rewritten_playlist));
        *proxy_response.status_mut() = upstream_status;
        proxy_response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/vnd.apple.mpegurl"),
        );
        proxy_response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-store"),
        );
        apply_proxy_response_headers(proxy_response.headers_mut());
        return Ok(proxy_response);
    }

    let stream = response.bytes_stream().map(|chunk| {
        chunk.map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error.to_string()))
    });
    let mut proxy_response = Response::new(Body::from_stream(stream));
    *proxy_response.status_mut() = upstream_status;
    copy_upstream_headers(&upstream_headers, proxy_response.headers_mut());
    apply_proxy_response_headers(proxy_response.headers_mut());

    Ok(proxy_response)
}

async fn start_hls_proxy() -> Result<(), String> {
    let log_path = env::temp_dir().join("nova-stream-hls-proxy.log");
    append_hls_proxy_log(&log_path, "HLS proxy starting");

    let client = reqwest::Client::builder()
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let app = Router::new()
        .route("/proxy", any(handle_hls_proxy))
        .with_state(HlsProxyState { client, log_path })
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(HLS_PROXY_BIND_ADDRESS)
        .await
        .map_err(|e| e.to_string())?;

    axum::serve(listener, app)
        .await
        .map_err(|e| e.to_string())
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
    tauri::async_runtime::spawn(async {
        if let Err(error) = start_hls_proxy().await {
            eprintln!("HLS proxy failed: {error}");
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize,
            close_window,
            proxy_hls_url,
            capture_stream,
            download_update,
            apply_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
