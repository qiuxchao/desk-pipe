export function JsonHighlight({ data, maxHeight }: { data: unknown; maxHeight?: string }) {
  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  // Simple regex-based highlighting
  const highlighted = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"([^"]+)"(?=\s*:)/g, '<span class="json-key">"$1"</span>') // keys
    .replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>') // string values
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>') // numbers
    .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>') // booleans
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>'); // null

  return (
    <pre
      className="text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed"
      style={{ maxHeight: maxHeight || "200px", overflow: "auto" }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}
