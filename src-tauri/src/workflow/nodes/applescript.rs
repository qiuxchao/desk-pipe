use async_trait::async_trait;
use serde_json::{json, Value};
use tauri::AppHandle;
use std::process::Command;

pub struct AppleScriptNode;

#[async_trait]
impl super::INode for AppleScriptNode {
    fn node_type(&self) -> &str { "applescript" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let script = config.get("script").and_then(|v| v.as_str()).unwrap_or("");
        let script_type = config.get("script_type").and_then(|v| v.as_str()).unwrap_or("applescript");

        if script.is_empty() {
            return Err("脚本不能为空".into());
        }

        let output = if script_type == "jxa" {
            // JavaScript for Automation
            let input_json = serde_json::to_string(&input).unwrap_or("{}".into());
            let wrapped = format!("var input = {};\n{}", input_json, script);
            Command::new("osascript")
                .arg("-l").arg("JavaScript")
                .arg("-e").arg(&wrapped)
                .output()
                .map_err(|e| format!("执行 JXA 失败: {}", e))?
        } else {
            // Classic AppleScript
            Command::new("osascript")
                .arg("-e").arg(script)
                .output()
                .map_err(|e| format!("执行 AppleScript 失败: {}", e))?
        };

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if !output.status.success() {
            return Err(format!("脚本执行出错: {}", if stderr.is_empty() { &stdout } else { &stderr }));
        }

        Ok(json!({
            "result": stdout,
            "text": stdout,
            "stderr": stderr,
            "script_type": script_type,
        }))
    }
}
