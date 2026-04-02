use std::fs;
use std::path::PathBuf;

use crate::workflow::types::Workflow;

pub struct WorkflowStorage {
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

/// Atomic file write: write to temp file then rename.
fn atomic_write(path: &std::path::Path, content: &str) -> Result<(), String> {
    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, content).map_err(|e| format!("写入失败: {}", e))?;
    fs::rename(&temp_path, path).map_err(|e| {
        let _ = fs::remove_file(&temp_path);
        format!("重命名失败: {}", e)
    })
}

impl WorkflowStorage {
    pub fn new(storage_dir: PathBuf) -> Self {
        if !storage_dir.exists() {
            if let Err(e) = fs::create_dir_all(&storage_dir) {
                log::error!("Failed to create storage dir: {}", e);
            }
        }
        Self { storage_dir }
    }

    pub fn save(&self, workflow: &Workflow) -> Result<(), String> {
        validate_safe_id(&workflow.id)?;
        let path = self.storage_dir.join(format!("{}.json", workflow.id));

        // Before overwriting, snapshot the existing file as a version
        if path.exists() {
            let versions_dir = self.storage_dir.join("versions").join(&workflow.id);
            if let Err(e) = fs::create_dir_all(&versions_dir) {
                log::warn!("Failed to create versions dir: {}", e);
            } else {
                let ts = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
                if let Err(e) = fs::copy(&path, versions_dir.join(format!("{}.json", ts))) {
                    log::warn!("Failed to backup version: {}", e);
                }
                // Cleanup: keep only the latest 20 versions
                self.cleanup_old_versions(&workflow.id, 20);
            }
        }

        let json = serde_json::to_string_pretty(workflow).map_err(|e| e.to_string())?;
        atomic_write(&path, &json)
    }

    pub fn load(&self, id: &str) -> Result<Workflow, String> {
        validate_safe_id(id)?;
        let path = self.storage_dir.join(format!("{}.json", id));
        let json = fs::read_to_string(path).map_err(|e| format!("Workflow not found: {}", e))?;
        serde_json::from_str(&json).map_err(|e| e.to_string())
    }

    pub fn list(&self) -> Result<Vec<Workflow>, String> {
        let mut workflows = Vec::new();
        let entries = fs::read_dir(&self.storage_dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(workflow) = serde_json::from_str::<Workflow>(&json) {
                        workflows.push(workflow);
                    }
                }
            }
        }
        Ok(workflows)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        validate_safe_id(id)?;
        let path = self.storage_dir.join(format!("{}.json", id));
        fs::remove_file(path).map_err(|e| e.to_string())
    }

    /// Remove old version files, keeping only the latest `keep` versions.
    fn cleanup_old_versions(&self, workflow_id: &str, keep: usize) {
        let versions_dir = self.storage_dir.join("versions").join(workflow_id);
        if let Ok(entries) = fs::read_dir(&versions_dir) {
            let mut files: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
                .collect();
            // Sort newest first by filename (timestamp-based)
            files.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
            for old in files.into_iter().skip(keep) {
                let _ = fs::remove_file(old.path());
            }
        }
    }

    /// Returns vec of (timestamp, file_path) sorted newest first, max 20 versions.
    pub fn list_versions(&self, workflow_id: &str) -> Result<Vec<(String, String)>, String> {
        validate_safe_id(workflow_id)?;
        let versions_dir = self.storage_dir.join("versions").join(workflow_id);
        if !versions_dir.exists() {
            return Ok(vec![]);
        }
        let mut versions: Vec<(String, String)> = fs::read_dir(&versions_dir)
            .map_err(|e| e.to_string())?
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".json") {
                    let ts = name.trim_end_matches(".json").to_string();
                    Some((ts, entry.path().to_string_lossy().to_string()))
                } else {
                    None
                }
            })
            .collect();
        versions.sort_by(|a, b| b.0.cmp(&a.0));
        Ok(versions.into_iter().take(20).collect())
    }

    /// Load a specific version's JSON content.
    pub fn load_version(&self, workflow_id: &str, timestamp: &str) -> Result<String, String> {
        validate_safe_id(workflow_id)?;
        validate_safe_id(timestamp)?;
        let path = self
            .storage_dir
            .join("versions")
            .join(workflow_id)
            .join(format!("{}.json", timestamp));
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }
}
