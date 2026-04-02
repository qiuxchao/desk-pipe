use base64::Engine;
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::Manager;

pub struct DatabaseNode;

/// Validate that a SQL identifier (table/column name) contains only safe characters.
fn validate_identifier(name: &str) -> Result<String, String> {
    if name.is_empty() {
        return Err("标识符不能为空".into());
    }
    // Only allow alphanumeric, underscore, and Chinese characters
    for c in name.chars() {
        if !c.is_alphanumeric() && c != '_' {
            return Err(format!("标识符包含非法字符: '{}'（仅允许字母、数字、下划线）", c));
        }
    }
    // Quote the identifier to be safe
    Ok(format!("\"{}\"", name))
}

fn get_db_path(config: &Value, app: &AppHandle) -> String {
    let path = config.get("db_path").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if path.is_empty() {
        // Default to app data dir
        if let Ok(data_dir) = app.path().app_data_dir() {
            let _ = std::fs::create_dir_all(&data_dir);
            data_dir.join("workflow_data.db").to_string_lossy().to_string()
        } else {
            "workflow_data.db".to_string()
        }
    } else {
        path
    }
}

#[async_trait::async_trait]
impl super::INode for DatabaseNode {
    fn node_type(&self) -> &str { "database" }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let operation = config.get("operation").and_then(|v| v.as_str()).unwrap_or("select").to_string();
        let db_path = get_db_path(&config, app);
        let table = config.get("table").and_then(|v| v.as_str()).unwrap_or("").to_string();

