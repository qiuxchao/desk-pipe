use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::Manager;

pub struct TtsNode;

#[async_trait::async_trait]
impl super::INode for TtsNode {
    fn node_type(&self) -> &str { "tts" }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let engine = config.get("engine").and_then(|v| v.as_str()).unwrap_or("openai").to_string();

        let text = config.get("text").and_then(|v| v.as_str())
            .or_else(|| input.get("result").and_then(|v| v.as_str()))
            .or_else(|| input.get("text").and_then(|v| v.as_str()))
            .unwrap_or("").to_string();

        if text.is_empty() {
            return Err("TTS 文本不能为空".into());
        }

        let temp_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp"));
        let _ = std::fs::create_dir_all(&temp_dir);

        let path = match engine.as_str() {
            "local" => {
                // macOS say command
                let voice = config.get("voice").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let filename = format!("tts_{}.aiff", uuid::Uuid::new_v4());
                let output_path = temp_dir.join(&filename);
                let path_str = output_path.to_string_lossy().to_string();

                let mut cmd = tokio::process::Command::new("say");
                if !voice.is_empty() {
                    cmd.arg("-v").arg(&voice);
                }
                cmd.arg("-o").arg(&path_str).arg(&text);

                let output = cmd.output().await.map_err(|e| format!("TTS 命令执行失败: {}", e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("TTS 失败: {}", stderr));
                }
                path_str
            }
            _ => {
                // OpenAI TTS API
                let api_base = config.get("api_base").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let api_key = config.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let model = config.get("model").and_then(|v| v.as_str()).unwrap_or("tts-1").to_string();
                let voice = config.get("voice").and_then(|v| v.as_str()).unwrap_or("alloy").to_string();

                if api_base.is_empty() || api_key.is_empty() {
                    return Err("请配置 API Base 和 API Key".into());
                }

                let url = format!("{}/audio/speech", api_base.trim_end_matches('/'));
                let body = json!({
                    "model": model,
                    "input": text,
                    "voice": voice,
                });

                let resp = reqwest::Client::new()
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send().await.map_err(|e| format!("TTS 请求失败: {}", e))?;

                let status = resp.status();
                if !status.is_success() {
                    let err_text = resp.text().await.unwrap_or_default();
                    return Err(format!("TTS API 错误 ({}): {}", status, err_text));
                }

                let bytes = resp.bytes().await.map_err(|e| format!("读取音频失败: {}", e))?;
                let filename = format!("tts_{}.mp3", uuid::Uuid::new_v4());
                let output_path = temp_dir.join(&filename);
                let path_str = output_path.to_string_lossy().to_string();
                std::fs::write(&output_path, &bytes).map_err(|e| format!("保存音频失败: {}", e))?;
                path_str
            }
        };

        Ok(json!({
            "result": path,
            "path": path,
            "text": text,
            "engine": engine,
        }))
    }
}
