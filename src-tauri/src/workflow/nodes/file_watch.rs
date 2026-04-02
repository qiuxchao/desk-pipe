use async_trait::async_trait;
use serde_json::{json, Value};
use tauri::AppHandle;
use std::path::Path;

pub struct FileWatchNode;

#[async_trait]
impl super::INode for FileWatchNode {
    fn node_type(&self) -> &str { "file_watch" }

    async fn execute(&self, _input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let watch_path = config.get("path").and_then(|v| v.as_str()).unwrap_or("");
        let timeout_secs = config.get("timeout_secs").and_then(|v| v.as_u64()).unwrap_or(30);

        if watch_path.is_empty() {
            return Err("监听路径不能为空".into());
        }

        if !Path::new(watch_path).exists() {
            return Err(format!("路径不存在: {}", watch_path));
        }

        use notify::{Watcher, RecursiveMode};
        use std::sync::mpsc;
        use std::time::Duration;

        let (tx, rx) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        }).map_err(|e| format!("创建文件监听器失败: {}", e))?;

        watcher.watch(Path::new(watch_path), RecursiveMode::Recursive)
            .map_err(|e| format!("开始监听失败: {}", e))?;

        // Wait for first event or timeout
        match rx.recv_timeout(Duration::from_secs(timeout_secs)) {
            Ok(event) => {
                let kind = format!("{:?}", event.kind);
                let paths: Vec<String> = event.paths.iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                Ok(json!({
                    "result": format!("{} 文件变化: {}", kind, paths.join(", ")),
                    "event_type": kind,
                    "paths": paths,
                    "path": paths.first().unwrap_or(&String::new()),
                    "detected": true,
                }))
            }
            Err(_) => {
                Ok(json!({
                    "result": "监听超时，未检测到变化",
                    "detected": false,
                    "timeout": true,
                }))
            }
        }
    }
}