        if table.is_empty() && operation != "raw" {
            return Err("表名不能为空".into());
        }

        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("打开数据库失败: {}", e))?;

        let safe_table = if operation != "raw" { validate_identifier(&table)? } else { table.clone() };

        match operation.as_str() {
            "create_table" => {
                let columns = config.get("columns").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let mut col_defs = Vec::new();
                for col in &columns {
                    let name = col.get("name").and_then(|v| v.as_str()).unwrap_or("col");
                    let safe_name = validate_identifier(name)?;
                    let col_type = col.get("type").and_then(|v| v.as_str()).unwrap_or("TEXT");
                    // Only allow known SQL types
                    let safe_type = match col_type.to_uppercase().as_str() {
                        "TEXT" | "INTEGER" | "REAL" | "BLOB" | "NUMERIC" => col_type.to_uppercase(),
                        _ => "TEXT".to_string(),
                    };
                    let primary = col.get("primary").and_then(|v| v.as_bool()).unwrap_or(false);
                    let mut def = format!("{} {}", safe_name, safe_type);
                    if primary {
                        def.push_str(" PRIMARY KEY");
                    }
                    col_defs.push(def);
                }
                if col_defs.is_empty() {
                    col_defs.push("id INTEGER PRIMARY KEY AUTOINCREMENT".to_string());
                    col_defs.push("data TEXT".to_string());
                }
                let sql = format!("CREATE TABLE IF NOT EXISTS {} ({})", safe_table, col_defs.join(", "));
                conn.execute(&sql, []).map_err(|e| format!("创建表失败: {}", e))?;
                Ok(json!({"result": "ok", "operation": "create_table", "table": table}))
            }
            "insert" => {
                let data = config.get("data").cloned().unwrap_or(Value::Object(serde_json::Map::new()));
                if let Some(obj) = data.as_object() {
                    let mut safe_keys = Vec::new();
                    for k in obj.keys() {
                        safe_keys.push(validate_identifier(k)?);
                    }
                    let placeholders: Vec<String> = safe_keys.iter().map(|_| "?".to_string()).collect();
                    let sql = format!("INSERT INTO {} ({}) VALUES ({})", safe_table, safe_keys.join(", "), placeholders.join(", "));
                    let values: Vec<String> = obj.values().map(|v| match v {
                        Value::String(s) => s.clone(),
                        other => other.to_string(),
                    }).collect();
                    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();
                    let affected = conn.execute(&sql, params.as_slice())
                        .map_err(|e| format!("插入数据失败: {}", e))?;
                    let last_id = conn.last_insert_rowid();
                    Ok(json!({"result": "ok", "operation": "insert", "affected_rows": affected, "last_id": last_id}))
                } else {
                    Err("插入数据格式错误，需要 JSON 对象".into())
                }
            }
            "select" => {
                let where_clause = config.get("where_clause").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let limit = config.get("limit").and_then(|v| v.as_u64()).unwrap_or(100);
                let mut sql = format!("SELECT * FROM {}", safe_table);
                if !where_clause.is_empty() {
                    sql.push_str(&format!(" WHERE {}", where_clause));
                }
                sql.push_str(&format!(" LIMIT {}", limit));
                let mut stmt = conn.prepare(&sql).map_err(|e| format!("查询失败: {}", e))?;
                let col_count = stmt.column_count();
                let col_names: Vec<String> = (0..col_count).map(|i| stmt.column_name(i).unwrap_or("?").to_string()).collect();
                let rows: Vec<Value> = stmt.query_map([], |row| {
                    let mut obj = serde_json::Map::new();
                    for (i, name) in col_names.iter().enumerate() {
                        // Preserve actual column types instead of coercing to String
                        let val: Value = match row.get::<_, rusqlite::types::Value>(i) {
                            Ok(rusqlite::types::Value::Integer(n)) => json!(n),
                            Ok(rusqlite::types::Value::Real(f)) => json!(f),
                            Ok(rusqlite::types::Value::Text(s)) => json!(s),
                            Ok(rusqlite::types::Value::Null) => Value::Null,
                            Ok(rusqlite::types::Value::Blob(b)) => json!(base64::engine::general_purpose::STANDARD.encode(&b)),
                            Err(_) => Value::Null,
                        };
                        obj.insert(name.clone(), val);
                    }
                    Ok(Value::Object(obj))
                }).map_err(|e| format!("查询失败: {}", e))?
                    .filter_map(|r| r.ok())
                    .collect();
                let count = rows.len();
                Ok(json!({"result": rows, "rows": rows, "count": count, "operation": "select"}))
            }
            "update" => {
                let data = config.get("data").cloned().unwrap_or(Value::Object(serde_json::Map::new()));
                let where_clause = config.get("where_clause").and_then(|v| v.as_str()).unwrap_or("").to_string();
                if let Some(obj) = data.as_object() {
                    // Use parameterized queries for values
                    let mut set_parts = Vec::new();
                    let mut values: Vec<String> = Vec::new();
                    for (k, v) in obj {
                        let safe_key = validate_identifier(k)?;
                        set_parts.push(format!("{} = ?", safe_key));
                        values.push(match v {
                            Value::String(s) => s.clone(),
                            other => other.to_string(),
                        });
                    }
                    let mut sql = format!("UPDATE {} SET {}", safe_table, set_parts.join(", "));
                    if !where_clause.is_empty() {
                        sql.push_str(&format!(" WHERE {}", where_clause));
                    }
                    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();
                    let affected = conn.execute(&sql, params.as_slice()).map_err(|e| format!("更新失败: {}", e))?;
                    Ok(json!({"result": "ok", "operation": "update", "affected_rows": affected}))
                } else {
                    Err("更新数据格式错误".into())
                }
            }
            "delete" => {
                let where_clause = config.get("where_clause").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let mut sql = format!("DELETE FROM {}", safe_table);
                if !where_clause.is_empty() {
                    sql.push_str(&format!(" WHERE {}", where_clause));
                }
                let affected = conn.execute(&sql, []).map_err(|e| format!("删除失败: {}", e))?;
                Ok(json!({"result": "ok", "operation": "delete", "affected_rows": affected}))
            }
            _ => Err(format!("不支持的操作: {}", operation)),
        }
    }
}
