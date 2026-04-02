use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::Manager;

pub struct SqlQueryNode;

fn get_db_path(config: &Value, app: &AppHandle) -> String {
    let path = config.get("db_path").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if path.is_empty() {
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
impl super::INode for SqlQueryNode {
    fn node_type(&self) -> &str { "sql_query" }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let db_path = get_db_path(&config, app);
        let sql = config.get("sql").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if sql.is_empty() {
            return Err("SQL 语句不能为空".into());
        }

        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("打开数据库失败: {}", e))?;

        let trimmed = sql.trim().to_uppercase();
        let is_query = trimmed.starts_with("SELECT") || trimmed.starts_with("PRAGMA");

        if is_query {
            let params_val = config.get("params").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let params_str: Vec<String> = params_val.iter().map(|v| match v {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            }).collect();
            let params_ref: Vec<&dyn rusqlite::types::ToSql> = params_str.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();

            let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL 准备失败: {}", e))?;
            let col_count = stmt.column_count();
            let col_names: Vec<String> = (0..col_count).map(|i| stmt.column_name(i).unwrap_or("?").to_string()).collect();

            let rows: Vec<Value> = stmt.query_map(params_ref.as_slice(), |row| {
                let mut obj = serde_json::Map::new();
                for (i, name) in col_names.iter().enumerate() {
                    let val: String = row.get::<_, String>(i).unwrap_or_default();
                    obj.insert(name.clone(), Value::String(val));
                }
                Ok(Value::Object(obj))
            }).map_err(|e| format!("查询执行失败: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            let count = rows.len();
            Ok(json!({"result": rows, "rows": rows, "count": count, "sql": sql}))
        } else {
            let affected = conn.execute(&sql, [])
                .map_err(|e| format!("SQL 执行失败: {}", e))?;
            Ok(json!({"result": "ok", "affected_rows": affected, "sql": sql}))
        }
    }
}
