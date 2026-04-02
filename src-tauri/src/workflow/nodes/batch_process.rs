use serde_json::{json, Value};
use tauri::AppHandle;

pub struct BatchProcessNode;

#[async_trait::async_trait]
impl super::INode for BatchProcessNode {
    fn node_type(&self) -> &str { "batch_process" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        // Parse items from config or input
        let items = if let Some(cfg_items) = config.get("items") {
            if cfg_items.is_array() {
                cfg_items.clone()
            } else if let Some(s) = cfg_items.as_str() {
                // Try to parse as JSON array
                serde_json::from_str(s).unwrap_or(json!([s]))
            } else {
                json!([cfg_items])
            }
        } else if let Some(arr) = input.get("items").and_then(|v| v.as_array()) {
            Value::Array(arr.clone())
        } else if let Some(arr) = input.get("result").and_then(|v| v.as_array()) {
            Value::Array(arr.clone())
        } else if input.is_array() {
            input.clone()
        } else {
            json!([input])
        };

        let count = items.as_array().map(|a| a.len()).unwrap_or(0);
        let _concurrency = config.get("concurrency").and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .or_else(|| config.get("concurrency").and_then(|v| v.as_u64()))
            .unwrap_or(5);
        let error_mode = config.get("error_mode").and_then(|v| v.as_str()).unwrap_or("terminated");

        Ok(json!({
            "items": items,
            "total": count,
            "is_batch": true,
            "error_mode": error_mode,
            "concurrency": _concurrency,
        }))
    }
}
