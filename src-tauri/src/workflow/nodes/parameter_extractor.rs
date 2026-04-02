use serde_json::{json, Value};
use tauri::AppHandle;

use super::ai_utils::{get_api_config, call_openai_compatible, call_claude};

pub struct ParameterExtractorNode;

#[async_trait::async_trait]
impl super::INode for ParameterExtractorNode {
    fn node_type(&self) -> &str { "parameter_extractor" }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let (api_base, api_key, model, provider_type) = get_api_config(&config, app)?;

        let schema_str = config.get("schema").and_then(|v| v.as_str()).unwrap_or("[]");
        let schema: Vec<Value> = serde_json::from_str(schema_str)
            .map_err(|e| format!("Schema 解析失败: {}", e))?;

        let text = config.get("text").and_then(|v| v.as_str())
            .or_else(|| input.get("result").and_then(|v| v.as_str()))
            .or_else(|| input.get("text").and_then(|v| v.as_str()))
            .unwrap_or("");

        if text.is_empty() { return Err("输入文本不能为空".into()); }

        // Build extraction prompt
        let fields_desc = schema.iter().map(|f| {
            format!("- {}: {} ({}{})",
                f.get("name").and_then(|v| v.as_str()).unwrap_or("unknown"),
                f.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                f.get("type").and_then(|v| v.as_str()).unwrap_or("string"),
                if f.get("required").and_then(|v| v.as_bool()).unwrap_or(false) { ", 必填" } else { "" }
            )
        }).collect::<Vec<_>>().join("\n");

        let prompt = format!(
            "从以下文本中提取指定字段。只输出 JSON 对象，不要其他内容。\n\n提取字段：\n{}\n\n文本：\n{}",
            fields_desc, text
        );

        let response = if provider_type == "claude" {
            call_claude(&api_base, &api_key, &model, &prompt, None).await?
        } else {
            call_openai_compatible(&api_base, &api_key, &model, &prompt, None).await?
        };

        // Try to parse response as JSON
        let extracted: Value = serde_json::from_str(response.trim())
            .or_else(|_| {
                // Try to find JSON in the response
                let json_re = regex::Regex::new(r"\{[\s\S]*\}").unwrap();
                if let Some(m) = json_re.find(&response) {
                    serde_json::from_str(m.as_str())
                } else {
                    Err(serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, "无法解析")))
                }
            })
            .unwrap_or(json!({"raw": response}));

        // Check which required fields are missing
        let missing: Vec<String> = schema.iter().filter_map(|f| {
            let name = f.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let required = f.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
            if required && extracted.get(name).is_none() {
                Some(name.to_string())
            } else {
                None
            }
        }).collect();

        Ok(json!({
            "result": extracted,
            "extracted": extracted,
            "raw_response": response,
            "valid": missing.is_empty(),
            "missing_fields": missing,
            "model": model,
        }))
    }
}
