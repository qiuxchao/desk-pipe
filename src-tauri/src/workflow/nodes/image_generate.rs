use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::Manager;

use super::ai_utils::get_api_config;

pub struct ImageGenerateNode;

#[async_trait::async_trait]
impl super::INode for ImageGenerateNode {
    fn node_type(&self) -> &str { "image_generate" }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let (api_base, api_key, model, _provider_type) = get_api_config(&config, app)?;
        let prompt = config.get("prompt").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if prompt.is_empty() {
            return Err("图片生成提示词不能为空".into());
        }

        let size = config.get("size").and_then(|v| v.as_str()).unwrap_or("1024x1024").to_string();
        let quality = config.get("quality").and_then(|v| v.as_str()).unwrap_or("standard").to_string();
        let style = config.get("style").and_then(|v| v.as_str()).unwrap_or("vivid").to_string();

        let url = format!("{}/images/generations", api_base.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "prompt": prompt,
            "size": size,
            "quality": quality,
            "style": style,
            "n": 1,
        });

        let resp = reqwest::Client::new()
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send().await.map_err(|e| format!("图片生成请求失败: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
        if !status.is_success() {
            return Err(format!("图片生成 API 错误 ({}): {}", status, text));
        }

        let resp_json: Value = serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {}", e))?;
        let image_url = resp_json.get("data")
            .and_then(|d| d.get(0))
            .and_then(|d| d.get("url"))
            .and_then(|u| u.as_str())
            .ok_or("无法获取生成的图片 URL")?
            .to_string();

        // Download image to temp file
        let img_bytes = reqwest::Client::new()
            .get(&image_url)
            .send().await.map_err(|e| format!("下载图片失败: {}", e))?
            .bytes().await.map_err(|e| format!("读取图片失败: {}", e))?;

        let temp_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp"));
        let _ = std::fs::create_dir_all(&temp_dir);
        let filename = format!("generated_{}.png", uuid::Uuid::new_v4());
        let local_path = temp_dir.join(&filename);
        std::fs::write(&local_path, &img_bytes).map_err(|e| format!("保存图片失败: {}", e))?;

        let path_str = local_path.to_string_lossy().to_string();
        Ok(json!({
            "result": path_str,
            "path": path_str,
            "url": image_url,
            "prompt": prompt,
        }))
    }
}
