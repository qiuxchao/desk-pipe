use serde_json::{json, Value};
use tauri::AppHandle;

use super::ai_utils::get_api_config;
use super::INode;

pub struct AgentNode;

#[async_trait::async_trait]
impl INode for AgentNode {
    fn node_type(&self) -> &str {
        "agent"
    }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let (api_base, api_key, model, _provider_type) = get_api_config(&config, app)?;

        let system_prompt = config
            .get("system_prompt")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let user_message = config
            .get("user_message")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                input
                    .get("result")
                    .and_then(|v| v.as_str())
                    .or_else(|| input.get("text").and_then(|v| v.as_str()))
                    .unwrap_or("")
                    .to_string()
            });
        let max_turns = config
            .get("max_turns")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<usize>().ok())
            .or_else(|| config.get("max_turns").and_then(|v| v.as_u64()).map(|n| n as usize))
            .unwrap_or(1);
        let continue_prompt = config
            .get("continue_prompt")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if user_message.is_empty() && system_prompt.is_empty() {
            return Err("Agent 需要系统提示或用户消息".into());
        }

        let mut messages: Vec<Value> = Vec::new();
        if !system_prompt.is_empty() {
            messages.push(json!({"role": "system", "content": system_prompt}));
        }
        if !user_message.is_empty() {
            messages.push(json!({"role": "user", "content": user_message}));
        }

        let mut last_response = String::new();
        let mut all_responses = Vec::new();

        for turn in 0..max_turns {
            let body = json!({
                "model": model,
                "messages": messages,
                "max_tokens": 4096,
            });
            let url = format!("{}/chat/completions", api_base.trim_end_matches('/'));
            let resp = reqwest::Client::new()
                .post(&url)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Agent 请求失败: {}", e))?;

            let status = resp.status();
            let text = resp
                .text()
                .await
                .map_err(|e| format!("读取响应失败: {}", e))?;
            if !status.is_success() {
                return Err(format!("API 错误 ({}): {}", status, text));
            }

            let json_resp: Value =
                serde_json::from_str(&text).map_err(|e| format!("解析失败: {}", e))?;
            let content = json_resp
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();

            messages.push(json!({"role": "assistant", "content": content}));
            last_response = content.clone();
            all_responses.push(content);

            // If more turns remain and continue_prompt is set, add it as next user message
            if turn < max_turns - 1 && !continue_prompt.is_empty() {
                messages.push(json!({"role": "user", "content": continue_prompt}));
            } else {
                break;
            }
        }

        Ok(json!({
            "result": last_response,
            "text": last_response,
            "turns": all_responses.len(),
            "all_responses": all_responses,
            "model": model,
        }))
    }
}
