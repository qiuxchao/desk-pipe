use serde_json::{json, Value};
use tauri::AppHandle;

pub struct WebhookTriggerNode;

#[async_trait::async_trait]
impl super::INode for WebhookTriggerNode {
    fn node_type(&self) -> &str { "webhook_trigger" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let path = config.get("path").and_then(|v| v.as_str()).unwrap_or("/webhook").to_string();
        let method = config.get("method").and_then(|v| v.as_str()).unwrap_or("POST").to_string();

        Ok(json!({
            "result": input,
            "method": method,
            "path": path,
        }))
    }
}
