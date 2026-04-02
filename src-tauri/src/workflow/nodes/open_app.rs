use async_trait::async_trait;
use serde_json::{json, Value};
use tauri::AppHandle;
use std::process::Command;

pub struct OpenAppNode;

#[async_trait]
impl super::INode for OpenAppNode {
    fn node_type(&self) -> &str { "open_app" }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let app_name = config.get("app_name").and_then(|v| v.as_str()).unwrap_or("");
        let action = config.get("action").and_then(|v| v.as_str()).unwrap_or("open");
        let url = config.get("url").and_then(|v| v.as_str()).unwrap_or("");
        let file_path = config.get("file_path").and_then(|v| v.as_str()).unwrap_or("");

        match action {
            "open" => {
                if app_name.is_empty() {
                    return Err("应用名称不能为空".into());
                }
                Command::new("open")
                    .arg("-a").arg(app_name)
                    .output()
                    .map_err(|e| format!("启动应用失败: {}", e))?;
                Ok(json!({ "result": format!("已启动 {}", app_name), "app": app_name, "action": "open" }))
            }
            "open_url" => {
                if url.is_empty() {
                    return Err("URL 不能为空".into());
                }
                Command::new("open").arg(url).output()
                    .map_err(|e| format!("打开 URL 失败: {}", e))?;
                Ok(json!({ "result": format!("已打开 {}", url), "url": url, "action": "open_url" }))
            }
            "open_file" => {
                if file_path.is_empty() {
                    return Err("文件路径不能为空".into());
                }
                let mut cmd = Command::new("open");
                if !app_name.is_empty() {
                    cmd.arg("-a").arg(app_name);
                }
                cmd.arg(file_path);
                cmd.output().map_err(|e| format!("打开文件失败: {}", e))?;
                Ok(json!({ "result": format!("已打开 {}", file_path), "path": file_path, "action": "open_file" }))
            }
            "quit" => {
                if app_name.is_empty() {
                    return Err("应用名称不能为空".into());
                }
                // Use osascript to quit gracefully
                let script = format!("tell application \"{}\" to quit", app_name);
                Command::new("osascript").arg("-e").arg(&script).output()
                    .map_err(|e| format!("退出应用失败: {}", e))?;
                Ok(json!({ "result": format!("已退出 {}", app_name), "app": app_name, "action": "quit" }))
            }
            "focus" => {
                if app_name.is_empty() {
                    return Err("应用名称不能为空".into());
                }
                let script = format!("tell application \"{}\" to activate", app_name);
                Command::new("osascript").arg("-e").arg(&script).output()
                    .map_err(|e| format!("聚焦应用失败: {}", e))?;
                Ok(json!({ "result": format!("已聚焦 {}", app_name), "app": app_name, "action": "focus" }))
            }
            _ => Err(format!("未知操作: {}", action)),
        }
    }
}
