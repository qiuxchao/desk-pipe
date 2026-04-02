use serde_json::{json, Value};
use tauri::AppHandle;

pub struct JsonProcessNode;

#[async_trait::async_trait]
impl super::INode for JsonProcessNode {
    fn node_type(&self) -> &str { "json_process" }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let input_text = config.get("input").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let operation = config.get("operation").and_then(|v| v.as_str()).unwrap_or("parse");

        match operation {
            "parse" => {
                let parsed: Value = serde_json::from_str(&input_text)
                    .map_err(|e| format!("JSON 解析失败: {}", e))?;
                Ok(json!({ "result": parsed }))
            }
            "stringify" => {
                let parsed: Value = serde_json::from_str(&input_text).unwrap_or(Value::String(input_text));
                let pretty = serde_json::to_string_pretty(&parsed).map_err(|e| e.to_string())?;
                Ok(json!({ "result": pretty }))
            }
            "extract" => {
                let path = config.get("path").and_then(|v| v.as_str()).unwrap_or("");
                let parsed: Value = serde_json::from_str(&input_text)
                    .map_err(|e| format!("JSON 解析失败: {}", e))?;
                let mut current = &parsed;
                for part in path.split('.') {
                    current = current.get(part).unwrap_or(&Value::Null);
                }
                Ok(json!({ "result": current }))
            }
            "to_csv" => {
                let parsed: Value = serde_json::from_str(&input_text)
                    .map_err(|e| format!("JSON 解析失败: {}", e))?;
                if let Some(arr) = parsed.as_array() {
                    if arr.is_empty() { return Ok(json!({ "result": "" })); }
                    let mut lines = Vec::new();
                    // Header from first object's keys
                    if let Some(obj) = arr[0].as_object() {
                        let headers: Vec<&String> = obj.keys().collect();
                        lines.push(headers.iter().map(|h| h.as_str()).collect::<Vec<_>>().join(","));
                        for item in arr {
                            let row: Vec<String> = headers.iter().map(|h| {
                                item.get(h.as_str()).map(|v| match v { Value::String(s) => s.clone(), _ => v.to_string() }).unwrap_or_default()
                            }).collect();
                            lines.push(row.join(","));
                        }
                    }
                    Ok(json!({ "result": lines.join("\n") }))
                } else {
                    Err("JSON 必须是数组才能转换为 CSV".to_string())
                }
            }
            "from_csv" => {
                let lines: Vec<&str> = input_text.lines().collect();
                if lines.is_empty() { return Ok(json!({ "result": [] })); }
                let headers: Vec<&str> = lines[0].split(',').map(|s| s.trim()).collect();
                let mut result = Vec::new();
                for line in &lines[1..] {
                    let values: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    let mut obj = serde_json::Map::new();
                    for (i, header) in headers.iter().enumerate() {
                        obj.insert(header.to_string(), json!(values.get(i).unwrap_or(&"")));
                    }
                    result.push(Value::Object(obj));
                }
                Ok(json!({ "result": result, "count": result.len() }))
            }
            _ => Err(format!("未知操作: {}", operation)),
        }
    }
}
