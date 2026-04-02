use serde_json::{json, Value};
use tauri::AppHandle;

pub struct ImagePreviewNode;

#[async_trait::async_trait]
impl super::INode for ImagePreviewNode {
    fn node_type(&self) -> &str {
        "image_preview"
    }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let path = config
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("缺少图片路径")?
            .to_string();

        if !std::path::Path::new(&path).exists() {
            return Err(format!("图片文件不存在: {}", path));
        }

        let title = std::path::Path::new(&path)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "预览".to_string());

        // Open dedicated preview window
        crate::window::open_preview_window(app, &path, &title)?;

        Ok(json!({
            "previewed": true,
            "path": path,
        }))
    }
}
