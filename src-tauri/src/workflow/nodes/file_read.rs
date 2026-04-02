use serde_json::{json, Value};
use tauri::AppHandle;

pub struct FileReadNode;

#[async_trait::async_trait]
impl super::INode for FileReadNode {
    fn node_type(&self) -> &str {
        "file_read"
    }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let path = config
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'path' in file_read config")?
            .to_string();

        let content = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;

        Ok(json!({
            "content": content,
            "path": path,
            "size": content.len(),
        }))
    }
}
