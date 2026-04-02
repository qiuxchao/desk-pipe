use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub struct NotificationNode;

#[async_trait::async_trait]
impl super::INode for NotificationNode {
    fn node_type(&self) -> &str {
        "notification"
    }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let title = config
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("DeskPipe")
            .to_string();
        let body = config
            .get("body")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        app.notification()
            .builder()
            .title(&title)
            .body(&body)
            .show()
            .map_err(|e| format!("Failed to send notification: {}", e))?;

        Ok(json!({
            "notification_sent": true,
            "title": title,
            "body": body,
        }))
    }
}
