use serde_json::json;
use tauri::{AppHandle, Emitter, Listener, Manager, WebviewUrl, WebviewWindowBuilder};

/// Create or show the image preview window
pub fn open_preview_window(app: &AppHandle, path: &str, title: &str) -> Result<(), String> {
    let label = "preview";

    // If window already exists, just send new data
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.emit("preview_set_data", json!({ "path": path, "title": title }));
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // Create new window
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("preview.html".into()))
        .title(format!("预览 - {}", title))
        .inner_size(800.0, 600.0)
        .min_inner_size(400.0, 300.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| format!("创建预览窗口失败: {}", e))?;

    // Send data after a short delay for window to load
    let path = path.to_string();
    let title = title.to_string();
    let window_clone = window.clone();
    window.once("page_loaded", move |_| {
        let _ = window_clone.emit("preview_set_data", json!({ "path": path, "title": title }));
    });

    Ok(())
}

/// Create or show the result dialog window
pub fn open_dialog_window(app: &AppHandle, title: &str, content: &str) -> Result<(), String> {
    let label = "dialog";

    if let Some(window) = app.get_webview_window(label) {
        let _ = window.emit("dialog_set_data", json!({ "title": title, "content": content }));
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("dialog.html".into()))
        .title(format!("结果 - {}", title))
        .inner_size(420.0, 400.0)
        .min_inner_size(320.0, 200.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("创建结果窗口失败: {}", e))?;

    let title = title.to_string();
    let content = content.to_string();
    let window_clone = window.clone();
    window.once("page_loaded", move |_| {
        let _ = window_clone.emit("dialog_set_data", json!({ "title": title, "content": content }));
    });

    Ok(())
}

/// Create or show the execution status window.
/// Returns `Some(true)` if a new window was created, `Some(false)` / `None` if it already existed.
pub fn open_status_window(app: &AppHandle) -> Result<Option<bool>, String> {
    let label = "status";

    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(None);
    }

    WebviewWindowBuilder::new(app, label, WebviewUrl::App("status.html".into()))
        .title("执行状态")
        .inner_size(320.0, 280.0)
        .min_inner_size(280.0, 200.0)
        .resizable(true)
        .always_on_top(true)
        .build()
        .map_err(|e| format!("创建状态窗口失败: {}", e))?;

    Ok(Some(true))
}

/// Close a child window by label
pub fn close_window(app: &AppHandle, label: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.close();
    }
    Ok(())
}
