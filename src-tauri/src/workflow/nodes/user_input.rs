use async_trait::async_trait;
use serde_json::{json, Value};
#[allow(unused_imports)]
use tauri::AppHandle;

pub struct UserInputNode;

#[async_trait]
impl super::INode for UserInputNode {
    fn node_type(&self) -> &str { "user_input" }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let prompt_text = config.get("prompt").and_then(|v| v.as_str()).unwrap_or("请输入");
        let input_type = config.get("input_type").and_then(|v| v.as_str()).unwrap_or("text");
        let default_value = config.get("default_value").and_then(|v| v.as_str()).unwrap_or("");

        match input_type {
            "confirm" => {
                let script = format!(
                    "set choice to button returned of (display dialog \"{}\" buttons {{\"取消\", \"确定\"}} default button \"确定\" with title \"DeskPipe\")\nreturn choice",
                    prompt_text.replace('"', "\\\""),
                );
                let output = std::process::Command::new("osascript")
                    .arg("-e").arg(&script)
                    .output()
                    .map_err(|e| format!("显示确认对话框失败: {}", e))?;

                let result_text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let confirmed = output.status.success() && result_text == "确定";
                Ok(json!({
                    "result": confirmed,
                    "text": if confirmed { "是" } else { "否" },
                    "confirmed": confirmed,
                }))
            }
            _ => {
                // Text input via osascript dialog (Tauri doesn't have text input dialog)
                let script = format!(
                    "set result to text returned of (display dialog \"{}\" default answer \"{}\" with title \"DeskPipe\")\nreturn result",
                    prompt_text.replace('"', "\\\""),
                    default_value.replace('"', "\\\""),
                );
                let output = std::process::Command::new("osascript")
                    .arg("-e").arg(&script)
                    .output()
                    .map_err(|e| format!("显示输入对话框失败: {}", e))?;

                if !output.status.success() {
                    return Err("用户取消了输入".into());
                }

                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                Ok(json!({
                    "result": text,
                    "text": text,
                    "input_type": input_type,
                }))
            }
        }
    }
}
