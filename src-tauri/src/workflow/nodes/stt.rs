use serde_json::{json, Value};
use tauri::AppHandle;

pub struct SttNode;

#[async_trait::async_trait]
impl super::INode for SttNode {
    fn node_type(&self) -> &str { "stt" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let audio_path = config.get("audio_path").and_then(|v| v.as_str())
            .or_else(|| input.get("path").and_then(|v| v.as_str()))
            .or_else(|| input.get("result").and_then(|v| v.as_str()))
            .unwrap_or("").to_string();

        if audio_path.is_empty() || !std::path::Path::new(&audio_path).exists() {
            return Err("音频文件路径无效或文件不存在".into());
        }

        let api_base = config.get("api_base").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let api_key = config.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let model = config.get("model").and_then(|v| v.as_str()).unwrap_or("whisper-1").to_string();

        if api_base.is_empty() || api_key.is_empty() {
            return Err("请配置 API Base 和 API Key".into());
        }

        let file_bytes = std::fs::read(&audio_path)
            .map_err(|e| format!("读取音频文件失败: {}", e))?;

        let file_name = std::path::Path::new(&audio_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("audio.mp3")
            .to_string();

        let file_part = reqwest::multipart::Part::bytes(file_bytes)
            .file_name(file_name)
            .mime_str("audio/mpeg")
            .map_err(|e| format!("构建上传失败: {}", e))?;

        let form = reqwest::multipart::Form::new()
            .text("model", model)
            .part("file", file_part);

        let url = format!("{}/audio/transcriptions", api_base.trim_end_matches('/'));
        let resp = reqwest::Client::new()
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .multipart(form)
            .send().await.map_err(|e| format!("STT 请求失败: {}", e))?;

        let status = resp.status();
        let resp_text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
        if !status.is_success() {
            return Err(format!("STT API 错误 ({}): {}", status, resp_text));
        }

        let resp_json: Value = serde_json::from_str(&resp_text)
            .map_err(|e| format!("解析响应失败: {}", e))?;

        let text = resp_json.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let language = resp_json.get("language").and_then(|v| v.as_str()).unwrap_or("").to_string();

        Ok(json!({
            "result": text,
            "text": text,
            "language": language,
        }))
    }
}
