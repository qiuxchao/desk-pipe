use serde_json::{json, Value};
use tauri::AppHandle;

pub struct TextProcessNode;

#[async_trait::async_trait]
impl super::INode for TextProcessNode {
    fn node_type(&self) -> &str { "text_process" }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let text = config.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let operation = config.get("operation").and_then(|v| v.as_str()).unwrap_or("trim");

        let result = match operation {
            "trim" => text.trim().to_string(),
            "uppercase" => text.to_uppercase(),
            "lowercase" => text.to_lowercase(),
            "split" => {
                let separator = config.get("separator").and_then(|v| v.as_str()).unwrap_or("\n");
                let parts: Vec<&str> = text.split(separator).collect();
                return Ok(json!({ "result": parts, "count": parts.len() }));
            }
            "join" => {
                let separator = config.get("separator").and_then(|v| v.as_str()).unwrap_or(",");
                // Try parse input as array
                if let Ok(arr) = serde_json::from_str::<Vec<String>>(&text) {
                    arr.join(separator)
                } else {
                    text.lines().collect::<Vec<&str>>().join(separator)
                }
            }
            "replace" => {
                let find = config.get("find").and_then(|v| v.as_str()).unwrap_or("");
                let replace_with = config.get("replace_with").and_then(|v| v.as_str()).unwrap_or("");
                text.replace(find, replace_with)
            }
            "regex_extract" => {
                let pattern = config.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
                if let Ok(re) = regex::Regex::new(pattern) {
                    let matches: Vec<String> = re.find_iter(&text).map(|m| m.as_str().to_string()).collect();
                    return Ok(json!({ "result": matches, "count": matches.len() }));
                } else {
                    return Err(format!("无效的正则表达式: {}", pattern));
                }
            }
            "line_count" => {
                let count = text.lines().count();
                return Ok(json!({ "result": count, "text": text }));
            }
            "char_count" => {
                let count = text.chars().count();
                return Ok(json!({ "result": count, "text": text }));
            }
            _ => text,
        };

        Ok(json!({ "result": result }))
    }
}
