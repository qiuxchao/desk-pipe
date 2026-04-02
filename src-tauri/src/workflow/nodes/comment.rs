use serde_json::Value;
use tauri::AppHandle;

pub struct CommentNode;

#[async_trait::async_trait]
impl super::INode for CommentNode {
    fn node_type(&self) -> &str { "comment" }
    async fn execute(&self, input: Value, _config: Value, _app: &AppHandle) -> Result<Value, String> {
        Ok(input) // Pass-through
    }
}
