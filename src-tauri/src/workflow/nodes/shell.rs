use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

pub struct ShellNode;

#[async_trait::async_trait]
impl super::INode for ShellNode {
    fn node_type(&self) -> &str {
        "shell"
    }

    async fn execute(&self, _input: Value, config: Value, app: &AppHandle) -> Result<Value, String> {
        let command = config
            .get("command")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'command' in shell node config")?
            .to_string();

        let mut child = Command::new("sh")
            .arg("-c")
            .arg(&command)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        // Read stdout and stderr concurrently to avoid deadlock
        let stdout_handle = child.stdout.take();
        let stderr_handle = child.stderr.take();

        let app_stdout = app.clone();
        let stdout_task = tokio::spawn(async move {
            let mut lines = Vec::new();
            if let Some(stdout) = stdout_handle {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_stdout.emit("shell_output", json!({ "line": line, "stream": "stdout" }));
                    lines.push(line);
                }
            }
            lines
        });

        let app_stderr = app.clone();
        let stderr_task = tokio::spawn(async move {
            let mut lines = Vec::new();
            if let Some(stderr) = stderr_handle {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_stderr.emit("shell_output", json!({ "line": line, "stream": "stderr" }));
                    lines.push(line);
                }
            }
            lines
        });

        let (stdout_lines, stderr_lines, status) = tokio::try_join!(
            async { stdout_task.await.map_err(|e| format!("stdout task failed: {}", e)) },
            async { stderr_task.await.map_err(|e| format!("stderr task failed: {}", e)) },
            async { child.wait().await.map_err(|e| format!("Failed to wait for command: {}", e)) },
        )?;

        let stdout = stdout_lines.join("\n");
        let stderr = stderr_lines.join("\n");

        Ok(json!({
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": status.code().unwrap_or(-1),
        }))
    }
}
