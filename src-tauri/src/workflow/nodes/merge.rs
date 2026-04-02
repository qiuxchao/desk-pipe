use serde_json::{json, Value};
use tauri::AppHandle;

pub struct MergeNode;

#[async_trait::async_trait]
impl super::INode for MergeNode {
    fn node_type(&self) -> &str { "merge" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let merge_mode = config.get("merge_mode").and_then(|v| v.as_str()).unwrap_or("object");

        match merge_mode {
            "array" => {
                // Input should be an array of values from executor
                let items = if input.is_array() {
                    input.clone()
                } else {
                    json!([input])
                };
                let count = items.as_array().map(|a| a.len()).unwrap_or(0);
                Ok(json!({
                    "result": items,
                    "items": items,
                    "count": count,
                    "merge_mode": "array",
                }))
            }
            _ => {
                // "object" mode: merge all inputs into a single object
                let merged = if let Some(arr) = input.as_array() {
                    let mut obj = serde_json::Map::new();
                    for item in arr {
                        if let Some(item_obj) = item.as_object() {
                            for (k, v) in item_obj {
                                obj.insert(k.clone(), v.clone());
                            }
                        }
                    }
                    Value::Object(obj)
                } else {
                    input.clone()
                };
                Ok(json!({
                    "result": merged,
                    "merged": merged,
                    "merge_mode": "object",
                }))
            }
        }
    }
}
