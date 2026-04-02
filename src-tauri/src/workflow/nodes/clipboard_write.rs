use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

pub struct ClipboardWriteNode;

#[async_trait::async_trait]
impl super::INode for ClipboardWriteNode {
    fn node_type(&self) -> &str {
        "clipboard_write"
    }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let text = config
            .get("text")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'text' in clipboard_write config")?
            .to_string();

        app.clipboard()
            .write_text(&text)
            .map_err(|e| format!("Failed to write clipboard: {}", e))?;

        Ok(json!({
            "written": true,
            "text": text,
        }))
    }
}
