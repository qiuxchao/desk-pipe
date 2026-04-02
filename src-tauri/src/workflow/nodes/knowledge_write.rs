use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::Manager;

use super::ai_utils::get_api_config;

pub struct KnowledgeWriteNode;

fn get_knowledge_db_path(app: &AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| format!("获取数据目录失败: {}", e))?;
    let _ = std::fs::create_dir_all(&data_dir);
    Ok(data_dir.join("knowledge.db").to_string_lossy().to_string())
}

fn ensure_table(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS knowledge (
            id TEXT PRIMARY KEY,
            collection TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB,
            metadata TEXT,
            created_at TEXT NOT NULL
        )", [],
    ).map_err(|e| format!("创建知识表失败: {}", e))?;
    Ok(())
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

fn f32_vec_to_bytes(vec: &[f32]) -> Vec<u8> {
    vec.iter().flat_map(|f| f.to_le_bytes()).collect()
}

#[async_trait::async_trait]
impl super::INode for KnowledgeWriteNode {
    fn node_type(&self) -> &str { "knowledge_write" }

    async fn execute(&self, input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let (api_base, api_key, _model, _provider_type) = get_api_config(&config, app)?;
        let embedding_model = config.get("embedding_model").and_then(|v| v.as_str()).unwrap_or("text-embedding-ada-002").to_string();

        let collection = config.get("collection").and_then(|v| v.as_str()).unwrap_or("default").to_string();
        let content = config.get("content").and_then(|v| v.as_str())
            .or_else(|| input.get("result").and_then(|v| v.as_str()))
            .or_else(|| input.get("text").and_then(|v| v.as_str()))
            .unwrap_or("").to_string();

        if content.is_empty() {
            return Err("写入内容不能为空".into());
        }

        let metadata = config.get("metadata").cloned().unwrap_or(Value::Object(serde_json::Map::new()));
        let metadata_str = serde_json::to_string(&metadata).unwrap_or_default();

        // Get embedding
        let embedding = get_embedding(&api_base, &api_key, &embedding_model, &content).await?;
        let embedding_bytes = f32_vec_to_bytes(&embedding);

        let db_path = get_knowledge_db_path(app)?;
        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("打开知识库失败: {}", e))?;

        ensure_table(&conn)?;

        let doc_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Local::now().to_rfc3339();

        conn.execute(
            "INSERT INTO knowledge (id, collection, content, embedding, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![doc_id, collection, content, embedding_bytes, metadata_str, now],
        ).map_err(|e| format!("写入知识库失败: {}", e))?;

        Ok(json!({
            "result": "ok",
            "id": doc_id,
            "collection": collection,
        }))
    }
}
