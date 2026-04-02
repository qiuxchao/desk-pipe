use serde_json::{json, Value};
use tauri::AppHandle;

pub struct HttpRequestNode;

#[async_trait::async_trait]
impl super::INode for HttpRequestNode {
    fn node_type(&self) -> &str {
        "http_request"
    }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let url = config
            .get("url")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'url' in http_request config")?
            .to_string();
        let method = config
            .get("method")
            .and_then(|v| v.as_str())
            .unwrap_or("GET")
            .to_uppercase();
        let body = config
            .get("body")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let headers = config.get("headers").cloned();

        let client = reqwest::Client::new();
        let mut request = match method.as_str() {
            "POST" => client.post(&url),
            "PUT" => client.put(&url),
            "DELETE" => client.delete(&url),
            "PATCH" => client.patch(&url),
            _ => client.get(&url),
        };

        if let Some(headers_obj) = headers.as_ref().and_then(|h| h.as_object()) {
            for (key, value) in headers_obj {
                if let Some(v) = value.as_str() {
                    request = request.header(key.as_str(), v);
                }
            }
        }

        if let Some(body_str) = body {
            // Only set default Content-Type if user hasn't specified one
            let has_content_type = headers.as_ref()
                .and_then(|h| h.as_object())
                .map_or(false, |obj| obj.keys().any(|k| k.to_lowercase() == "content-type"));
            if !has_content_type {
                request = request.header("content-type", "application/json");
            }
            request = request.body(body_str);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = response.status().as_u16();
        let response_headers: serde_json::Map<String, Value> = response
            .headers()
            .iter()
            .map(|(k, v)| {
                (
                    k.to_string(),
                    Value::String(v.to_str().unwrap_or("").to_string()),
                )
            })
            .collect();
        let response_body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        Ok(json!({
            "status": status,
            "body": response_body,
            "headers": response_headers,
        }))
    }
}
