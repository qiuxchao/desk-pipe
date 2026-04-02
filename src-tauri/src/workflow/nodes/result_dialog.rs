use serde_json::{json, Value};
use tauri::AppHandle;

pub struct ResultDialogNode;

#[async_trait::async_trait]
impl super::INode for ResultDialogNode {
    fn node_type(&self) -> &str {
        "result_dialog"
    }

    async fn execute(
        &self,
        input: Value,
        config: Value,
        app: &AppHandle,
    ) -> Result<Value, String> {
        let title = config
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("结果")
            .to_string();

        // Get content from config or upstream (try multiple fields)
        let config_content = config.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let content = if !config_content.is_empty() {
            config_content
        } else {
            // Try to extract meaningful text from upstream
            input.get("result").and_then(|v| v.as_str()).map(|s| s.to_string())
                .or_else(|| input.get("text").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .or_else(|| input.get("stdout").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .or_else(|| input.get("content").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .or_else(|| {
                    // If result is not a string, try to pretty-print it as JSON
                    input.get("result").map(|v| serde_json::to_string_pretty(v).unwrap_or_default())
                })
                .or_else(|| {
                    // Last resort: pretty-print the whole input
                    if input.is_object() || input.is_array() {
                        Some(serde_json::to_string_pretty(&input).unwrap_or_default())
                    } else {
                        None
                    }
                })
                .unwrap_or_default()
        };

        if content.is_empty() {
            return Err("没有可显示的内容".into());
        }

        // Open dedicated dialog window
        crate::window::open_dialog_window(app, &title, &content)?;

        Ok(json!({
            "result": content,
            "text": content,
            "title": title,
            "displayed": true,
        }))
    }
}
