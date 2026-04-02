use regex::Regex;
use serde_json::Value;

/// Resolve a dot-notation path against a JSON Value.
/// e.g., "prev.stdout" resolves context["prev"]["stdout"]
fn resolve_path(context: &Value, path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = context;

    for part in parts {
        match current {
            Value::Object(map) => {
                current = map.get(part)?;
            }
            Value::Array(arr) => {
                let index: usize = part.parse().ok()?;
                current = arr.get(index)?;
            }
            _ => return None,
        }
    }

    match current {
        Value::String(s) => Some(s.clone()),
        Value::Null => Some(String::new()),
        other => Some(other.to_string()),
    }
}

/// Replace all {{path.to.value}} patterns in a string with resolved values.
pub fn interpolate(template: &str, context: &Value) -> String {
    let re = Regex::new(r"\{\{(.+?)\}\}").unwrap();
    re.replace_all(template, |caps: &regex::Captures| {
        let path = caps[1].trim();
        resolve_path(context, path).unwrap_or_default()
    })
    .to_string()
}

/// Recursively walk a JSON Value and interpolate all string values.
pub fn interpolate_value(value: &Value, context: &Value) -> Value {
    match value {
        Value::String(s) => {
            if s.contains("{{") {
                Value::String(interpolate(s, context))
            } else {
                value.clone()
            }
        }
        Value::Object(map) => {
            let new_map: serde_json::Map<String, Value> = map
                .iter()
                .map(|(k, v)| (k.clone(), interpolate_value(v, context)))
                .collect();
            Value::Object(new_map)
        }
        Value::Array(arr) => {
            let new_arr: Vec<Value> = arr.iter().map(|v| interpolate_value(v, context)).collect();
            Value::Array(new_arr)
        }
        _ => value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_interpolate_simple() {
        let ctx = json!({"prev": {"stdout": "hello world"}});
        assert_eq!(interpolate("echo {{prev.stdout}}", &ctx), "echo hello world");
    }

    #[test]
    fn test_interpolate_missing() {
        let ctx = json!({});
        assert_eq!(interpolate("echo {{missing.path}}", &ctx), "echo ");
    }

    #[test]
    fn test_interpolate_value_recursive() {
        let ctx = json!({"prev": {"name": "test"}});
        let input = json!({"command": "echo {{prev.name}}", "nested": {"key": "{{prev.name}}"}});
        let result = interpolate_value(&input, &ctx);
        assert_eq!(result["command"], "echo test");
        assert_eq!(result["nested"]["key"], "test");
    }
}
