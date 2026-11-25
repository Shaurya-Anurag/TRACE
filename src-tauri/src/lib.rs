use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn show_guidance_preview(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(overlay) = app.get_webview_window("guidance") {
    overlay.show().map_err(|error| error.to_string())?;
    overlay.set_focus().map_err(|error| error.to_string())?;
  } else {
    WebviewWindowBuilder::new(
      &app,
      "guidance",
      WebviewUrl::App("index.html".into()),
    )
    .title("TRACE guidance")
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .inner_size(560.0, 250.0)
    .center()
    .resizable(false)
    .focused(true)
    .shadow(false)
    .build()
    .map_err(|error| error.to_string())?;
  }

  if let Some(main) = app.get_webview_window("main") {
    main.hide().map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[tauri::command]
fn close_guidance_preview(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(overlay) = app.get_webview_window("guidance") {
    overlay.close().map_err(|error| error.to_string())?;
  }
  if let Some(main) = app.get_webview_window("main") {
    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      show_guidance_preview,
      close_guidance_preview
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
