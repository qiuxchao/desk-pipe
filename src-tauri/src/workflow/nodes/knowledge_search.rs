use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::Manager;

use super::ai_utils::get_api_config;

pub struct KnowledgeSearchNode;

fn get_knowledge_db_path(app: &AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| format!("获取数据目录失败: {}", e))?;
    Ok(data_dir.join("knowledge.db").to_string_lossy().to_string())
}

async fn get_embedding(api_base: &str, api_key: &str, model: &str, text: &str) -> Result<Vec<f32>, String> {
    let url = format!("{}/embeddings", api_base.trim_end_matches('/'));
    let body = json!({
        "model": model,
        "input": text,
    });

    let resp = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send().await.map_err(|e| format!("Embedding 请求失败: {}", e))?;

    let status = resp.status();
    let resp_text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Embedding API 错误 ({}): {}", status, resp_text));
    }

    let resp_json: Value = serde_json::from_str(&resp_text)
        .map_err(|e| format!("解析 Embedding 响应失败: {}", e))?;

    let embedding = resp_json.get("data")
        .and_then(|d| d.get(0))
        .and_then(|d| d.get("embedding"))
        .and_then(|e| e.as_array())
        .ok_or("无法解析 Embedding 结果")?;

    let vec: Vec<f32> = embedding.iter()
        .filter_map(|v| v.as_f64().map(|f| f as f32))
        .collect();

    Ok(vec)
}

fn bytes_to_f32_vec(bytes: &[u8]) -> Vec<f32> {
    bytes.chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if mag_a == 0.0 || mag_b == 0.0 {
        return 0.0;
    }
    dot / (mag_a * mag_b)
}

#[async_trait::async_trait]
impl super::INode for KnowledgeSearchNode {
    fn node_type(&self) -> &str { "knowledge_search" }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let (api_base, api_key, _model, _provider_type) = get_api_config(&config, app)?;
        let embedding_model = config.get("embedding_model").and_then(|v| v.as_str()).unwrap_or("text-embedding-ada-002").to_string();

        let collection = config.get("collection").and_then(|v| v.as_str()).unwrap_or("default").to_string();
        let query = config.get("query").and_then(|v| v.as_str())
            .or_else(|| input.get("result").and_then(|v| v.as_str()))
            .or_else(|| input.get("text").and_then(|v| v.as_str()))
            .unwrap_or("").to_string();
        let top_k = config.get("top_k").and_then(|v| v.as_u64()).unwrap_or(5) as usize;

        if query.is_empty() {
            return Err("搜索查询不能为空".into());
        }

        // Get query embedding
        let query_embedding = get_embedding(&api_base, &api_key, &embedding_model, &query).await?;

        let db_path = get_knowledge_db_path(app)?;
        if !std::path::Path::new(&db_path).exists() {
            return Ok(json!({"result": [], "results": [], "count": 0, "query": query}));
        }

        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("打开知识库失败: {}", e))?;

        let mut stmt = conn.prepare(
            "SELECT id, content, embedding, metadata, created_at FROM knowledge WHERE collection = ?1"
        ).map_err(|e| format!("查询失败: {}", e))?;

        let mut scored: Vec<(f32, Value)> = stmt.query_map(rusqlite::params![collection], |row| {
            let id: String = row.get(0)?;
            let content: String = row.get(1)?;
            let embedding_bytes: Vec<u8> = row.get(2)?;
            let metadata_str: String = row.get::<_, String>(3).unwrap_or_default();
            let created_at: String = row.get::<_, String>(4).unwrap_or_default();
            Ok((id, content, embedding_bytes, metadata_str, created_at))
        }).map_err(|e| format!("查询失败: {}", e))?
            .filter_map(|r| r.ok())
            .map(|(id, content, embedding_bytes, metadata_str, created_at)| {
                let doc_embedding = bytes_to_f32_vec(&embedding_bytes);
                let score = cosine_similarity(&query_embedding, &doc_embedding);
                let metadata: Value = serde_json::from_str(&metadata_str).unwrap_or(Value::Null);
                (score, json!({
                    "id": id,
                    "content": content,
                    "score": score,
                    "metadata": metadata,
                    "created_at": created_at,
                }))
            })
            .collect();

        // Sort by score descending
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let results: Vec<Value> = scored.into_iter().take(top_k).map(|(_, v)| v).collect();
        let count = results.len();

        Ok(json!({
            "result": results,
            "results": results,
            "count": count,
            "query": query,
        }))
    }
}
