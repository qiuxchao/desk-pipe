use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::workflow::types::WorkflowEvent;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExecutionRecord {
    pub id: String,
    pub workflow_id: String,
    pub workflow_name: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub status: String, // "running", "completed", "failed"
    pub events: Vec<WorkflowEvent>,
    pub result: Option<Value>,
    /// Per-node outputs for easy access without parsing events
    #[serde(default)]
    pub node_outputs: HashMap<String, Value>,
    /// Saved execution context for error recovery (resume from failed node)
    #[serde(default)]
    pub saved_context: Option<Value>,
    /// The node that failed (for resume)
    #[serde(default)]
    pub failed_node_id: Option<String>,
}

pub struct HistoryStorage {
    storage_dir: PathBuf,
}

/// Validate that an ID is safe for use in file paths (no path traversal).
fn validate_safe_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("ID 不能为空".into());
    }
    if id.contains('/') || id.contains('\\') || id.contains("..") || id.contains('\0') {
        return Err(format!("ID 包含非法字符: {}", id));
    }
    Ok(())
}

impl HistoryStorage {
    pub fn new(storage_dir: PathBuf) -> Self {
        if !storage_dir.exists() {
            if let Err(e) = fs::create_dir_all(&storage_dir) {
                log::error!("Failed to create history dir: {}", e);
            }
        }
        Self { storage_dir }
    }

    pub fn save(&self, record: &ExecutionRecord) -> Result<(), String> {
        validate_safe_id(&record.id)?;
        let path = self.storage_dir.join(format!("{}.json", record.id));
        let json = serde_json::to_string_pretty(record).map_err(|e| e.to_string())?;
        // Atomic write: temp file + rename
        let temp_path = path.with_extension("json.tmp");
        fs::write(&temp_path, &json).map_err(|e| format!("写入失败: {}", e))?;
        fs::rename(&temp_path, &path).map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            format!("重命名失败: {}", e)
        })
    }

    pub fn list(&self, workflow_id: Option<&str>) -> Result<Vec<ExecutionRecord>, String> {
        let mut records = Vec::new();
        let entries = fs::read_dir(&self.storage_dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(record) = serde_json::from_str::<ExecutionRecord>(&json) {
                        if let Some(wf_id) = workflow_id {
                            if record.workflow_id == wf_id {
                                records.push(record);
                            }
                        } else {
                            records.push(record);
                        }
                    }
                }
            }
        }
        records.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        Ok(records)
    }

    pub fn get(&self, record_id: &str) -> Result<ExecutionRecord, String> {
        validate_safe_id(record_id)?;
        let path = self.storage_dir.join(format!("{}.json", record_id));
        let json =
            fs::read_to_string(path).map_err(|e| format!("Record not found: {}", e))?;
        serde_json::from_str(&json).map_err(|e| e.to_string())
    }

    /// Search execution history with filters
    pub fn search(
        &self,
        query: Option<&str>,
        status: Option<&str>,
        date_from: Option<&str>,
        date_to: Option<&str>,
        limit: usize,
    ) -> Result<Vec<ExecutionRecord>, String> {
        let mut records = Vec::new();
        let entries = fs::read_dir(&self.storage_dir).map_err(|e| e.to_string())?;

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.extension().map_or(false, |ext| ext == "json") {
                continue;
            }
            let json = match fs::read_to_string(&path) {
                Ok(j) => j,
                Err(_) => continue,
            };
            let record: ExecutionRecord = match serde_json::from_str(&json) {
                Ok(r) => r,
                Err(_) => continue,
            };

            // Filter by query (workflow name)
            if let Some(q) = query {
                if !q.is_empty() && !record.workflow_name.to_lowercase().contains(&q.to_lowercase()) {
                    continue;
                }
            }

            // Filter by status
            if let Some(s) = status {
                if !s.is_empty() && record.status != s {
                    continue;
                }
            }

            // Filter by date range
            if let Some(from) = date_from {
                if !from.is_empty() && record.started_at < from.to_string() {
                    continue;
                }
            }
            if let Some(to) = date_to {
                if !to.is_empty() && record.started_at > to.to_string() {
                    continue;
                }
            }

            records.push(record);
        }

        records.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        records.truncate(limit);
        Ok(records)
    }
}
