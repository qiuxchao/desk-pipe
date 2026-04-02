use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

pub struct ClipboardReadNode;

#[async_trait::async_trait]
impl super::INode for ClipboardReadNode {
    fn node_type(&self) -> &str {
        "clipboard_read"
    }

    async fn execute(&self, _input: Value, _config: Value, app: &AppHandle) -> Result<Value, String> {
        let text = app
            .clipboard()
            .read_text()
            .map_err(|e| format!("Failed to read clipboard: {}", e))?;

        Ok(json!({
            "text": text,
        }))
    }
}
