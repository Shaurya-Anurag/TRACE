mod intent;
mod speech;

use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use whisper_rs::WhisperContext;

fn encode_query(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(byte as char);
        } else if byte == b' ' {
            encoded.push('+');
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

#[tauri::command]
fn open_search(intent: String, query: String) -> Result<String, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("Please tell me what you would like to search for.".into());
    }
    let encoded = encode_query(query);
    let url = match intent.as_str() {
        "image_search" => format!("https://www.google.com/search?tbm=isch&q={encoded}"),
        "web_search" => format!("https://www.google.com/search?q={encoded}"),
        _ => return Err("I couldn't identify the type of search. Please try speaking again.".into()),
    };

    #[cfg(target_os = "windows")]
    {
        use std::{path::PathBuf, process::Command};
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Ok(value) = std::env::var("PROGRAMFILES") {
            candidates.push(PathBuf::from(value).join("Google/Chrome/Application/chrome.exe"));
        }
        if let Ok(value) = std::env::var("PROGRAMFILES(X86)") {
            candidates.push(PathBuf::from(value).join("Google/Chrome/Application/chrome.exe"));
        }
        if let Ok(value) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(value).join("Google/Chrome/Application/chrome.exe"));
        }
        if let Some(chrome) = candidates.iter().find(|path| path.is_file()) {
            Command::new(chrome).arg(&url).spawn()
                .map_err(|error| format!("I found Chrome but couldn't open it: {error}"))?;
        } else {
            return Err("I couldn't find Google Chrome on this device. Please install Chrome and try again.".into());
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("The first TRACE search workflow currently supports Windows with Google Chrome.".into());
    }
    Ok("Opening Google search in Chrome.".into())
}


#[derive(serde::Serialize)]
struct ChromeBounds {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[tauri::command]
fn get_chrome_bounds() -> Result<ChromeBounds, String> {
    #[cfg(target_os = "windows")]
    {
        use std::ptr;
        use windows_sys::Win32::Foundation::RECT;
        use windows_sys::Win32::UI::WindowsAndMessaging::{FindWindowW, GetWindowRect, IsWindowVisible};

        let class_name: Vec<u16> = "Chrome_WidgetWin_1\0".encode_utf16().collect();
        let hwnd = unsafe { FindWindowW(class_name.as_ptr(), ptr::null()) };
        if hwnd.is_null() {
            return Err("I can't see an open Google Chrome window yet. Open Chrome and try again.".into());
        }
        if unsafe { IsWindowVisible(hwnd) } == 0 {
            return Err("The Chrome window is not visible. Bring it to the front and try again.".into());
        }
        let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            return Err("Windows could not read the Chrome window position.".into());
        }
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return Err("Chrome appears to be minimised. Restore its window and try again.".into());
        }
        return Ok(ChromeBounds { x: rect.left, y: rect.top, width, height });
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Chrome window guidance currently supports Windows only.".into())
    }
}

struct AppSpeechEngine(Arc<Mutex<Option<WhisperContext>>>);

#[tauri::command]
async fn transcribe_audio(
    app: tauri::AppHandle,
    engine: State<'_, AppSpeechEngine>,
    samples: Vec<f32>,
) -> Result<String, String> {
    let engine = engine.0.clone();
    let model_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate TRACE's local data folder: {error}"))?
        .join("models");

    tauri::async_runtime::spawn_blocking(move || {
        speech::transcribe(&engine, &model_dir, samples)
    })
    .await
    .map_err(|error| format!("Speech recognition task failed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppSpeechEngine(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![
            transcribe_audio,
            intent::interpret_request,
            open_search,
            get_chrome_bounds
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
