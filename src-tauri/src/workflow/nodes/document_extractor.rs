use serde_json::{json, Value};
use tauri::AppHandle;

pub struct DocumentExtractorNode;

#[async_trait::async_trait]
impl super::INode for DocumentExtractorNode {
    fn node_type(&self) -> &str { "document_extractor" }

    async fn execute(&self, input: Value, config: Value, _app: &AppHandle) -> Result<Value, String> {
        let path = config.get("file_path").and_then(|v| v.as_str())
            .or_else(|| input.get("path").and_then(|v| v.as_str()))
            .unwrap_or("");
        if path.is_empty() { return Err("文件路径不能为空".into()); }

        let path_obj = std::path::Path::new(path);
        if !path_obj.exists() { return Err(format!("文件不存在: {}", path)); }

        let ext = path_obj.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

        let (text, file_type) = match ext.as_str() {
            "txt" | "md" | "csv" | "log" => {
                let content = std::fs::read_to_string(path).map_err(|e| format!("读取失败: {}", e))?;
                (content, ext.clone())
            }
            "html" | "htm" => {
                let html = std::fs::read_to_string(path).map_err(|e| format!("读取失败: {}", e))?;
                let document = scraper::Html::parse_document(&html);
                let text = document.root_element().text().collect::<Vec<_>>().join(" ");
                // Clean up whitespace
                let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
                (cleaned, "html".into())
            }
            "pdf" => {
                let bytes = std::fs::read(path).map_err(|e| format!("读取失败: {}", e))?;
                let text = pdf_extract::extract_text_from_mem(&bytes)
                    .map_err(|e| format!("PDF 解析失败: {}", e))?;
                (text, "pdf".into())
            }
            "docx" => {
                // Simple DOCX extraction: unzip and strip XML tags from word/document.xml
                let file = std::fs::File::open(path).map_err(|e| format!("打开失败: {}", e))?;
                let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("DOCX 解压失败: {}", e))?;
                let mut doc_xml = String::new();
                if let Ok(mut entry) = archive.by_name("word/document.xml") {
                    use std::io::Read;
                    entry.read_to_string(&mut doc_xml).map_err(|e| format!("读取 document.xml 失败: {}", e))?;
                }
                // Strip XML tags with regex
                let tag_re = regex::Regex::new(r"<[^>]+>").unwrap();
                let text = tag_re.replace_all(&doc_xml, " ").to_string();
                let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
                (cleaned, "docx".into())
            }
            _ => return Err(format!("不支持的文件格式: .{}", ext)),
        };

        let char_count = text.len();
        Ok(json!({
            "result": text,
            "text": text,
            "file_type": file_type,
            "path": path,
            "char_count": char_count,
        }))
    }
}
