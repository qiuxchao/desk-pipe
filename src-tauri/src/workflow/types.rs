use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub nodes: Vec<WorkflowNode>,
    pub edges: Vec<WorkflowEdge>,
    #[serde(default)]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub cron: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub data: serde_json::Value,
    #[serde(default)]
    pub meta: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowEdge {
    #[serde(rename = "sourceNodeID")]
    pub source_node_id: String,
    #[serde(rename = "targetNodeID")]
    pub target_node_id: String,
    #[serde(rename = "sourcePortID", default)]
    pub source_port_id: Option<String>,
    #[serde(rename = "targetPortID", default)]
    pub target_port_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowEvent {
    pub workflow_id: String,
    pub event_type: String,
    pub node_id: Option<String>,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
    #[serde(default)]
    pub timestamp: Option<f64>,
}
