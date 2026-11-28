mod intent;
mod speech;

use std::sync::{Arc, Mutex};
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
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

#[cfg(target_os = "windows")]
unsafe extern "system" fn collect_chrome_window(
    hwnd: windows_sys::Win32::Foundation::HWND,
    state: windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::BOOL {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetWindowRect, IsIconic, IsWindowVisible,
    };

    let mut class_name = [0u16; 256];
    let class_len = unsafe { GetClassNameW(hwnd, class_name.as_mut_ptr(), class_name.len() as i32) };
    if class_len <= 0 {
        return 1;
    }
    let class_name = String::from_utf16_lossy(&class_name[..class_len as usize]);
    if class_name != "Chrome_WidgetWin_1" {
        return 1;
    }
    if unsafe { IsWindowVisible(hwnd) } == 0 || unsafe { IsIconic(hwnd) } != 0 {
        return 1;
    }

    let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
        return 1;
    }
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;
    if width <= 0 || height <= 0 {
        return 1;
    }

    let windows = unsafe { &mut *(state as *mut Vec<ChromeBounds>) };
    windows.push(ChromeBounds { x: rect.left, y: rect.top, width, height });
    1
}

#[tauri::command]
fn open_guidance_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let bounds = get_chrome_bounds()?;
    if let Some(existing) = app.get_webview_window("guidance") {
        let _ = existing.close();
    }

    let width = 460_i32;
    let height = 86_i32;
    let x = bounds.x + bounds.width - width - 24;
    let y = bounds.y + 78;

    let overlay = WebviewWindowBuilder::new(
        &app,
        "guidance",
        WebviewUrl::App("index.html".into()),
    )
    .title("TRACE Guidance")
    .inner_size(width as f64, height as f64)
    .position(x as f64, y as f64)
    .transparent(true)
    .decorations(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focused(false)
    .build()
    .map_err(|error| format!("Could not open TRACE guidance: {error}"))?;

    Ok(())
}

#[tauri::command]
async fn speak_guidance(text: String) -> Result<(), String> {
    let text = text.trim().to_owned();
    if text.is_empty() || text.len() > 400 {
        return Err("Guidance text must be between 1 and 400 characters.".into());
    }

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::{os::windows::process::CommandExt, process::Command};
            let escaped = text.replace('\'', "''");
            let script = format!(
                "Add-Type -AssemblyName System.Speech; $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voice.Speak('{}'); $voice.Dispose()",
                escaped
            );
            let result = Command::new("powershell.exe")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .creation_flags(0x08000000)
                .output()
                .map_err(|error| format!("Could not start Windows voice guidance: {error}"))?;
            if !result.status.success() {
                return Err("Windows could not play the guidance voice.".into());
            }
            Ok(())
        }
        #[cfg(not(target_os = "windows"))]
        {
            Err("Local voice guidance currently supports Windows only.".into())
        }
    })
    .await
    .map_err(|error| format!("Voice guidance task failed: {error}"))?
}

#[tauri::command]
fn close_guidance_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("guidance") {
        overlay.close().map_err(|error| format!("Could not close guidance: {error}"))?;
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn get_chrome_bounds() -> Result<ChromeBounds, String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::EnumWindows;

        let mut windows: Vec<ChromeBounds> = Vec::new();
        let state = &mut windows as *mut Vec<ChromeBounds> as isize;
        let completed = unsafe { EnumWindows(Some(collect_chrome_window), state) };
        if completed == 0 {
            return Err("Windows could not inspect the open application windows.".into());
        }

        windows
            .into_iter()
            .max_by_key(|window| i64::from(window.width) * i64::from(window.height))
            .ok_or_else(|| "I couldn't find a visible Google Chrome window. Make sure Chrome is open and restored, then try again.".into())
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
            get_chrome_bounds,
            open_guidance_overlay,
            close_guidance_overlay,
            speak_guidance
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
