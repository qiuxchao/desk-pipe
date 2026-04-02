use base64::Engine;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::ai_utils::{get_api_config, call_openai_compatible, call_claude};

/// Streaming OpenAI-compatible call: emits chunks via Tauri events
async fn call_openai_streaming(
    api_base: &str, api_key: &str, model: &str,
    prompt: &str, image_b64: Option<&str>,
    node_id: &str, app: &AppHandle,
) -> Result<String, String> {
    let mut content = vec![json!({"type": "text", "text": prompt})];
    if let Some(b64) = image_b64 {
        content.push(json!({"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{}", b64)}}));
    }
    let body = json!({"model": model, "messages": [{"role": "user", "content": content}], "max_tokens": 4096, "stream": true});
    let url = format!("{}/chat/completions", api_base.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send().await.map_err(|e| format!("AI 请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, text));
    }

    let mut accumulated = String::new();
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    let mut buffer = String::new();
    let mut done = false;
    'outer: while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("流读取失败: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        // Process complete SSE lines
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" { done = true; break 'outer; }
                if let Ok(parsed) = serde_json::from_str::<Value>(data) {
                    if let Some(delta) = parsed.get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"))
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        accumulated.push_str(delta);
                        let _ = app.emit("ai_stream_chunk", json!({
                            "node_id": node_id,
                            "chunk": delta,
                            "accumulated": &accumulated,
                        }));
                    }
                }
            }
        }
    }
    let _ = done;

    Ok(accumulated)
}

pub struct AiChatNode;

fn get_prompt(config: &Value) -> String {
    let action = config.get("action").and_then(|v| v.as_str()).unwrap_or("custom");
    match action {
        "ocr" => "请识别这张图片中的所有文字，只输出文字内容，不要添加额外的说明。".into(),
        "translate" => {
            let lang = config.get("target_language").and_then(|v| v.as_str()).unwrap_or("中文");
            format!("请将以下内容翻译成{}，只输出翻译结果：", lang)
        }
        "explain" => "请用中文解释这张图片的内容。".into(),
        "summarize" => "请用中文总结以下内容的要点：".into(),
        "rewrite" => "请改写以下内容，使其更加清晰流畅：".into(),
        "code_review" => "请审查以下代码，指出问题并给出改进建议：".into(),
        "extract" => {
            let what = config.get("extract_target").and_then(|v| v.as_str()).unwrap_or("关键信息");
            format!("请从以下内容中提取{}：", what)
        }
        _ => config.get("prompt").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    }
}

