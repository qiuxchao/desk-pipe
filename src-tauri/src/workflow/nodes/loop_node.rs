use serde_json::{json, Value};
use tauri::AppHandle;

pub struct LoopNode;

#[async_trait::async_trait]
impl super::INode for LoopNode {
    fn node_type(&self) -> &str {
        "loop"
    }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        // Parse the array from config (already template-interpolated by executor)
        let items_str = config
            .get("items")
            .and_then(|v| v.as_str())
            .unwrap_or("[]");

        let items: Vec<Value> = if let Ok(arr) = serde_json::from_str::<Vec<Value>>(items_str) {
            arr
        } else if let Some(arr) = config.get("items").and_then(|v| v.as_array()) {
            arr.clone()
        } else {
            // Try splitting by newline/comma for simple string lists
            items_str
                .split(|c: char| c == '\n' || c == ',')
                .filter(|s| !s.trim().is_empty())
                .map(|s| Value::String(s.trim().to_string()))
                .collect()
        };

        // Loop node returns the array and metadata.
        // The executor handles the actual iteration by re-executing downstream nodes.
        Ok(json!({
            "items": items,
            "total": items.len(),
            "is_loop": true,
        }))
    }
}
