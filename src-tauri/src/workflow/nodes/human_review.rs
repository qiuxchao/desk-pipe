use serde_json::{json, Value};
use tauri::AppHandle;

pub struct HumanReviewNode;

// Global channel for receiving approval responses
static APPROVAL_TX: std::sync::OnceLock<std::sync::Mutex<Option<tokio::sync::oneshot::Sender<String>>>> = std::sync::OnceLock::new();

pub fn get_approval_lock() -> &'static std::sync::Mutex<Option<tokio::sync::oneshot::Sender<String>>> {
    APPROVAL_TX.get_or_init(|| std::sync::Mutex::new(None))
}

pub fn send_approval(action: String) -> Result<(), String> {
    let mut lock = get_approval_lock().lock().map_err(|e| e.to_string())?;
    if let Some(tx) = lock.take() {
        tx.send(action).map_err(|_| "审批通道已关闭".to_string())?;
    }
    Ok(())
}

#[async_trait::async_trait]
impl super::INode for HumanReviewNode {
    fn node_type(&self) -> &str { "human_review" }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let title = config.get("title").and_then(|v| v.as_str()).unwrap_or("人工审核").to_string();
        let description = config.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let _actions_str = config.get("actions").and_then(|v| v.as_str()).unwrap_or("approve,reject");
        let timeout_secs = config.get("timeout_secs").and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok()).unwrap_or(300); // 5 min default

        // Create oneshot channel
        let (tx, rx) = tokio::sync::oneshot::channel::<String>();
        {
            let mut lock = get_approval_lock().lock().map_err(|e| e.to_string())?;
            *lock = Some(tx);
        }

        // Open approval window
        let content = if description.is_empty() {
            serde_json::to_string_pretty(&input).unwrap_or_default()
        } else {
            format!("{}\n\n数据:\n{}", description, serde_json::to_string_pretty(&input).unwrap_or_default())
        };
        crate::window::open_dialog_window(app, &title, &content)?;

        // Wait for response with timeout
        let action = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            rx,
        )
        .await
        .map_err(|_| format!("审批超时 ({}s)", timeout_secs))?
        .map_err(|_| "审批通道关闭".to_string())?;

        Ok(json!({
            "result": action,
            "action": action,
            "approved": action == "approve",
            "title": title,
        }))
    }
}
