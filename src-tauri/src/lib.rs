mod speech;

use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use whisper_rs::WhisperContext;

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
        .invoke_handler(tauri::generate_handler![transcribe_audio])
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
