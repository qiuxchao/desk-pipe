use async_trait::async_trait;
use serde_json::{json, Value};
use tauri::AppHandle;
use std::process::Command;

pub struct CodeNode;

#[async_trait]
impl super::INode for CodeNode {
    fn node_type(&self) -> &str { "code" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let code = config.get("code").and_then(|v| v.as_str()).unwrap_or("");
        let language = config.get("language").and_then(|v| v.as_str()).unwrap_or("javascript");
        let timeout_ms = config.get("code_timeout_ms").and_then(|v| v.as_u64()).unwrap_or(30_000);

        if code.is_empty() {
            return Err("代码不能为空".into());
        }

        let input_json = serde_json::to_string(&input).unwrap_or("{}".into());

        // Write input data to a temp file to avoid injection via string embedding
        let input_file = std::env::temp_dir().join(format!("deskpipe_input_{}.json", std::process::id()));
        std::fs::write(&input_file, &input_json)
            .map_err(|e| format!("写入输入数据失败: {}", e))?;
        let input_path = input_file.to_string_lossy().to_string();

        // Write user code to a temp file
        let (ext, wrapped_code) = match language {
            "python" => ("py", format!(
                "import json, sys\nwith open('{}') as f:\n    input_data = json.load(f)\ninput = input_data\n{}",
                input_path.replace('\\', "\\\\"), code
            )),
            "typescript" => ("ts", format!(
                "import {{ readFileSync }} from 'fs';\nconst input = JSON.parse(readFileSync('{}', 'utf-8'));\n{}",
                input_path.replace('\\', "\\\\"), code
            )),
            "ruby" => ("rb", format!(
                "require 'json'\ninput = JSON.parse(File.read('{}'))\n{}",
                input_path.replace('\\', "\\\\"), code
            )),
            _ => ("js", format!(
                "const input = JSON.parse(require('fs').readFileSync('{}', 'utf-8'));\n{}",
                input_path.replace('\\', "\\\\"), code
            )),
        };

        let code_file = std::env::temp_dir().join(format!("deskpipe_code_{}.{}", std::process::id(), ext));
        std::fs::write(&code_file, &wrapped_code)
            .map_err(|e| format!("写入代码文件失败: {}", e))?;

        let (cmd, args) = match language {
            "python" => ("python3".to_string(), vec![code_file.to_string_lossy().to_string()]),
            "typescript" => ("npx".to_string(), vec!["tsx".to_string(), code_file.to_string_lossy().to_string()]),
            "ruby" => ("ruby".to_string(), vec![code_file.to_string_lossy().to_string()]),
            _ => ("node".to_string(), vec![code_file.to_string_lossy().to_string()]),
        };

        // Run with timeout, kill child on timeout
        let child = Command::new(&cmd)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("执行 {} 失败（请确保已安装）: {}", language, e))?;

        let child_id = child.id();

        let result = tokio::time::timeout(
            std::time::Duration::from_millis(timeout_ms),
            tokio::task::spawn_blocking(move || child.wait_with_output()),
        )
        .await;

        // Clean up temp files
        let _ = std::fs::remove_file(&input_file);
        let _ = std::fs::remove_file(&code_file);

        let output = match result {
            Err(_) => {
                // Timeout: kill the child process
                #[cfg(unix)]
                { let _ = Command::new("kill").args(["-9", &child_id.to_string()]).output(); }
                #[cfg(windows)]
                { let _ = Command::new("taskkill").args(["/PID", &child_id.to_string(), "/F"]).output(); }
                return Err(format!("代码执行超时 ({}ms)", timeout_ms));
            }
            Ok(r) => r
                .map_err(|e| format!("执行出错: {}", e))?
                .map_err(|e| format!("执行出错: {}", e))?,
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(format!("代码执行出错:\n{}", if stderr.is_empty() { &stdout } else { &stderr }));
        }

        // Try to parse stdout as JSON
        let result = if let Ok(parsed) = serde_json::from_str::<Value>(stdout.trim()) {
            parsed
        } else {
            json!({ "result": stdout.trim() })
        };

        Ok(json!({
            "result": result.get("result").unwrap_or(&result),
            "stdout": stdout.trim(),
            "stderr": stderr.trim(),
            "language": language,
        }))
    }
}
