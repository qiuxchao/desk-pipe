export interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  meta?: { position: { x: number; y: number } };
}

export interface WorkflowEdge {
  sourceNodeID: string;
  targetNodeID: string;
  sourcePortID?: string;
  targetPortID?: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  shortcut?: string;
  cron?: string;
  group?: string;
}

export interface WorkflowEvent {
  workflow_id: string;
  event_type:
    | "started"
    | "node_started"
    | "node_completed"
    | "node_failed"
    | "node_skipped"
    | "completed"
    | "failed"
    | "debug_pause";
  node_id?: string;
  data?: unknown;
  error?: string;
  timestamp?: number;
}

export interface ExecutionRecord {
  id: string;
  workflow_id: string;
  workflow_name: string;
  started_at: string;
  completed_at?: string;
  status: "running" | "completed" | "failed";
  events: WorkflowEvent[];
  result?: unknown;
}

export enum NodeType {
  Shell = "shell",
  Delay = "delay",
  Notification = "notification",
  ClipboardRead = "clipboard_read",
  ClipboardWrite = "clipboard_write",
  FileRead = "file_read",
  FileWrite = "file_write",
  FileCopy = "file_copy",
  FileMove = "file_move",
  HttpRequest = "http_request",
  Condition = "condition",
  Loop = "loop",
  SubWorkflow = "sub_workflow",
  ScreenshotFull = "screenshot_full",
  ScreenshotRegion = "screenshot_region",
  AiChat = "ai_chat",
  ImagePreview = "image_preview",
  TextProcess = "text_process",
  JsonProcess = "json_process",
  DataProcess = "data_process",
  RegexExtract = "regex_extract",
  EmailSend = "email_send",
  Code = "code",
  AppleScript = "applescript",
  OpenApp = "open_app",
  KeyboardType = "keyboard_type",
  UserInput = "user_input",
  FileWatch = "file_watch",
  // Phase 1 new nodes
  Comment = "comment",
  VariableSet = "variable_set",
  VariableGet = "variable_get",
  Database = "database",
  SqlQuery = "sql_query",
  Merge = "merge",
  BatchProcess = "batch_process",
  // AI nodes
  ImageGenerate = "image_generate",
  Tts = "tts",
  Stt = "stt",
  IntentRecognition = "intent_recognition",
  // Knowledge + triggers
  KnowledgeWrite = "knowledge_write",
  KnowledgeSearch = "knowledge_search",
  WebhookTrigger = "webhook_trigger",
  ResultDialog = "result_dialog",
  // Multi-agent
  Agent = "agent",
  // Processing nodes
  ListOperator = "list_operator",
  TemplateRender = "template_render",
  DocumentExtractor = "document_extractor",
  ParameterExtractor = "parameter_extractor",
  HumanReview = "human_review",
  Parallel = "parallel",
}

export interface AiProvider {
  id: string;
  name: string;
  provider_type: string; // "openai" | "claude"
  api_base: string;
  api_key: string;
  model: string;
  is_default: boolean;
}
