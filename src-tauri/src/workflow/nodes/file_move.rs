use serde_json::{json, Value};
use tauri::AppHandle;

pub struct FileMoveNode;

#[async_trait::async_trait]
impl super::INode for FileMoveNode {
    fn node_type(&self) -> &str {
        "file_move"
    }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let source = config
            .get("source")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'source' in file_move config")?
            .to_string();
        let destination = config
            .get("destination")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'destination' in file_move config")?
            .to_string();

        tokio::fs::rename(&source, &destination)
            .await
            .map_err(|e| format!("Failed to move '{}' to '{}': {}", source, destination, e))?;

        Ok(json!({
            "moved": true,
            "source": source,
            "destination": destination,
        }))
    }
}
