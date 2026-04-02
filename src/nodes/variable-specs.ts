import { NodeType } from "@/types/workflow";

/** Fields each node type can output */
export const NODE_OUTPUT_FIELDS: Record<string, { field: string; desc: string }[]> = {
  [NodeType.Shell]: [
    { field: "stdout", desc: "标准输出" },
    { field: "stderr", desc: "错误输出" },
    { field: "exit_code", desc: "退出码" },
  ],
  [NodeType.ClipboardRead]: [
    { field: "text", desc: "剪贴板文本" },
  ],
  [NodeType.ClipboardWrite]: [
    { field: "text", desc: "写入的文本" },
    { field: "written", desc: "是否成功" },
  ],
  [NodeType.FileRead]: [
    { field: "content", desc: "文件内容" },
    { field: "path", desc: "文件路径" },
    { field: "size", desc: "文件大小" },
  ],
  [NodeType.FileWrite]: [
    { field: "path", desc: "写入路径" },
    { field: "written", desc: "是否成功" },
  ],
  [NodeType.FileCopy]: [
    { field: "destination", desc: "目标路径" },
    { field: "copied", desc: "是否成功" },
  ],
  [NodeType.FileMove]: [
    { field: "destination", desc: "目标路径" },
    { field: "moved", desc: "是否成功" },
  ],
  [NodeType.HttpRequest]: [
    { field: "body", desc: "响应体" },
    { field: "status", desc: "状态码" },
    { field: "headers", desc: "响应头" },
  ],
  [NodeType.ScreenshotFull]: [
    { field: "path", desc: "截图路径" },
    { field: "width", desc: "宽度" },
    { field: "height", desc: "高度" },
  ],
  [NodeType.ScreenshotRegion]: [
    { field: "path", desc: "截图路径" },
    { field: "width", desc: "宽度" },
    { field: "height", desc: "高度" },
  ],
  [NodeType.AiChat]: [
    { field: "result", desc: "AI 回复" },
    { field: "text", desc: "回复文本" },
    { field: "model", desc: "使用模型" },
    { field: "input_mode", desc: "输入模式" },
  ],
  [NodeType.Condition]: [
    { field: "result", desc: "条件结果" },
  ],
  [NodeType.TextProcess]: [
    { field: "result", desc: "处理结果" },
  ],
  [NodeType.JsonProcess]: [
    { field: "result", desc: "处理结果" },
  ],
  [NodeType.DataProcess]: [
    { field: "result", desc: "处理结果" },
    { field: "count", desc: "数量" },
  ],
  [NodeType.RegexExtract]: [
    { field: "match", desc: "匹配结果" },
    { field: "matches", desc: "所有匹配" },
    { field: "groups", desc: "捕获组" },
    { field: "count", desc: "匹配数量" },
  ],
  [NodeType.Delay]: [
    { field: "delayed_ms", desc: "等待时长" },
  ],
  [NodeType.Loop]: [
    { field: "items", desc: "遍历结果" },
    { field: "total", desc: "总数" },
  ],
  [NodeType.ImagePreview]: [
    { field: "path", desc: "图片路径" },
  ],
  [NodeType.Notification]: [
    { field: "notification_sent", desc: "是否发送" },
    { field: "title", desc: "通知标题" },
  ],
  [NodeType.SubWorkflow]: [
    { field: "result", desc: "子流程结果" },
  ],
  [NodeType.EmailSend]: [
    { field: "sent", desc: "是否发送" },
    { field: "to", desc: "收件人" },
  ],
  [NodeType.Code]: [
    { field: "result", desc: "执行结果" },
    { field: "stdout", desc: "标准输出" },
    { field: "stderr", desc: "错误输出" },
  ],
  [NodeType.AppleScript]: [
    { field: "result", desc: "脚本结果" },
    { field: "text", desc: "返回文本" },
  ],
  [NodeType.OpenApp]: [
    { field: "result", desc: "操作结果" },
    { field: "app", desc: "应用名" },
  ],
  [NodeType.KeyboardType]: [
    { field: "result", desc: "操作结果" },
  ],
  [NodeType.UserInput]: [
    { field: "result", desc: "用户输入" },
    { field: "text", desc: "输入文本" },
    { field: "confirmed", desc: "是否确认" },
  ],
  [NodeType.FileWatch]: [
    { field: "event_type", desc: "事件类型" },
    { field: "path", desc: "变化路径" },
    { field: "paths", desc: "所有变化路径" },
    { field: "detected", desc: "是否检测到" },
  ],
  [NodeType.Comment]: [],
  [NodeType.VariableSet]: [
    { field: "key", desc: "变量名" },
    { field: "value", desc: "变量值" },
  ],
  [NodeType.VariableGet]: [
    { field: "result", desc: "变量值" },
    { field: "key", desc: "变量名" },
  ],
  [NodeType.Database]: [
    { field: "result", desc: "查询结果" },
    { field: "count", desc: "记录数" },
    { field: "affected_rows", desc: "影响行数" },
  ],
  [NodeType.SqlQuery]: [
    { field: "result", desc: "查询结果" },
    { field: "rows", desc: "行数据" },
    { field: "count", desc: "记录数" },
  ],
  [NodeType.Merge]: [
    { field: "result", desc: "合并结果" },
    { field: "count", desc: "来源数" },
  ],
  [NodeType.BatchProcess]: [
    { field: "results", desc: "批处理结果" },
    { field: "total", desc: "总数" },
  ],
  [NodeType.ImageGenerate]: [
    { field: "path", desc: "图片路径" },
    { field: "url", desc: "原始 URL" },
    { field: "prompt", desc: "生成提示" },
  ],
  [NodeType.Tts]: [
    { field: "path", desc: "音频路径" },
    { field: "text", desc: "原文本" },
    { field: "engine", desc: "引擎" },
  ],
  [NodeType.Stt]: [
    { field: "text", desc: "识别文字" },
    { field: "result", desc: "识别结果" },
    { field: "language", desc: "语言" },
  ],
  [NodeType.IntentRecognition]: [
    { field: "intent", desc: "识别意图" },
    { field: "result", desc: "意图名称" },
    { field: "text", desc: "原文本" },
  ],
  [NodeType.KnowledgeWrite]: [
    { field: "id", desc: "文档 ID" },
    { field: "collection", desc: "集合名" },
  ],
  [NodeType.KnowledgeSearch]: [
    { field: "results", desc: "搜索结果" },
    { field: "count", desc: "结果数" },
    { field: "query", desc: "查询内容" },
  ],
  [NodeType.WebhookTrigger]: [
    { field: "body", desc: "请求体" },
    { field: "method", desc: "请求方法" },
    { field: "headers", desc: "请求头" },
    { field: "query", desc: "查询参数" },
  ],
  [NodeType.ResultDialog]: [
    { field: "result", desc: "展示内容" },
    { field: "title", desc: "标题" },
    { field: "displayed", desc: "是否展示" },
  ],
  [NodeType.Agent]: [
    { field: "result", desc: "最终回复" },
    { field: "text", desc: "回复文本" },
    { field: "turns", desc: "对话轮数" },
    { field: "all_responses", desc: "所有回复" },
  ],
  [NodeType.ListOperator]: [
    { field: "result", desc: "操作结果" },
    { field: "items", desc: "结果列表" },
    { field: "count", desc: "数量" },
    { field: "operation", desc: "操作类型" },
  ],
  [NodeType.TemplateRender]: [
    { field: "result", desc: "渲染结果" },
    { field: "text", desc: "渲染文本" },
    { field: "template", desc: "模板" },
  ],
  [NodeType.DocumentExtractor]: [
    { field: "result", desc: "解析结果" },
    { field: "text", desc: "文本内容" },
    { field: "file_type", desc: "文件类型" },
    { field: "path", desc: "文件路径" },
    { field: "char_count", desc: "字符数" },
  ],
  [NodeType.ParameterExtractor]: [
    { field: "result", desc: "提取结果" },
    { field: "extracted", desc: "提取数据" },
    { field: "valid", desc: "是否有效" },
    { field: "missing_fields", desc: "缺失字段" },
    { field: "model", desc: "使用模型" },
  ],
  [NodeType.HumanReview]: [
    { field: "result", desc: "审核结果" },
    { field: "action", desc: "操作动作" },
    { field: "approved", desc: "是否通过" },
    { field: "title", desc: "审核标题" },
  ],
  [NodeType.Parallel]: [
    { field: "result", desc: "并行结果" },
    { field: "branches", desc: "各分支输出" },
  ],
};
