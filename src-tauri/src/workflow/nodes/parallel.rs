use serde_json::{json, Value};
use tauri::AppHandle;

pub struct ParallelNode;

#[async_trait::async_trait]
impl super::INode for ParallelNode {
    fn node_type(&self) -> &str { "parallel" }

    async fn execute(&self, input: Value, _config: Value, _app: &AppHandle) -> Result<Value, String> {
        // Pass-through node - the executor handles the parallel execution
        Ok(json!({
            "result": input,
            "is_parallel": true,
        }))
    }
}
