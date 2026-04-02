use serde_json::{json, Value};
use tauri::AppHandle;

use super::ai_utils::{get_api_config, call_openai_compatible, call_claude};

pub struct ConditionNode;

#[async_trait::async_trait]
impl super::INode for ConditionNode {
    fn node_type(&self) -> &str {
        "condition"
    }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let expression = config
            .get("expression")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let operator = config
            .get("operator")
            .and_then(|v| v.as_str())
            .unwrap_or("eq")
            .to_string();
        let compare_value = config
            .get("value")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let result = match operator.as_str() {
            "eq" => expression == compare_value,
            "neq" => expression != compare_value,
            "contains" => expression.contains(&compare_value),
            "gt" => {
                let a = expression.parse::<f64>().unwrap_or(0.0);
                let b = compare_value.parse::<f64>().unwrap_or(0.0);
                a > b
            }
            "lt" => {
                let a = expression.parse::<f64>().unwrap_or(0.0);
                let b = compare_value.parse::<f64>().unwrap_or(0.0);
                a < b
            }
            "empty" => expression.is_empty(),
            "not_empty" => !expression.is_empty(),
            "llm" => {
                // LLM-powered natural language condition evaluation
                let prompt = format!(
                    "判断以下条件是否成立，只回答 true 或 false，不要其他内容：\n\n条件：{}\n数据：{}",
                    compare_value, expression
                );
                let llm_result = match get_api_config(&config, app) {
                    Ok((api_base, api_key, model, provider_type)) => {
                        let response = if provider_type == "claude" {
                            call_claude(&api_base, &api_key, &model, &prompt, None).await
                        } else {
                            call_openai_compatible(&api_base, &api_key, &model, &prompt, None).await
                        };
                        match response {
                            Ok(text) => text.trim().to_lowercase().contains("true"),
                            Err(_) => false,
                        }
                    }
                    Err(_) => false,
                };
                llm_result
            }
            _ => false,
        };

        Ok(json!({
            "result": result,
            "evaluated": expression,
            "operator": operator,
            "compare_value": compare_value,
        }))
    }
}
