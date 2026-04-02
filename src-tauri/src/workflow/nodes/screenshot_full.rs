use serde_json::{json, Value};
use tauri::AppHandle;

pub struct ScreenshotFullNode;

#[async_trait::async_trait]
impl super::INode for ScreenshotFullNode {
    fn node_type(&self) -> &str {
        "screenshot_full"
    }

    async fn execute(&self, _input: Value, _config: Value, _app: &AppHandle) -> Result<Value, String> {
        let monitors = xcap::Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
        let monitor = monitors
            .into_iter()
            .find(|m| m.is_primary().unwrap_or(false))
            .or_else(|| xcap::Monitor::all().ok()?.into_iter().next())
            .ok_or("没有找到显示器")?;

        let image = monitor
            .capture_image()
            .map_err(|e| format!("截图失败: {}", e))?;

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let path = std::env::temp_dir().join(format!("deskpipe_screenshot_{}.png", timestamp));

        image
            .save(&path)
            .map_err(|e| format!("保存截图失败: {}", e))?;

        let path_str = path.to_string_lossy().to_string();

        Ok(json!({
            "path": path_str,
            "width": image.width(),
            "height": image.height(),
        }))
    }
}
