use serde_json::{json, Value};
use tauri::AppHandle;

pub struct TemplateRenderNode;

#[async_trait::async_trait]
impl super::INode for TemplateRenderNode {
    fn node_type(&self) -> &str { "template_render" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let template = config.get("template").and_then(|v| v.as_str()).unwrap_or("");
        if template.is_empty() { return Err("模板不能为空".into()); }

        // Merge data sources: config.data + input
        let mut data = input.clone();
        if let Some(extra) = config.get("data").and_then(|v| v.as_str()) {
            if let Ok(parsed) = serde_json::from_str::<Value>(extra) {
                if let (Some(d), Some(p)) = (data.as_object_mut(), parsed.as_object()) {
                    for (k, v) in p { d.insert(k.clone(), v.clone()); }
                }
            }
        }

        let result = render_template(template, &data);
        Ok(json!({ "result": result, "text": result, "template": template }))
    }
}

fn render_template(template: &str, data: &Value) -> String {
    let mut output = template.to_string();

    // Process {{#each array}}...{{/each}}
    let each_re = regex::Regex::new(r"\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{/each\}\}").unwrap();
    output = each_re.replace_all(&output, |caps: &regex::Captures| {
        let key = &caps[1];
        let body = &caps[2];
        if let Some(arr) = data.get(key).and_then(|v| v.as_array()) {
            arr.iter().enumerate().map(|(i, item)| {
                let mut s = body.replace("{{@index}}", &i.to_string());
                s = s.replace("{{this}}", &item_to_string(item));
                // Replace {{this.field}} patterns
                if let Some(obj) = item.as_object() {
                    for (k, v) in obj {
                        s = s.replace(&format!("{{{{this.{}}}}}", k), &item_to_string(v));
                    }
                }
                s
            }).collect::<Vec<_>>().join("")
        } else {
            String::new()
        }
    }).to_string();

    // Process {{#if condition}}...{{/if}}
    let if_re = regex::Regex::new(r"\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{/if\}\}").unwrap();
    output = if_re.replace_all(&output, |caps: &regex::Captures| {
        let key = &caps[1];
        let body = &caps[2];
        if is_truthy(data.get(key)) { body.to_string() } else { String::new() }
    }).to_string();

    // Process {{#unless condition}}...{{/unless}}
    let unless_re = regex::Regex::new(r"\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{/unless\}\}").unwrap();
    output = unless_re.replace_all(&output, |caps: &regex::Captures| {
        let key = &caps[1];
        let body = &caps[2];
        if !is_truthy(data.get(key)) { body.to_string() } else { String::new() }
    }).to_string();

    // Process simple {{variable}} substitutions (dot-path supported)
    let var_re = regex::Regex::new(r"\{\{(\w+(?:\.\w+)*)\}\}").unwrap();
    output = var_re.replace_all(&output, |caps: &regex::Captures| {
        let path = &caps[1];
        resolve_path(data, path)
    }).to_string();

    output
}

fn resolve_path(data: &Value, path: &str) -> String {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = data;
    for part in parts {
        match current.get(part) {
            Some(v) => current = v,
            None => return format!("{{{{{}}}}}", path), // keep original if not found
        }
    }
    item_to_string(current)
}

fn item_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "".into(),
        _ => v.to_string(),
    }
}

fn is_truthy(v: Option<&Value>) -> bool {
    match v {
        None => false,
        Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => !s.is_empty(),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0) != 0.0,
        Some(Value::Array(a)) => !a.is_empty(),
        Some(Value::Object(o)) => !o.is_empty(),
    }
}
