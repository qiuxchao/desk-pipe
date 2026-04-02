use async_trait::async_trait;
use serde_json::Value;
use tauri::AppHandle;

pub struct EmailSendNode;

#[async_trait]
impl super::INode for EmailSendNode {
    fn node_type(&self) -> &str { "email_send" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let smtp_host = config.get("smtp_host").and_then(|v| v.as_str()).unwrap_or("smtp.gmail.com");
        let smtp_port = config.get("smtp_port").and_then(|v| v.as_u64()).unwrap_or(587) as u16;
        let username = config.get("username").and_then(|v| v.as_str()).unwrap_or("");
        let password = config.get("password").and_then(|v| v.as_str()).unwrap_or("");
        let from = config.get("from").and_then(|v| v.as_str()).unwrap_or(username);
        let to = config.get("to").and_then(|v| v.as_str()).unwrap_or("");
        let subject = config.get("subject").and_then(|v| v.as_str()).unwrap_or("DeskPipe 通知");

        // Body can come from config or from previous node output
        let body = config.get("body").and_then(|v| v.as_str())
            .or(input.get("text").and_then(|v| v.as_str()))
            .or(input.get("result").and_then(|v| v.as_str()))
            .or(input.get("stdout").and_then(|v| v.as_str()))
            .unwrap_or("");

        if to.is_empty() {
            return Err("收件人地址不能为空".into());
        }
        if username.is_empty() || password.is_empty() {
            return Err("SMTP 用户名和密码不能为空".into());
        }

        use lettre::{Message, SmtpTransport, Transport};
        use lettre::transport::smtp::authentication::Credentials;

        let email = Message::builder()
            .from(from.parse().map_err(|e| format!("发件人地址无效: {}", e))?)
            .to(to.parse().map_err(|e| format!("收件人地址无效: {}", e))?)
            .subject(subject)
            .body(body.to_string())
            .map_err(|e| format!("构建邮件失败: {}", e))?;

        let creds = Credentials::new(username.to_string(), password.to_string());

        let mailer = SmtpTransport::relay(smtp_host)
            .map_err(|e| format!("SMTP 连接失败: {}", e))?
            .port(smtp_port)
            .credentials(creds)
            .build();

        mailer.send(&email).map_err(|e| format!("发送邮件失败: {}", e))?;

        Ok(serde_json::json!({
            "sent": true,
            "to": to,
            "subject": subject,
        }))
    }
}
