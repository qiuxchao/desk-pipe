use async_trait::async_trait;
use serde_json::{json, Value};
use tauri::AppHandle;
use std::process::Command;

pub struct KeyboardTypeNode;

#[async_trait]
impl super::INode for KeyboardTypeNode {
    fn node_type(&self) -> &str { "keyboard_type" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let action = config.get("action").and_then(|v| v.as_str()).unwrap_or("type_text");

        match action {
            "type_text" => {
                let text = config.get("text").and_then(|v| v.as_str())
                    .or(input.get("text").and_then(|v| v.as_str()))
                    .or(input.get("result").and_then(|v| v.as_str()))
                    .unwrap_or("");
                if text.is_empty() {
                    return Err("输入文本不能为空".into());
                }
                // Escape special characters for AppleScript
                let escaped = text.replace('\\', "\\\\").replace('"', "\\\"");
                let script = format!(
                    "tell application \"System Events\" to keystroke \"{}\"",
                    escaped
                );
                Command::new("osascript").arg("-e").arg(&script).output()
                    .map_err(|e| format!("模拟键盘输入失败: {}", e))?;
                Ok(json!({ "result": format!("已输入: {}", text), "typed": text, "action": "type_text" }))
            }
            "key_combo" => {
                // e.g., "command+c", "command+shift+s"
                let combo = config.get("key_combo").and_then(|v| v.as_str()).unwrap_or("");
                if combo.is_empty() {
                    return Err("快捷键不能为空".into());
                }

                let parts: Vec<&str> = combo.split('+').map(|s| s.trim()).collect();
                let key = parts.last().unwrap_or(&"");
                let modifiers: Vec<&str> = parts[..parts.len().saturating_sub(1)].to_vec();

                let mut modifier_str = String::new();
                for m in &modifiers {
                    match m.to_lowercase().as_str() {
                        "command" | "cmd" => modifier_str.push_str("command down, "),
                        "shift" => modifier_str.push_str("shift down, "),
                        "option" | "alt" => modifier_str.push_str("option down, "),
                        "control" | "ctrl" => modifier_str.push_str("control down, "),
                        _ => {}
                    }
                }
                let modifier_str = modifier_str.trim_end_matches(", ");

                let script = if modifier_str.is_empty() {
                    format!("tell application \"System Events\" to keystroke \"{}\"", key)
                } else {
                    format!("tell application \"System Events\" to keystroke \"{}\" using {{{}}}", key, modifier_str)
                };

                Command::new("osascript").arg("-e").arg(&script).output()
                    .map_err(|e| format!("发送快捷键失败: {}", e))?;
                Ok(json!({ "result": format!("已发送: {}", combo), "combo": combo, "action": "key_combo" }))
            }
            "key_code" => {
                // Send key codes (e.g., return=36, tab=48, escape=53)
                let key_code = config.get("key_code").and_then(|v| v.as_u64()).unwrap_or(0);
                let script = format!(
                    "tell application \"System Events\" to key code {}",
                    key_code
                );
                Command::new("osascript").arg("-e").arg(&script).output()
                    .map_err(|e| format!("发送按键代码失败: {}", e))?;
                Ok(json!({ "result": format!("已发送 key code: {}", key_code), "key_code": key_code, "action": "key_code" }))
            }
            _ => Err(format!("未知操作: {}", action)),
        }
    }
}
