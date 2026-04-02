use serde_json::{json, Value};
use tauri::AppHandle;

/// Resolve API config from node config.
/// Priority: provider_id (from global settings) > inline api_base/api_key/model
pub fn get_api_config(config: &Value, app: &AppHandle) -> Result<(String, String, String, String), String> {
    let provider_id = config.get("provider_id").and_then(|v| v.as_str()).unwrap_or("");

    if !provider_id.is_empty() {
        // Resolve from global provider settings
        if let Some(provider) = crate::settings::get_provider_by_id(app, provider_id) {
            let model = config.get("model").and_then(|v| v.as_str())
                .filter(|m| !m.is_empty())
                .unwrap_or(&provider.model)
                .to_string();
            log::info!("AI config: provider={} type={} base={} model={}", provider.name, provider.provider_type, provider.api_base, model);
            return Ok((provider.api_base, provider.api_key, model, provider.provider_type));
        }
        return Err(format!("找不到 AI 提供商「{}」，请在设置中检查。", provider_id));
    }

    // Fallback: try default provider
    if let Some(provider) = crate::settings::get_default_provider(app) {
        let model = config.get("model").and_then(|v| v.as_str())
            .filter(|m| !m.is_empty())
            .unwrap_or(&provider.model)
            .to_string();
        log::info!("AI config (default): provider={} type={} base={} model={}", provider.name, provider.provider_type, provider.api_base, model);
        return Ok((provider.api_base, provider.api_key, model, provider.provider_type));
    }

    // Last fallback: inline config (for backward compatibility)
    let api_base = config.get("api_base").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let api_key = config.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let model = config.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let provider_type = config.get("provider_type").and_then(|v| v.as_str()).unwrap_or("openai").to_string();

    if api_base.is_empty() || api_key.is_empty() || model.is_empty() {
        return Err("请先在设置中添加 AI 提供商，或在节点中选择一个提供商".into());
    }
    Ok((api_base, api_key, model, provider_type))
}

pub async fn call_openai_compatible(
    api_base: &str, api_key: &str, model: &str,
    prompt: &str, image_b64: Option<&str>,
) -> Result<String, String> {
    let mut content = vec![json!({"type": "text", "text": prompt})];
    if let Some(b64) = image_b64 {
        content.push(json!({"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{}", b64)}}));
    }
    let body = json!({"model": model, "messages": [{"role": "user", "content": content}], "max_tokens": 4096});
    let url = format!("{}/chat/completions", api_base.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send().await.map_err(|e| format!("AI 请求失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() { return Err(format!("API 错误 ({}) [{}]: {}", status, url, text)); }
    if text.trim().is_empty() { return Err(format!("API 返回空响应 [{}]，请检查 API Base URL 和 Key 是否正确", url)); }
    // Some APIs return SSE format (data: {...}) even for non-streaming requests — strip the prefix
    let json_text = if text.trim().starts_with("data:") {
        text.lines()
            .filter_map(|line| line.strip_prefix("data:").map(|s| s.trim()))
            .find(|s| s.starts_with('{'))
            .unwrap_or(text.trim())
    } else {
        text.trim()
    };
    let json: Value = serde_json::from_str(json_text).map_err(|e| format!("解析响应失败 [{}]: {} — 原始响应: {}", url, e, &text[..text.len().min(200)]))?;
    json.get("choices").and_then(|c| c.get(0)).and_then(|c| c.get("message")).and_then(|m| m.get("content")).and_then(|c| c.as_str())
        .map(|s| s.to_string()).ok_or_else(|| format!("响应格式异常 [{}]: {}", url, &text[..text.len().min(200)]))
}

pub async fn call_claude(
    api_base: &str, api_key: &str, model: &str,
    prompt: &str, image_b64: Option<&str>,
) -> Result<String, String> {
    let mut content: Vec<Value> = Vec::new();
    if let Some(b64) = image_b64 {
        content.push(json!({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}}));
    }
    content.push(json!({"type": "text", "text": prompt}));
    let body = json!({"model": model, "messages": [{"role": "user", "content": content}], "max_tokens": 4096});
    let url = format!("{}/messages", api_base.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send().await.map_err(|e| format!("Claude 请求失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() { return Err(format!("Claude 错误 ({}) [{}]: {}", status, url, text)); }
    if text.trim().is_empty() { return Err(format!("Claude 返回空响应 [{}]，请检查 API Base URL 和 Key 是否正确", url)); }
    let json: Value = serde_json::from_str(&text).map_err(|e| format!("解析响应失败 [{}]: {} — 原始响应: {}", url, e, &text[..text.len().min(200)]))?;
    json.get("content").and_then(|c| c.get(0)).and_then(|c| c.get("text")).and_then(|t| t.as_str())
        .map(|s| s.to_string()).ok_or_else(|| format!("响应格式异常 [{}]: {}", url, &text[..text.len().min(200)]))
}
