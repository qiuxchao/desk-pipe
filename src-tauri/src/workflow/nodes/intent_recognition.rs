use serde_json::{json, Value};
use tauri::AppHandle;

use super::ai_utils::{get_api_config, call_openai_compatible, call_claude};

pub struct IntentRecognitionNode;

#[async_trait::async_trait]
impl super::INode for IntentRecognitionNode {
    fn node_type(&self) -> &str { "intent_recognition" }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let (api_base, api_key, model, provider_type) = get_api_config(&config, app)?;

        let text = config.get("text").and_then(|v| v.as_str())
            .or_else(|| input.get("result").and_then(|v| v.as_str()))
            .or_else(|| input.get("text").and_then(|v| v.as_str()))
            .unwrap_or("").to_string();

        if text.is_empty() {
            return Err("意图识别的文本不能为空".into());
        }

        let intents = config.get("intents").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        if intents.is_empty() {
            return Err("请配置至少一个意图".into());
        }

        // Build intent descriptions for the prompt
        let intent_list: Vec<String> = intents.iter().map(|intent| {
            let name = intent.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
            let desc = intent.get("description").and_then(|v| v.as_str()).unwrap_or("");
            format!("- {}: {}", name, desc)
        }).collect();

        let intent_names: Vec<String> = intents.iter().map(|intent| {
            intent.get("name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string()
        }).collect();

        let prompt = format!(
            "请分析以下文本的意图，从给定的意图列表中选择最匹配的一个。\n\n\
             意图列表：\n{}\n\n\
             文本：{}\n\n\
             请只回复意图名称，不要包含其他内容。",
            intent_list.join("\n"), text
        );

        let result = if provider_type == "claude" {
            call_claude(&api_base, &api_key, &model, &prompt, None).await?
        } else {
            call_openai_compatible(&api_base, &api_key, &model, &prompt, None).await?
        };

        // Match the response to one of the intent names
        let result_trimmed = result.trim().to_string();
        let matched_intent = intent_names.iter()
            .find(|name| result_trimmed.contains(name.as_str()))
            .cloned()
            .unwrap_or_else(|| "default".to_string());

        Ok(json!({
            "result": matched_intent,
            "intent": matched_intent,
            "text": text,
            "raw_response": result_trimmed,
        }))
    }
}
