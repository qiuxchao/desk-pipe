use async_trait::async_trait;
use serde_json::Value;
use tauri::AppHandle;
use regex::Regex;

pub struct RegexExtractNode;

#[async_trait]
impl super::INode for RegexExtractNode {
    fn node_type(&self) -> &str { "regex_extract" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let text = input.get("text")
            .or(input.get("stdout"))
            .or(input.get("content"))
            .or(input.get("result"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let pattern = config.get("pattern")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let extract_all = config.get("extract_all")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let re = Regex::new(pattern).map_err(|e| format!("正则表达式无效: {}", e))?;

        if extract_all {
            let matches: Vec<String> = re.find_iter(text).map(|m| m.as_str().to_string()).collect();
            Ok(serde_json::json!({
                "matches": matches,
                "count": matches.len(),
                "result": matches.join("\n"),
            }))
        } else {
            if let Some(caps) = re.captures(text) {
                let groups: Vec<String> = caps.iter()
                    .map(|m| m.map(|m| m.as_str().to_string()).unwrap_or_default())
                    .collect();
                Ok(serde_json::json!({
                    "match": groups.first().cloned().unwrap_or_default(),
                    "groups": groups,
                    "result": groups.first().cloned().unwrap_or_default(),
                }))
            } else {
                Ok(serde_json::json!({
                    "match": null,
                    "groups": [],
                    "result": "",
                }))
            }
        }
    }
}
