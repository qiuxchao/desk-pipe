use serde_json::{json, Value};
use tauri::AppHandle;

pub struct ListOperatorNode;

#[async_trait::async_trait]
impl super::INode for ListOperatorNode {
    fn node_type(&self) -> &str { "list_operator" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let operation = config.get("operation").and_then(|v| v.as_str()).unwrap_or("filter");

        // Get items from config or input
        let items = config.get("items").and_then(|v| v.as_array())
            .or_else(|| input.get("result").and_then(|v| v.as_array()))
            .or_else(|| input.get("items").and_then(|v| v.as_array()))
            .or_else(|| input.as_array())
            .ok_or("输入数据不是数组")?
            .clone();

        let field = config.get("field").and_then(|v| v.as_str()).unwrap_or("");

        let result = match operation {
            "filter" => {
                let condition = config.get("condition").and_then(|v| v.as_str()).unwrap_or("contains");
                let cond_value = config.get("condition_value").and_then(|v| v.as_str()).unwrap_or("");
                items.into_iter().filter(|item| {
                    let val = if field.is_empty() {
                        item.as_str().map(|s| s.to_string()).unwrap_or_else(|| item.to_string())
                    } else {
                        item.get(field).and_then(|v| v.as_str()).unwrap_or("").to_string()
                    };
                    match condition {
                        "contains" => val.contains(cond_value),
                        "not_contains" => !val.contains(cond_value),
                        "starts_with" => val.starts_with(cond_value),
                        "ends_with" => val.ends_with(cond_value),
                        "equals" => val == cond_value,
                        "not_equals" => val != cond_value,
                        "gt" => val.parse::<f64>().unwrap_or(0.0) > cond_value.parse::<f64>().unwrap_or(0.0),
                        "lt" => val.parse::<f64>().unwrap_or(0.0) < cond_value.parse::<f64>().unwrap_or(0.0),
                        "empty" => val.is_empty(),
                        "not_empty" => !val.is_empty(),
                        _ => true,
                    }
                }).collect::<Vec<_>>()
            }
            "sort" => {
                let direction = config.get("sort_direction").and_then(|v| v.as_str()).unwrap_or("asc");
                let mut sorted = items;
                sorted.sort_by(|a, b| {
                    let va = if field.is_empty() { a.to_string() } else { a.get(field).map(|v| v.to_string()).unwrap_or_default() };
                    let vb = if field.is_empty() { b.to_string() } else { b.get(field).map(|v| v.to_string()).unwrap_or_default() };
                    // Try numeric comparison first
                    if let (Ok(na), Ok(nb)) = (va.parse::<f64>(), vb.parse::<f64>()) {
                        if direction == "desc" { nb.partial_cmp(&na).unwrap_or(std::cmp::Ordering::Equal) }
                        else { na.partial_cmp(&nb).unwrap_or(std::cmp::Ordering::Equal) }
                    } else if direction == "desc" { vb.cmp(&va) } else { va.cmp(&vb) }
                });
                sorted
            }
            "limit" => {
                let count = config.get("limit_count").and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<usize>().ok()).unwrap_or(10);
                items.into_iter().take(count).collect()
            }
            "extract" => {
                let index = config.get("extract_index").and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
                if index < items.len() {
                    vec![items[index].clone()]
                } else {
                    vec![]
                }
            }
            _ => items,
        };

        let count = result.len();
        Ok(json!({ "result": result, "items": result, "count": count, "operation": operation }))
    }
}
