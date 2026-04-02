use serde_json::{json, Value};
use tauri::AppHandle;

pub struct VariableGetNode;

#[async_trait::async_trait]
impl super::INode for VariableGetNode {
    fn node_type(&self) -> &str { "variable_get" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let key = config.get("key").and_then(|v| v.as_str()).unwrap_or("").to_string();

        // The executor injects the variable value as input
        let text = match &input {
            Value::String(s) => s.clone(),
            other => other.to_string(),
        };

        Ok(json!({
            "result": input,
            "text": text,
            "key": key,
        }))
    }
}
