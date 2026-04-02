use serde_json::{json, Value};
use tauri::AppHandle;

pub struct DataProcessNode;

#[async_trait::async_trait]
impl super::INode for DataProcessNode {
    fn node_type(&self) -> &str { "data_process" }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let input_text = config.get("input").and_then(|v| v.as_str()).unwrap_or("[]").to_string();
        let operation = config.get("operation").and_then(|v| v.as_str()).unwrap_or("count");

        let arr: Vec<Value> = serde_json::from_str(&input_text)
            .or_else(|_| {
                // Try to parse from prev data
                if let Ok(v) = serde_json::from_str::<Value>(&input_text) {
                    if let Some(a) = v.as_array() { return Ok(a.clone()); }
                }
                // Split by newlines as fallback
                Ok(input_text.lines().map(|l| json!(l.trim())).filter(|v| v.as_str() != Some("")).collect())
            })
            .map_err(|e: serde_json::Error| format!("数据解析失败: {}", e))?;

        match operation {
            "count" => Ok(json!({ "result": arr.len() })),
            "sum" => {
                let sum: f64 = arr.iter().filter_map(|v| {
                    v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                }).sum();
                Ok(json!({ "result": sum }))
            }
            "average" => {
                let nums: Vec<f64> = arr.iter().filter_map(|v| {
                    v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                }).collect();
                let avg = if nums.is_empty() { 0.0 } else { nums.iter().sum::<f64>() / nums.len() as f64 };
                Ok(json!({ "result": avg, "count": nums.len() }))
            }
            "sort" => {
                let mut sorted = arr;
                sorted.sort_by(|a, b| {
                    let sa = a.as_str().unwrap_or("");
                    let sb = b.as_str().unwrap_or("");
                    sa.cmp(sb)
                });
                Ok(json!({ "result": sorted }))
            }
            "reverse" => {
                let mut reversed = arr;
                reversed.reverse();
                Ok(json!({ "result": reversed }))
            }
            "unique" => {
                let mut seen = std::collections::HashSet::new();
                let unique: Vec<Value> = arr.into_iter().filter(|v| {
                    let key = v.to_string();
                    seen.insert(key)
                }).collect();
                Ok(json!({ "result": unique, "count": unique.len() }))
            }
            "filter" => {
                let keyword = config.get("keyword").and_then(|v| v.as_str()).unwrap_or("");
                let filtered: Vec<Value> = arr.into_iter().filter(|v| {
                    v.to_string().contains(keyword)
                }).collect();
                Ok(json!({ "result": filtered, "count": filtered.len() }))
            }
            "first" => {
                let n = config.get("n").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
                let result: Vec<Value> = arr.into_iter().take(n).collect();
                Ok(json!({ "result": result }))
            }
            "last" => {
                let n = config.get("n").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
                let len = arr.len();
                let result: Vec<Value> = arr.into_iter().skip(len.saturating_sub(n)).collect();
                Ok(json!({ "result": result }))
            }
            _ => Err(format!("未知操作: {}", operation)),
        }
    }
}
