use serde_json::{json, Value};
use tauri::AppHandle;

pub struct DelayNode;

#[async_trait::async_trait]
impl super::INode for DelayNode {
    fn node_type(&self) -> &str {
        "delay"
    }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let duration_ms = config
            .get("duration_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(1000);

        tokio::time::sleep(std::time::Duration::from_millis(duration_ms)).await;

        Ok(json!({
            "delayed_ms": duration_ms,
            "input": input,
        }))
    }
}