/// Structured output call: passes JSON Schema as response_format
async fn call_openai_structured(
    api_base: &str, api_key: &str, model: &str,
    prompt: &str, image_b64: Option<&str>, json_schema_str: &str,
) -> Result<String, String> {
    let schema: Value = serde_json::from_str(json_schema_str)
        .map_err(|e| format!("JSON Schema 解析失败: {}", e))?;

    let mut content = vec![json!({"type": "text", "text": prompt})];
    if let Some(b64) = image_b64 {
        content.push(json!({"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{}", b64)}}));
    }

    let body = json!({
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 4096,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "output",
                "schema": schema,
                "strict": true
            }
        }
    });

    let url = format!("{}/chat/completions", api_base.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send().await.map_err(|e| format!("AI 请求失败: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() { return Err(format!("API 错误 ({}): {}", status, text)); }

    let json: Value = serde_json::from_str(&text).map_err(|e| format!("解析失败: {}", e))?;
    json.get("choices").and_then(|c| c.get(0)).and_then(|c| c.get("message")).and_then(|m| m.get("content")).and_then(|c| c.as_str())
        .map(|s| s.to_string()).ok_or_else(|| format!("无法解析响应: {}", text))
}

fn read_image_base64(path: &str) -> Result<String, String> {
    use image::GenericImageView;

    let img = image::open(path).map_err(|e| format!("读取图片失败: {}", e))?;
    let (w, h) = img.dimensions();

    // Resize if larger than 1024px on longest side to save tokens
    let max_dim = 1024u32;
    let img = if w > max_dim || h > max_dim {
        let scale = max_dim as f64 / w.max(h) as f64;
        let nw = (w as f64 * scale) as u32;
        let nh = (h as f64 * scale) as u32;
        img.resize(nw, nh, image::imageops::FilterType::Triangle)
    } else {
        img
    };

    // Encode as JPEG (quality 85) for much smaller payload than PNG
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| format!("图片压缩失败: {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}

#[async_trait::async_trait]
impl super::INode for AiChatNode {
    fn node_type(&self) -> &str { "ai_chat" }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let (api_base, api_key, model, provider_type) = get_api_config(&config, app)?;

        let system_prompt = get_prompt(&config);

        // === Collect text input from multiple sources ===
        // 1. Config's "text" field (user-configured in the node)
        let config_text = config.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
        // 2. Upstream node's output (auto-extract text from various formats)
        let input_text = input.get("result").and_then(|v| v.as_str())
            .or(input.get("text").and_then(|v| v.as_str()))
            .or(input.get("stdout").and_then(|v| v.as_str()))
            .or(input.get("content").and_then(|v| v.as_str()))
            .unwrap_or("").to_string();

        // Combine: system_prompt + user text
        let user_text = if !config_text.is_empty() && !input_text.is_empty() {
            format!("{}\n\n{}", config_text, input_text)
        } else if !config_text.is_empty() {
            config_text
        } else {
            input_text
        };

        let has_user_text = !user_text.is_empty();

        let final_prompt = if !system_prompt.is_empty() && has_user_text {
            format!("{}\n\n{}", system_prompt, user_text)
        } else if !system_prompt.is_empty() {
            system_prompt
        } else if has_user_text {
            user_text
        } else {
            return Err("没有输入内容，请提供文本或图片".into());
        };

        // === Collect image input ===
        let image_path = config.get("image_path").and_then(|v| v.as_str()).unwrap_or("");
        let upstream_path = input.get("path").and_then(|v| v.as_str()).unwrap_or("");
        let effective_image_path = if !image_path.is_empty() { image_path } else { upstream_path };

        let image_b64 = if !effective_image_path.is_empty() && std::path::Path::new(effective_image_path).exists() {
            Some(read_image_base64(effective_image_path)?)
        } else {
            None
        };

        let input_mode = if image_b64.is_some() && has_user_text {
            "multimodal"
        } else if image_b64.is_some() {
            "vision"
        } else {
            "text"
        };

        let streaming = config.get("streaming").and_then(|v| v.as_bool()).unwrap_or(false);
        let node_id = config.get("__node_id").and_then(|v| v.as_str()).unwrap_or("");
        let use_structured = config.get("use_structured_output").and_then(|v| v.as_bool()).unwrap_or(false);
        let json_schema = config.get("json_schema").and_then(|v| v.as_str()).unwrap_or("");

        let result = if provider_type == "claude" {
            // Claude provider uses its own API format, not OpenAI-compatible streaming
            call_claude(&api_base, &api_key, &model, &final_prompt, image_b64.as_deref()).await?
        } else if streaming && !node_id.is_empty() {
            call_openai_streaming(&api_base, &api_key, &model, &final_prompt, image_b64.as_deref(), node_id, app).await?
        } else if use_structured && !json_schema.is_empty() {
            // Structured output mode: pass JSON Schema to API
            call_openai_structured(&api_base, &api_key, &model, &final_prompt, image_b64.as_deref(), json_schema).await?
        } else {
            call_openai_compatible(&api_base, &api_key, &model, &final_prompt, image_b64.as_deref()).await?
        };

        // Try to parse structured output
        let structured_output = if use_structured && !json_schema.is_empty() {
            serde_json::from_str::<Value>(&result).ok()
        } else {
            None
        };

        let mut output = json!({
            "result": if let Some(ref s) = structured_output { s.clone() } else { json!(result) },
            "text": result,
            "model": model,
            "provider": provider_type,
            "input_mode": input_mode,
            "streaming": streaming,
            "action": config.get("action").and_then(|v| v.as_str()).unwrap_or("custom"),
        });
        if let Some(so) = structured_output {
            output["structured_output"] = so;
        }
        Ok(output)
    }
}
