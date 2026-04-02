use serde_json::{json, Value};
use tauri::AppHandle;

pub struct SubWorkflowNode;

#[async_trait::async_trait]
impl super::INode for SubWorkflowNode {
    fn node_type(&self) -> &str {
        "sub_workflow"
    }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let workflow_id = config
            .get("workflow_id")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'workflow_id' in sub_workflow config")?
            .to_string();

        // SubWorkflow execution is handled by the executor.
        // This node just signals intent — the executor will load and run the sub workflow.
        Ok(json!({
            "sub_workflow_id": workflow_id,
            "input": input,
            "note": "Sub-workflow execution delegated to executor",
        }))
    }
}
