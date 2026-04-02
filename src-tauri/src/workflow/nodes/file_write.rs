use serde_json::{json, Value};
use tauri::AppHandle;

pub struct FileWriteNode;

#[async_trait::async_trait]
impl super::INode for FileWriteNode {
    fn node_type(&self) -> &str {
        "file_write"
    }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let path = config
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'path' in file_write config")?
            .to_string();
        let content = config
            .get("content")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'content' in file_write config")?
            .to_string();

        tokio::fs::write(&path, &content)
            .await
            .map_err(|e| format!("Failed to write file '{}': {}", path, e))?;

        Ok(json!({
            "written": true,
            "path": path,
            "size": content.len(),
        }))
    }
}
