use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

pub struct ScreenshotRegionNode;

static REGION_RESULT: std::sync::Mutex<Option<oneshot::Sender<Value>>> = std::sync::Mutex::new(None);

pub fn set_region_sender(sender: oneshot::Sender<Value>) {
    *REGION_RESULT.lock().unwrap() = Some(sender);
}

pub fn complete_region(result: Value) {
    if let Some(sender) = REGION_RESULT.lock().unwrap().take() {
        let _ = sender.send(result);
    }
}

#[async_trait::async_trait]
impl super::INode for ScreenshotRegionNode {
    fn node_type(&self) -> &str {
        "screenshot_region"
    }

    async fn execute(&self, _input: Value, _config: Value, app: &AppHandle) -> Result<Value, String> {
        let monitors = xcap::Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
        let monitor = monitors
            .into_iter()
            .find(|m| m.is_primary().unwrap_or(false))
            .or_else(|| xcap::Monitor::all().ok()?.into_iter().next())
            .ok_or("没有找到显示器")?;

        let full_image = monitor.capture_image().map_err(|e| format!("截图失败: {}", e))?;

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let full_path = std::env::temp_dir().join(format!("deskpipe_scr_full_{}.png", timestamp));
        full_image.save(&full_path).map_err(|e| format!("保存截图失败: {}", e))?;

        let (sender, receiver) = oneshot::channel::<Value>();
        set_region_sender(sender);

        let full_path_str = full_path.to_string_lossy().to_string();
        let label = "screenshot_overlay";

        if let Some(window) = app.get_webview_window(label) {
            let _ = window.close();
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }

        let _ = tauri::WebviewWindowBuilder::new(
            app, label, tauri::WebviewUrl::App("/screenshot.html".into()),
        )
        .title("")
        .fullscreen(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("创建截图窗口失败: {}", e))?;

        let path_for_event = full_path_str.clone();
        let app_clone = app.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
            // 用全局 emit 而不是 emit_to，避免 label 不匹配
            let _ = app_clone.emit("screenshot_data", json!({ "path": path_for_event }));
        });

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(120),
            receiver,
        )
        .await
        .map_err(|_| "截图超时".to_string())?
        .map_err(|_| "截图被取消".to_string())?;

        // Check if frontend already composited the image (with annotations)
        let has_annotations = result.get("has_annotations").and_then(|v| v.as_bool()).unwrap_or(false);

        if has_annotations {
            // Frontend already saved the annotated image — just return its path
            let path = result.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let w = result.get("width").and_then(|v| v.as_u64()).unwrap_or(0);
            let h = result.get("height").and_then(|v| v.as_u64()).unwrap_or(0);
            Ok(json!({ "path": path, "width": w, "height": h }))
        } else {
            // No annotations — crop from original screenshot
            let x = result.get("x").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let y = result.get("y").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let w = result.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let h = result.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

            let cropped = if w > 0 && h > 0 {
                image::DynamicImage::ImageRgba8(full_image).crop_imm(x, y, w, h)
            } else {
                image::DynamicImage::ImageRgba8(full_image)
            };

            let crop_path = std::env::temp_dir().join(format!("deskpipe_region_{}.png", timestamp));
            cropped.save(&crop_path).map_err(|e| format!("保存裁剪图失败: {}", e))?;

            Ok(json!({
                "path": crop_path.to_string_lossy(),
                "width": cropped.width(),
                "height": cropped.height(),
            }))
        }
    }
}
