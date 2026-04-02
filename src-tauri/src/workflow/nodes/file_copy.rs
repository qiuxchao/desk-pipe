use serde_json::{json, Value};
use tauri::AppHandle;

pub struct FileCopyNode;

#[async_trait::async_trait]
impl super::INode for FileCopyNode {
    fn node_type(&self) -> &str {
        "file_copy"
    }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let source = config
            .get("source")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'source' in file_copy config")?
            .to_string();
        let destination = config
            .get("destination")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'destination' in file_copy config")?
            .to_string();

        let bytes_copied = tokio::fs::copy(&source, &destination)
            .await
            .map_err(|e| format!("Failed to copy '{}' to '{}': {}", source, destination, e))?;

        Ok(json!({
            "copied": true,
            "source": source,
            "destination": destination,
            "bytes": bytes_copied,
        }))
    }
}
