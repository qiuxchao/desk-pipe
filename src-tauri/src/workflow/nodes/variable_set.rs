use serde_json::{json, Value};
use tauri::AppHandle;

pub struct VariableSetNode;

#[async_trait::async_trait]
impl super::INode for VariableSetNode {
    fn node_type(&self) -> &str { "variable_set" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let key = config.get("key").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if key.is_empty() {
            return Err("变量名不能为空".into());
        }

        // Value can come from config or from input
        let value = if let Some(v) = config.get("value") {
            if v.is_null() { input.clone() } else { v.clone() }
        } else {
            input.clone()
        };

        Ok(json!({
            "result": value,
            "key": key,
            "value": value,
        }))
    }
}
