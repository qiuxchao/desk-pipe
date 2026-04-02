import type { Workflow } from "@/types/workflow";

export type TemplateCategory = "ai" | "file" | "system" | "dev" | "data";

export interface WorkflowTemplate {
  name: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  workflow: Omit<Workflow, "id">;
}

export const templateCategories: { key: TemplateCategory | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "ai", label: "AI 处理" },
  { key: "file", label: "文件自动化" },
  { key: "system", label: "系统任务" },
  { key: "dev", label: "开发工具" },
  { key: "data", label: "数据处理" },
];

export const categoryLabels: Record<TemplateCategory, string> = {
  ai: "AI 处理",
  file: "文件自动化",
  system: "系统任务",
  dev: "开发工具",
  data: "数据处理",
};

export const templates: WorkflowTemplate[] = [
  // ==================== Existing templates (categorized) ====================
  {
    name: "截图 OCR 识别",
    description: "截屏 → AI 识别文字 → 复制到剪贴板 → 通知",
    icon: "sparkles",
    category: "ai",
    workflow: {
      name: "截图 OCR 识别",
      nodes: [
        { id: "scr_1", type: "screenshot_full", data: { title: "截屏" }, meta: { position: { x: 300, y: 220 } } },
        { id: "ai_1", type: "ai_chat", data: { title: "AI OCR", action: "ocr", image_path: "{{prev.path}}", prompt: "" }, meta: { position: { x: 540, y: 220 } } },
        { id: "clipw_1", type: "clipboard_write", data: { title: "复制结果", text: "{{prev.result}}" }, meta: { position: { x: 800, y: 220 } } },
        { id: "notif_1", type: "notification", data: { title: "OCR 完成", body: "识别结果已复制到剪贴板" }, meta: { position: { x: 1060, y: 220 } } },
      ],
      edges: [
        { sourceNodeID: "scr_1", targetNodeID: "ai_1" },
        { sourceNodeID: "ai_1", targetNodeID: "clipw_1" },
        { sourceNodeID: "clipw_1", targetNodeID: "notif_1" },
      ],
    },
  },
  {
    name: "截图翻译",
    description: "截屏 → AI 翻译图中文字 → 复制到剪贴板",
    icon: "sparkles",
    category: "ai",
    workflow: {
      name: "截图翻译",
      nodes: [
        { id: "scr_1", type: "screenshot_full", data: { title: "截屏" }, meta: { position: { x: 300, y: 220 } } },
        { id: "ai_1", type: "ai_chat", data: { title: "AI 翻译", action: "translate", image_path: "{{prev.path}}", prompt: "", target_language: "中文" }, meta: { position: { x: 540, y: 220 } } },
        { id: "clipw_1", type: "clipboard_write", data: { title: "复制翻译", text: "{{prev.result}}" }, meta: { position: { x: 800, y: 220 } } },
        { id: "notif_1", type: "notification", data: { title: "翻译完成", body: "翻译结果已复制到剪贴板" }, meta: { position: { x: 1060, y: 220 } } },
      ],
      edges: [
        { sourceNodeID: "scr_1", targetNodeID: "ai_1" },
        { sourceNodeID: "ai_1", targetNodeID: "clipw_1" },
        { sourceNodeID: "clipw_1", targetNodeID: "notif_1" },
      ],
    },
  },
  {
    name: "剪贴板文本转大写",
    description: "读取剪贴板 → 转大写 → 写回剪贴板",
    icon: "clipboard",
    category: "data",
    workflow: {
      name: "剪贴板文本转大写",
      nodes: [
        { id: "clipr_1", type: "clipboard_read", data: { title: "读取剪贴板" }, meta: { position: { x: 300, y: 220 } } },
        { id: "shell_1", type: "shell", data: { title: "转大写", command: "echo '{{prev.text}}' | tr '[:lower:]' '[:upper:]'" }, meta: { position: { x: 550, y: 220 } } },
        { id: "clipw_1", type: "clipboard_write", data: { title: "写回剪贴板", text: "{{prev.stdout}}" }, meta: { position: { x: 800, y: 220 } } },
        { id: "notif_1", type: "notification", data: { title: "完成", body: "文本已转为大写" }, meta: { position: { x: 1060, y: 220 } } },
      ],
      edges: [
        { sourceNodeID: "clipr_1", targetNodeID: "shell_1" },
        { sourceNodeID: "shell_1", targetNodeID: "clipw_1" },
        { sourceNodeID: "clipw_1", targetNodeID: "notif_1" },
      ],
    },
  },
  {
    name: "API 健康检查",
    description: "请求接口 → 判断状态码 → 成功/失败通知",
    icon: "globe",
    category: "dev",
    workflow: {
      name: "API 健康检查",
      nodes: [
        { id: "http_1", type: "http_request", data: { title: "请求接口", method: "GET", url: "https://httpbin.org/status/200", body: "" }, meta: { position: { x: 280, y: 220 } } },
        { id: "cond_1", type: "condition", data: { title: "状态正常?", expression: "{{prev.status}}", operator: "eq", value: "200" }, meta: { position: { x: 560, y: 220 } } },
        { id: "notif_ok", type: "notification", data: { title: "服务正常", body: "接口返回 200" }, meta: { position: { x: 860, y: 120 } } },
        { id: "notif_fail", type: "notification", data: { title: "服务异常", body: "接口返回 {{prev.status}}" }, meta: { position: { x: 860, y: 340 } } },
      ],
      edges: [
        { sourceNodeID: "http_1", targetNodeID: "cond_1" },
        { sourceNodeID: "cond_1", targetNodeID: "notif_ok", sourcePortID: "true" },
        { sourceNodeID: "cond_1", targetNodeID: "notif_fail", sourcePortID: "false" },
      ],
    },
  },
  {
    name: "每日系统信息",
    description: "获取系统信息 → 写入日志文件 → 通知",
    icon: "terminal",
    category: "system",
    workflow: {
      name: "每日系统信息",
      nodes: [
        { id: "shell_1", type: "shell", data: { title: "获取信息", command: "echo \"$(date '+%Y-%m-%d %H:%M') | CPU: $(sysctl -n machdep.cpu.brand_string) | Mem: $(vm_stat | head -2)\"" }, meta: { position: { x: 340, y: 220 } } },
        { id: "fwrite_1", type: "file_write", data: { title: "写入日志", path: "/tmp/deskpipe_sysinfo.log", content: "{{prev.stdout}}\n" }, meta: { position: { x: 640, y: 220 } } },
        { id: "notif_1", type: "notification", data: { title: "系统信息", body: "{{prev.stdout}}" }, meta: { position: { x: 920, y: 220 } } },
      ],
      edges: [
        { sourceNodeID: "shell_1", targetNodeID: "fwrite_1" },
        { sourceNodeID: "fwrite_1", targetNodeID: "notif_1" },
      ],
    },
  },
  {
    name: "截图 + AI 解释",
    description: "截屏 → AI 解释图片内容 → 通知结果",
    icon: "sparkles",
    category: "ai",
    workflow: {
      name: "截图 AI 解释",
      nodes: [
        { id: "scr_1", type: "screenshot_full", data: { title: "截屏" }, meta: { position: { x: 300, y: 220 } } },
        { id: "ai_1", type: "ai_chat", data: { title: "AI 解释", action: "explain", image_path: "{{prev.path}}", prompt: "" }, meta: { position: { x: 540, y: 220 } } },
        { id: "notif_1", type: "notification", data: { title: "AI 分析", body: "{{prev.result}}" }, meta: { position: { x: 800, y: 220 } } },
      ],
      edges: [
        { sourceNodeID: "scr_1", targetNodeID: "ai_1" },
        { sourceNodeID: "ai_1", targetNodeID: "notif_1" },
      ],
    },
  },

  // ==================== AI Processing (ai) ====================
  {
    name: "AI 代码审查",
    description: "读取剪贴板代码 → AI 审查 → 弹窗展示结果",
    icon: "sparkles",
    category: "ai",
    workflow: {
      name: "AI 代码审查",
      nodes: [
        { id: "clipr_1", type: "clipboard_read", data: { title: "读取代码" }, meta: { position: { x: 300, y: 200 } } },
        { id: "ai_1", type: "ai_chat", data: { title: "AI 代码审查", action: "code_review", prompt: "请审查以下代码并给出改进建议:\n{{prev.text}}" }, meta: { position: { x: 600, y: 200 } } },
        { id: "dialog_1", type: "result_dialog", data: { title: "代码审查结果", content: "{{prev.result}}" }, meta: { position: { x: 900, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "clipr_1", targetNodeID: "ai_1" },
        { sourceNodeID: "ai_1", targetNodeID: "dialog_1" },
      ],
    },
  },
  {
    name: "AI 图片描述",
    description: "截屏 → AI 描述图片内容 → 发送通知",
    icon: "sparkles",
    category: "ai",
    workflow: {
      name: "AI 图片描述",
      nodes: [
        { id: "scr_1", type: "screenshot_full", data: { title: "截屏" }, meta: { position: { x: 300, y: 200 } } },
        { id: "ai_1", type: "ai_chat", data: { title: "AI 描述", action: "explain", image_path: "{{prev.path}}", prompt: "请详细描述这张图片的内容" }, meta: { position: { x: 600, y: 200 } } },
        { id: "notif_1", type: "notification", data: { title: "图片描述", body: "{{prev.result}}" }, meta: { position: { x: 900, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "scr_1", targetNodeID: "ai_1" },
        { sourceNodeID: "ai_1", targetNodeID: "notif_1" },
      ],
    },
  },
  {
    name: "多步翻译",
    description: "剪贴板文本 → 翻译为英文 → 翻译为日文 → 写回剪贴板",
    icon: "sparkles",
    category: "ai",
    workflow: {
      name: "多步翻译",
      nodes: [
        { id: "clipr_1", type: "clipboard_read", data: { title: "读取文本" }, meta: { position: { x: 300, y: 200 } } },
        { id: "ai_en", type: "ai_chat", data: { title: "翻译为英文", action: "translate", prompt: "请将以下文本翻译为英文:\n{{prev.text}}", target_language: "English" }, meta: { position: { x: 600, y: 200 } } },
        { id: "ai_jp", type: "ai_chat", data: { title: "翻译为日文", action: "translate", prompt: "请将以下文本翻译为日文:\n{{prev.result}}", target_language: "Japanese" }, meta: { position: { x: 900, y: 200 } } },
        { id: "clipw_1", type: "clipboard_write", data: { title: "写回剪贴板", text: "{{prev.result}}" }, meta: { position: { x: 1200, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "clipr_1", targetNodeID: "ai_en" },
        { sourceNodeID: "ai_en", targetNodeID: "ai_jp" },
        { sourceNodeID: "ai_jp", targetNodeID: "clipw_1" },
      ],
    },
  },

  // ==================== File Automation (file) ====================
  {
    name: "文件备份",
    description: "读取文件 → 写入备份文件(添加时间戳)",
    icon: "file",
    category: "file",
    workflow: {
      name: "文件备份",
      nodes: [
        { id: "fread_1", type: "file_read", data: { title: "读取文件", path: "/tmp/example.txt" }, meta: { position: { x: 300, y: 200 } } },
        { id: "fwrite_1", type: "file_write", data: { title: "写入备份", path: "/tmp/example_backup_{{timestamp}}.txt", content: "{{prev.content}}" }, meta: { position: { x: 600, y: 200 } } },
        { id: "notif_1", type: "notification", data: { title: "备份完成", body: "文件已备份" }, meta: { position: { x: 900, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "fread_1", targetNodeID: "fwrite_1" },
        { sourceNodeID: "fwrite_1", targetNodeID: "notif_1" },
      ],
    },
  },
  {
    name: "CSV 转 JSON",
    description: "读取 CSV 文件 → 转换为 JSON → 写入文件",
    icon: "file",
    category: "file",
    workflow: {
      name: "CSV 转 JSON",
      nodes: [
        { id: "fread_1", type: "file_read", data: { title: "读取 CSV", path: "/tmp/data.csv" }, meta: { position: { x: 300, y: 200 } } },
        { id: "json_1", type: "json_process", data: { title: "CSV 转 JSON", action: "csv_to_json", input: "{{prev.content}}" }, meta: { position: { x: 600, y: 200 } } },
        { id: "fwrite_1", type: "file_write", data: { title: "写入 JSON", path: "/tmp/data.json", content: "{{prev.result}}" }, meta: { position: { x: 900, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "fread_1", targetNodeID: "json_1" },
        { sourceNodeID: "json_1", targetNodeID: "fwrite_1" },
      ],
    },
  },

  // ==================== System Tasks (system) ====================
  {
    name: "系统信息监控",
    description: "检查磁盘空间 → 判断是否超过阈值 → 通知",
    icon: "terminal",
    category: "system",
    workflow: {
      name: "系统信息监控",
      nodes: [
        { id: "shell_1", type: "shell", data: { title: "检查磁盘", command: "df -h / | tail -1 | awk '{print $5}' | tr -d '%'" }, meta: { position: { x: 300, y: 200 } } },
        { id: "cond_1", type: "condition", data: { title: "磁盘 > 80%?", expression: "{{prev.stdout}}", operator: "gt", value: "80" }, meta: { position: { x: 600, y: 200 } } },
        { id: "notif_warn", type: "notification", data: { title: "磁盘空间告警", body: "磁盘使用率已超过 80%: {{prev.stdout}}%" }, meta: { position: { x: 900, y: 100 } } },
        { id: "notif_ok", type: "notification", data: { title: "磁盘正常", body: "磁盘使用率: {{prev.stdout}}%" }, meta: { position: { x: 900, y: 320 } } },
      ],
      edges: [
        { sourceNodeID: "shell_1", targetNodeID: "cond_1" },
        { sourceNodeID: "cond_1", targetNodeID: "notif_warn", sourcePortID: "true" },
        { sourceNodeID: "cond_1", targetNodeID: "notif_ok", sourcePortID: "false" },
      ],
    },
  },
  {
    name: "应用启动链",
    description: "打开终端 → 延迟 → 打开 VS Code",
    icon: "terminal",
    category: "system",
    workflow: {
      name: "应用启动链",
      nodes: [
        { id: "app_1", type: "open_app", data: { title: "打开终端", app_name: "Terminal" }, meta: { position: { x: 300, y: 200 } } },
        { id: "delay_1", type: "delay", data: { title: "等待 1 秒", ms: 1000 }, meta: { position: { x: 600, y: 200 } } },
        { id: "app_2", type: "open_app", data: { title: "打开 VS Code", app_name: "Visual Studio Code" }, meta: { position: { x: 900, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "app_1", targetNodeID: "delay_1" },
        { sourceNodeID: "delay_1", targetNodeID: "app_2" },
      ],
    },
  },

  // ==================== Development (dev) ====================
  {
    name: "Git 状态检查",
    description: "执行 git status → 整理输出 → 通知结果",
    icon: "terminal",
    category: "dev",
    workflow: {
      name: "Git 状态检查",
      nodes: [
        { id: "shell_1", type: "shell", data: { title: "Git Status", command: "git status --short" }, meta: { position: { x: 300, y: 200 } } },
        { id: "text_1", type: "text_process", data: { title: "整理输出", action: "trim", input: "{{prev.stdout}}" }, meta: { position: { x: 600, y: 200 } } },
        { id: "notif_1", type: "notification", data: { title: "Git 状态", body: "{{prev.result}}" }, meta: { position: { x: 900, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "shell_1", targetNodeID: "text_1" },
        { sourceNodeID: "text_1", targetNodeID: "notif_1" },
      ],
    },
  },
  {
    name: "API 测试",
    description: "发送 HTTP 请求 → 检查状态码 → 通知结果",
    icon: "globe",
    category: "dev",
    workflow: {
      name: "API 测试",
      nodes: [
        { id: "http_1", type: "http_request", data: { title: "发送请求", method: "GET", url: "https://httpbin.org/get", body: "" }, meta: { position: { x: 300, y: 200 } } },
        { id: "cond_1", type: "condition", data: { title: "状态 200?", expression: "{{prev.status}}", operator: "eq", value: "200" }, meta: { position: { x: 600, y: 200 } } },
        { id: "notif_ok", type: "notification", data: { title: "API 正常", body: "请求成功，状态码 200" }, meta: { position: { x: 900, y: 100 } } },
        { id: "notif_fail", type: "notification", data: { title: "API 异常", body: "请求失败，状态码: {{prev.status}}" }, meta: { position: { x: 900, y: 320 } } },
      ],
      edges: [
        { sourceNodeID: "http_1", targetNodeID: "cond_1" },
        { sourceNodeID: "cond_1", targetNodeID: "notif_ok", sourcePortID: "true" },
        { sourceNodeID: "cond_1", targetNodeID: "notif_fail", sourcePortID: "false" },
      ],
    },
  },

  // ==================== Data Processing (data) ====================
  {
    name: "JSON 转换管道",
    description: "剪贴板 → JSON 解析 → 数据排序 → 写回剪贴板",
    icon: "clipboard",
    category: "data",
    workflow: {
      name: "JSON 转换管道",
      nodes: [
        { id: "clipr_1", type: "clipboard_read", data: { title: "读取数据" }, meta: { position: { x: 300, y: 200 } } },
        { id: "json_1", type: "json_process", data: { title: "JSON 解析", action: "parse", input: "{{prev.text}}" }, meta: { position: { x: 600, y: 200 } } },
        { id: "data_1", type: "data_process", data: { title: "数据排序", action: "sort", input: "{{prev.result}}" }, meta: { position: { x: 900, y: 200 } } },
        { id: "clipw_1", type: "clipboard_write", data: { title: "写回剪贴板", text: "{{prev.result}}" }, meta: { position: { x: 1200, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "clipr_1", targetNodeID: "json_1" },
        { sourceNodeID: "json_1", targetNodeID: "data_1" },
        { sourceNodeID: "data_1", targetNodeID: "clipw_1" },
      ],
    },
  },
  {
    name: "正则数据提取",
    description: "剪贴板 → 正则提取 → 文本处理 → 通知结果",
    icon: "clipboard",
    category: "data",
    workflow: {
      name: "正则数据提取",
      nodes: [
        { id: "clipr_1", type: "clipboard_read", data: { title: "读取文本" }, meta: { position: { x: 300, y: 200 } } },
        { id: "regex_1", type: "regex_extract", data: { title: "正则提取", pattern: "\\d+", input: "{{prev.text}}" }, meta: { position: { x: 600, y: 200 } } },
        { id: "text_1", type: "text_process", data: { title: "文本处理", action: "join", separator: ", ", input: "{{prev.matches}}" }, meta: { position: { x: 900, y: 200 } } },
        { id: "notif_1", type: "notification", data: { title: "提取结果", body: "{{prev.result}}" }, meta: { position: { x: 1200, y: 200 } } },
      ],
      edges: [
        { sourceNodeID: "clipr_1", targetNodeID: "regex_1" },
        { sourceNodeID: "regex_1", targetNodeID: "text_1" },
        { sourceNodeID: "text_1", targetNodeID: "notif_1" },
      ],
    },
  },
];
