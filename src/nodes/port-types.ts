import { NodeType } from "@/types/workflow";

/**
 * Port data types for type-safe connections.
 * A connection is valid if the output type matches the input type,
 * or if either side is "any".
 */
export type PortDataType = "any" | "text" | "image_path" | "json" | "number" | "boolean" | "array" | "file_path";

export interface NodePortSpec {
  category: "input" | "middle" | "output";
  inputType?: PortDataType;  // What this node accepts (undefined = no input port)
  outputType?: PortDataType; // What this node produces (undefined = no output port)
}

/**
 * Define port specs for each node type.
 * - input nodes: only outputType (sources)
 * - middle nodes: both inputType and outputType (processors)
 * - output nodes: only inputType (sinks)
 */
export const NODE_PORT_SPECS: Record<string, NodePortSpec> = {
  // === Input nodes (sources) ===
  [NodeType.ScreenshotFull]: { category: "input", outputType: "image_path" },
  [NodeType.ScreenshotRegion]: { category: "input", outputType: "image_path" },
  [NodeType.ClipboardRead]: { category: "input", outputType: "text" },

  // === Output nodes (sinks) ===
  [NodeType.Notification]: { category: "output", inputType: "any" },
  [NodeType.ImagePreview]: { category: "output", inputType: "image_path" },
  [NodeType.ClipboardWrite]: { category: "output", inputType: "text" },

  // === Middle nodes (processors) ===
  [NodeType.Shell]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.Delay]: { category: "middle", inputType: "any", outputType: "any" },
  [NodeType.FileRead]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.FileWrite]: { category: "middle", inputType: "text", outputType: "file_path" },
  [NodeType.FileCopy]: { category: "middle", inputType: "any", outputType: "file_path" },
  [NodeType.FileMove]: { category: "middle", inputType: "any", outputType: "file_path" },
  [NodeType.HttpRequest]: { category: "middle", inputType: "any", outputType: "json" },
  [NodeType.Condition]: { category: "middle", inputType: "any", outputType: "boolean" },
  [NodeType.Loop]: { category: "middle", inputType: "array", outputType: "array" },
  [NodeType.SubWorkflow]: { category: "middle", inputType: "any", outputType: "any" },
  [NodeType.AiChat]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.TextProcess]: { category: "middle", inputType: "text", outputType: "text" },
  [NodeType.JsonProcess]: { category: "middle", inputType: "text", outputType: "json" },
  [NodeType.DataProcess]: { category: "middle", inputType: "array", outputType: "any" },
  [NodeType.RegexExtract]: { category: "middle", inputType: "text", outputType: "text" },
  [NodeType.EmailSend]: { category: "output", inputType: "text" },
  [NodeType.Code]: { category: "middle", inputType: "any", outputType: "any" },
  [NodeType.AppleScript]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.OpenApp]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.KeyboardType]: { category: "output", inputType: "text" },
  [NodeType.UserInput]: { category: "input", outputType: "text" },
  [NodeType.FileWatch]: { category: "input", outputType: "file_path" },

  // === New nodes ===
  [NodeType.Comment]: { category: "middle" as const },
  [NodeType.VariableSet]: { category: "middle", inputType: "any", outputType: "any" },
  [NodeType.VariableGet]: { category: "middle", inputType: "any", outputType: "any" },
  [NodeType.Database]: { category: "middle", inputType: "any", outputType: "json" },
  [NodeType.SqlQuery]: { category: "middle", inputType: "any", outputType: "json" },
  [NodeType.Merge]: { category: "middle", inputType: "any", outputType: "json" },
  [NodeType.BatchProcess]: { category: "middle", inputType: "array", outputType: "array" },
  [NodeType.ImageGenerate]: { category: "middle", inputType: "text", outputType: "image_path" },
  [NodeType.Tts]: { category: "middle", inputType: "text", outputType: "file_path" },
  [NodeType.Stt]: { category: "middle", inputType: "file_path", outputType: "text" },
  [NodeType.IntentRecognition]: { category: "middle", inputType: "text", outputType: "text" },
  [NodeType.KnowledgeWrite]: { category: "middle", inputType: "text", outputType: "json" },
  [NodeType.KnowledgeSearch]: { category: "middle", inputType: "text", outputType: "json" },
  [NodeType.WebhookTrigger]: { category: "input", outputType: "json" },
  [NodeType.ResultDialog]: { category: "output", inputType: "text" },
  [NodeType.Agent]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.ListOperator]: { category: "middle", inputType: "array", outputType: "array" },
  [NodeType.TemplateRender]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.DocumentExtractor]: { category: "middle", inputType: "file_path", outputType: "text" },
  [NodeType.ParameterExtractor]: { category: "middle", inputType: "text", outputType: "json" },
  [NodeType.HumanReview]: { category: "middle", inputType: "any", outputType: "text" },
  [NodeType.Parallel]: { category: "middle", inputType: "any", outputType: "json" },
};

/** Check if two port types are compatible */
export function areTypesCompatible(outputType: PortDataType, inputType: PortDataType): boolean {
  if (outputType === "any" || inputType === "any") return true;
  if (outputType === inputType) return true;
  // file_path and image_path are both path types
  if ((outputType === "file_path" || outputType === "image_path") &&
      (inputType === "file_path" || inputType === "image_path")) return true;
  // text is compatible with most things
  if (outputType === "text" && (inputType === "json" || inputType === "array")) return true;
  if (outputType === "json" && inputType === "text") return true;
  return false;
}

/** Node categories for the panel */
export const NODE_CATEGORIES = [
  {
    label: "输入",
    description: "数据来源",
    types: [NodeType.ScreenshotFull, NodeType.ScreenshotRegion, NodeType.ClipboardRead, NodeType.UserInput, NodeType.FileWatch, NodeType.WebhookTrigger],
  },
  {
    label: "处理",
    description: "数据转换",
    types: [NodeType.Shell, NodeType.AiChat, NodeType.Agent, NodeType.TextProcess, NodeType.JsonProcess, NodeType.DataProcess, NodeType.HttpRequest, NodeType.RegexExtract, NodeType.Code, NodeType.AppleScript, NodeType.ImageGenerate, NodeType.Tts, NodeType.Stt, NodeType.IntentRecognition, NodeType.ListOperator, NodeType.TemplateRender, NodeType.DocumentExtractor, NodeType.ParameterExtractor],
  },
  {
    label: "文件",
    description: "文件操作",
    types: [NodeType.FileRead, NodeType.FileWrite, NodeType.FileCopy, NodeType.FileMove],
  },
  {
    label: "流程控制",
    description: "逻辑编排",
    types: [NodeType.Condition, NodeType.Loop, NodeType.Delay, NodeType.SubWorkflow, NodeType.VariableSet, NodeType.VariableGet, NodeType.Merge, NodeType.BatchProcess, NodeType.HumanReview, NodeType.Parallel, NodeType.Comment],
  },
  {
    label: "系统",
    description: "系统交互",
    types: [NodeType.OpenApp, NodeType.KeyboardType, NodeType.AppleScript],
  },
  {
    label: "输出",
    description: "结果展示",
    types: [NodeType.Notification, NodeType.ClipboardWrite, NodeType.ImagePreview, NodeType.EmailSend, NodeType.ResultDialog],
  },
  {
    label: "数据",
    description: "数据存储与检索",
    types: [NodeType.Database, NodeType.SqlQuery, NodeType.KnowledgeWrite, NodeType.KnowledgeSearch],
  },
];
