import { nanoid } from "nanoid";
import { Field, type WorkflowNodeRegistry } from "@flowgram.ai/free-layout-editor";
import { NodeType } from "@/types/workflow";
import { NODE_PORT_SPECS } from "@/nodes/port-types";
import {
  TitleField, TextInput, TextArea, SelectField, FilePathInput,
  InlineRow, InlineSelect, ErrorStrategySelect,
  NodeSectionDivider, CheckboxField,
} from "@/nodes/form-components";
import { AiPresetSelector } from "@/components/AiPresetSelector";

function portsFor(type: string) {
  const spec = NODE_PORT_SPECS[type];
  if (!spec) return [{ type: "input" as const }, { type: "output" as const }];
  const ports: { type: "input" | "output" }[] = [];
  if (spec.inputType) ports.push({ type: "input" });
  if (spec.outputType) ports.push({ type: "output" });
  return ports;
}

export const nodeRegistries: WorkflowNodeRegistry[] = [
  // ===== Shell =====
  {
    type: NodeType.Shell,
    meta: { defaultPorts: portsFor(NodeType.Shell) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-shell" />
          <TextArea name="command" label="命令" placeholder="echo 'hello'" rows={2} mono />
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `shell_${nanoid(5)}`, type: NodeType.Shell,
      data: { title: "Shell 命令", command: "echo 'Hello!'", on_error: "stop" },
    }),
  },

  // ===== Delay =====
  {
    type: NodeType.Delay,
    meta: { defaultPorts: portsFor(NodeType.Delay) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-delay" />
          <TextInput name="duration_ms" label="等待时间 (毫秒)" placeholder="1000" />
        </>
      ),
    },
    onAdd: () => ({
      id: `delay_${nanoid(5)}`, type: NodeType.Delay,
      data: { title: "延时", duration_ms: 1000 },
    }),
  },

  // ===== Notification =====
  {
    type: NodeType.Notification,
    meta: { defaultPorts: portsFor(NodeType.Notification) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-notification" />
          <TextInput name="title" label="标题" placeholder="通知标题" />
          <TextInput name="body" label="内容" placeholder="{{prev.result}}" />
        </>
      ),
    },
    onAdd: () => ({
      id: `notif_${nanoid(5)}`, type: NodeType.Notification,
      data: { title: "通知", body: "完成" },
    }),
  },

  // ===== Clipboard Read =====
  {
    type: NodeType.ClipboardRead,
    meta: { defaultPorts: portsFor(NodeType.ClipboardRead) },
    formMeta: { render: () => <TitleField className="node-clipboard-read" /> },
    onAdd: () => ({
      id: `clipr_${nanoid(5)}`, type: NodeType.ClipboardRead,
      data: { title: "读取剪贴板" },
    }),
  },

  // ===== Clipboard Write =====
  {
    type: NodeType.ClipboardWrite,
    meta: { defaultPorts: portsFor(NodeType.ClipboardWrite) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-clipboard-write" />
          <TextArea name="text" label="写入内容" placeholder="{{prev.result}}" rows={2} />
        </>
      ),
    },
    onAdd: () => ({
      id: `clipw_${nanoid(5)}`, type: NodeType.ClipboardWrite,
      data: { title: "写入剪贴板", text: "{{prev.text}}" },
    }),
  },

  // ===== File Read =====
  {
    type: NodeType.FileRead,
    meta: { defaultPorts: portsFor(NodeType.FileRead) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-file-read" />
          <FilePathInput name="path" label="文件路径" placeholder="/path/to/file 或 {{prev.path}}" />
        </>
      ),
    },
    onAdd: () => ({
      id: `fread_${nanoid(5)}`, type: NodeType.FileRead,
      data: { title: "读取文件", path: "" },
    }),
  },

  // ===== File Write =====
  {
    type: NodeType.FileWrite,
    meta: { defaultPorts: portsFor(NodeType.FileWrite) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-file-write" />
          <FilePathInput name="path" label="保存路径" saveMode />
          <TextArea name="content" label="写入内容" placeholder="{{prev.stdout}}" rows={2} />
        </>
      ),
    },
    onAdd: () => ({
      id: `fwrite_${nanoid(5)}`, type: NodeType.FileWrite,
      data: { title: "写入文件", path: "", content: "{{prev.stdout}}" },
    }),
  },

  // ===== File Copy =====
  {
    type: NodeType.FileCopy,
    meta: { defaultPorts: portsFor(NodeType.FileCopy) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-file-copy" />
          <FilePathInput name="source" label="源文件" />
          <FilePathInput name="destination" label="目标路径" saveMode />
        </>
      ),
    },
    onAdd: () => ({
      id: `fcopy_${nanoid(5)}`, type: NodeType.FileCopy,
      data: { title: "复制文件", source: "", destination: "" },
    }),
  },

  // ===== File Move =====
  {
    type: NodeType.FileMove,
    meta: { defaultPorts: portsFor(NodeType.FileMove) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-file-move" />
          <FilePathInput name="source" label="源文件" />
          <FilePathInput name="destination" label="目标路径" saveMode />
        </>
      ),
    },
    onAdd: () => ({
      id: `fmove_${nanoid(5)}`, type: NodeType.FileMove,
      data: { title: "移动文件", source: "", destination: "" },
    }),
  },

  // ===== HTTP Request =====
  {
    type: NodeType.HttpRequest,
    meta: { defaultPorts: portsFor(NodeType.HttpRequest) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-http-request" />
          <InlineRow>
            <InlineSelect name="method" width={75} options={[
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "PATCH", label: "PATCH" },
              { value: "DELETE", label: "DEL" },
            ]} />
            <Field<string> name="url"><input placeholder="https://api.example.com" className="font-mono" style={{ flex: 1 }} /></Field>
          </InlineRow>
          <TextArea name="body" label="请求体" placeholder='{"key": "value"}' rows={3} mono />
          <TextInput name="headers" label="请求头 (JSON)" placeholder='{"Authorization": "Bearer ..."}' mono />
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `http_${nanoid(5)}`, type: NodeType.HttpRequest,
      data: { title: "HTTP 请求", method: "GET", url: "", body: "", headers: "", on_error: "stop" },
    }),
  },

  // ===== Condition =====
  {
    type: NodeType.Condition,
    meta: {
      defaultPorts: [{ type: "input" }, { type: "output" }, { type: "output" }],
    },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-condition" />
          <TextInput name="expression" label="表达式" placeholder="{{prev.exit_code}}" mono />
          <SelectField name="operator" label="运算符" options={[
            { value: "eq", label: "等于 (==)" },
            { value: "neq", label: "不等于 (!=)" },
            { value: "contains", label: "包含" },
            { value: "gt", label: "大于 (>)" },
            { value: "lt", label: "小于 (<)" },
            { value: "empty", label: "为空" },
            { value: "not_empty", label: "不为空" },
            { value: "llm", label: "AI 判断" },
          ]} />
          <TextInput name="value" label="比较值 / AI 条件描述" placeholder="0" />
          <NodeSectionDivider label="AI 判断配置（operator 为 AI 判断时）">
            <AiPresetSelector />
            <TextInput name="model" label="模型" placeholder="gpt-4o-mini" />
          </NodeSectionDivider>
          <div className="node-condition-ports">
            <span className="port-true">✓ 真</span>
            <span className="port-false">✗ 假</span>
          </div>
        </>
      ),
    },
    onAdd: () => ({
      id: `cond_${nanoid(5)}`, type: NodeType.Condition,
      data: { title: "条件分支", expression: "{{prev.exit_code}}", operator: "eq", value: "0", provider_id: "", model: "" },
    }),
  },

  // ===== Loop =====
  {
    type: NodeType.Loop,
    meta: { defaultPorts: portsFor(NodeType.Loop) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-loop" />
          <TextArea name="items" label="遍历数据" placeholder='[1, 2, 3] 或 逗号分隔' rows={2} mono />
        </>
      ),
    },
    onAdd: () => ({
      id: `loop_${nanoid(5)}`, type: NodeType.Loop,
      data: { title: "循环", items: "[1, 2, 3]" },
    }),
  },

  // ===== Sub Workflow =====
  {
    type: NodeType.SubWorkflow,
    meta: { defaultPorts: portsFor(NodeType.SubWorkflow) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-sub-workflow" />
          <TextInput name="workflow_id" label="工作流 ID" placeholder="wf_xxxxx" mono />
        </>
      ),
    },
    onAdd: () => ({
      id: `sub_${nanoid(5)}`, type: NodeType.SubWorkflow,
      data: { title: "子工作流", workflow_id: "" },
    }),
  },

  // ===== Screenshot Full =====
  {
    type: NodeType.ScreenshotFull,
    meta: { defaultPorts: portsFor(NodeType.ScreenshotFull) },
    formMeta: { render: () => <TitleField className="node-screenshot-full" /> },
    onAdd: () => ({
      id: `scr_${nanoid(5)}`, type: NodeType.ScreenshotFull,
      data: { title: "全屏截图" },
    }),
  },

  // ===== Screenshot Region (interactive overlay) =====
  {
    type: NodeType.ScreenshotRegion,
    meta: { defaultPorts: portsFor(NodeType.ScreenshotRegion) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-screenshot-region" />
          <div className="node-field">
            <span style={{ fontSize: 11, color: "var(--node-label-color)" }}>
              运行时弹出截图工具，支持框选和标注
            </span>
          </div>
        </>
      ),
    },
    onAdd: () => ({
      id: `scrr_${nanoid(5)}`, type: NodeType.ScreenshotRegion,
      data: { title: "区域截图" },
    }),
  },

  // ===== AI Chat =====
  {
    type: NodeType.AiChat,
    meta: { defaultPorts: portsFor(NodeType.AiChat) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-ai-chat" />
          <AiPresetSelector />
          <SelectField name="action" label="操作" options={[
            { value: "custom", label: "自定义 Prompt" },
            { value: "summarize", label: "总结" },
            { value: "translate", label: "翻译" },
            { value: "rewrite", label: "改写润色" },
            { value: "code_review", label: "代码审查" },
            { value: "extract", label: "信息提取" },
            { value: "ocr", label: "OCR 文字识别" },
            { value: "explain", label: "解释图片" },
          ]} />
          <TextArea name="prompt" label="自定义 Prompt" placeholder="输入你的提示词..." rows={3} />
          <TextArea name="text" label="用户输入" placeholder="直接输入文本，或使用变量引用上游输出" rows={2} />
          <TextInput name="image_path" label="图片路径（可选）" placeholder="留空则为纯文本模式" mono />
          <NodeSectionDivider label="API 配置">
            <TextInput name="model" label="模型" placeholder="gpt-4o" />
            <CheckboxField name="streaming" label="流式输出" />
            <CheckboxField name="use_structured_output" label="结构化输出 (JSON)" />
            <TextArea name="json_schema" label="JSON Schema" placeholder='{"type":"object","properties":{"name":{"type":"string"}}}' rows={3} mono />
          </NodeSectionDivider>
        </>
      ),
    },
    onAdd: () => ({
      id: `ai_${nanoid(5)}`, type: NodeType.AiChat,
      data: {
        title: "AI 处理", action: "custom", image_path: "", prompt: "", text: "",
        provider_id: "", model: "", streaming: false,
      },
    }),
  },

  // ===== Image Preview =====
  {
    type: NodeType.ImagePreview,
    meta: { defaultPorts: portsFor(NodeType.ImagePreview) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-image-preview" />
          <FilePathInput name="path" label="图片路径" placeholder="{{prev.path}}" />
        </>
      ),
    },
    onAdd: () => ({
      id: `prev_${nanoid(5)}`, type: NodeType.ImagePreview,
      data: { title: "图片预览", path: "{{prev.path}}" },
    }),
  },

  // ===== Text Process =====
  {
    type: NodeType.TextProcess,
    meta: { defaultPorts: portsFor(NodeType.TextProcess) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-text-process" />
          <SelectField name="operation" label="操作" options={[
            { value: "trim", label: "去除空白" },
            { value: "uppercase", label: "转大写" },
            { value: "lowercase", label: "转小写" },
            { value: "split", label: "分割" },
            { value: "join", label: "合并" },
            { value: "replace", label: "替换" },
            { value: "regex_extract", label: "正则提取" },
            { value: "line_count", label: "行数统计" },
            { value: "char_count", label: "字符统计" },
          ]} />
          <TextArea name="text" label="文本" placeholder="{{prev.result}}" rows={2} />
          <TextInput name="separator" label="分隔符 / 查找 / 正则" placeholder="可选" />
          <TextInput name="replace_with" label="替换为" placeholder="仅替换模式" />
        </>
      ),
    },
    onAdd: () => ({
      id: `txt_${nanoid(5)}`, type: NodeType.TextProcess,
      data: { title: "文本处理", operation: "trim", text: "{{prev.result}}", separator: "", replace_with: "" },
    }),
  },

  // ===== JSON/CSV =====
  {
    type: NodeType.JsonProcess,
    meta: { defaultPorts: portsFor(NodeType.JsonProcess) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-json-process" />
          <SelectField name="operation" label="操作" options={[
            { value: "parse", label: "解析 JSON" },
            { value: "stringify", label: "格式化 JSON" },
            { value: "extract", label: "提取字段" },
            { value: "to_csv", label: "JSON → CSV" },
            { value: "from_csv", label: "CSV → JSON" },
          ]} />
          <TextArea name="input" label="输入数据" placeholder="{{prev.body}}" rows={3} mono />
          <TextInput name="path" label="字段路径 (提取用)" placeholder="data.items.0.name" mono />
        </>
      ),
    },
    onAdd: () => ({
      id: `json_${nanoid(5)}`, type: NodeType.JsonProcess,
      data: { title: "JSON 处理", operation: "parse", input: "{{prev.body}}", path: "" },
    }),
  },

  // ===== Data Process =====
  {
    type: NodeType.DataProcess,
    meta: { defaultPorts: portsFor(NodeType.DataProcess) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-data-process" />
          <SelectField name="operation" label="操作" options={[
            { value: "count", label: "计数" },
            { value: "sum", label: "求和" },
            { value: "average", label: "平均值" },
            { value: "sort", label: "排序" },
            { value: "reverse", label: "反转" },
            { value: "unique", label: "去重" },
            { value: "filter", label: "过滤" },
            { value: "first", label: "取前 N 个" },
            { value: "last", label: "取后 N 个" },
          ]} />
          <TextArea name="input" label="输入数据" placeholder="{{prev.result}}" rows={2} mono />
          <TextInput name="keyword" label="关键词 / 数量" placeholder="可选" />
        </>
      ),
    },
    onAdd: () => ({
      id: `data_${nanoid(5)}`, type: NodeType.DataProcess,
      data: { title: "数据统计", operation: "count", input: "{{prev.result}}", keyword: "" },
    }),
  },

  // ===== Regex Extract =====
  {
    type: NodeType.RegexExtract,
    meta: { defaultPorts: portsFor(NodeType.RegexExtract) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-regex-extract" />
          <TextInput name="pattern" label="正则表达式" placeholder="(\d+)" mono />
          <CheckboxField name="extract_all" label="提取所有匹配" />
        </>
      ),
    },
    onAdd: () => ({
      id: `regex_${nanoid(5)}`, type: NodeType.RegexExtract,
      data: { title: "正则提取", pattern: "", extract_all: false },
    }),
  },

  // ===== Email Send =====
  {
    type: NodeType.EmailSend,
    meta: { defaultPorts: portsFor(NodeType.EmailSend) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-email-send" />
          <TextInput name="smtp_host" label="SMTP 服务器" placeholder="smtp.gmail.com" />
          <TextInput name="smtp_port" label="SMTP 端口" placeholder="587" />
          <TextInput name="username" label="用户名" placeholder="user@example.com" />
          <TextInput name="password" label="密码" placeholder="••••••" />
          <TextInput name="from" label="发件人" placeholder="user@example.com" />
          <TextInput name="to" label="收件人" placeholder="recipient@example.com" />
          <TextInput name="subject" label="主题" placeholder="DeskPipe 通知" />
          <TextArea name="body" label="正文" placeholder="{{prev.result}}" rows={3} />
        </>
      ),
    },
    onAdd: () => ({
      id: `email_${nanoid(5)}`, type: NodeType.EmailSend,
      data: {
        title: "发送邮件", smtp_host: "smtp.gmail.com", smtp_port: "587",
        username: "", password: "", from: "", to: "", subject: "DeskPipe 通知", body: "{{prev.result}}",
      },
    }),
  },

  // ===== Code =====
  {
    type: NodeType.Code,
    meta: { defaultPorts: portsFor(NodeType.Code) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-code" />
          <SelectField name="language" label="语言" options={[
            { value: "javascript", label: "JavaScript" },
            { value: "typescript", label: "TypeScript" },
            { value: "python", label: "Python" },
            { value: "ruby", label: "Ruby" },
          ]} />
          <TextArea name="code" label="代码" placeholder="// 使用 input 访问上游数据\nconsole.log(JSON.stringify(input));" rows={6} mono />
          <TextInput name="code_timeout_ms" label="超时 (ms)" placeholder="30000" />
        </>
      ),
    },
    onAdd: () => ({
      id: `code_${nanoid(5)}`, type: NodeType.Code,
      data: { title: "代码执行", language: "javascript", code: "// input 变量包含上游节点数据\nconsole.log(JSON.stringify({ result: 'hello' }));" },
    }),
  },

  // ===== AppleScript =====
  {
    type: NodeType.AppleScript,
    meta: { defaultPorts: portsFor(NodeType.AppleScript) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-applescript" />
          <SelectField name="script_type" label="脚本类型" options={[
            { value: "applescript", label: "AppleScript" },
            { value: "jxa", label: "JavaScript (JXA)" },
          ]} />
          <TextArea name="script" label="脚本" placeholder='tell application "Finder" to activate' rows={5} mono />
        </>
      ),
    },
    onAdd: () => ({
      id: `as_${nanoid(5)}`, type: NodeType.AppleScript,
      data: { title: "AppleScript", script_type: "applescript", script: 'tell application "Finder" to activate' },
    }),
  },

  // ===== Open App =====
  {
    type: NodeType.OpenApp,
    meta: { defaultPorts: portsFor(NodeType.OpenApp) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-open-app" />
          <SelectField name="action" label="操作" options={[
            { value: "open", label: "启动应用" },
            { value: "focus", label: "聚焦应用" },
            { value: "quit", label: "退出应用" },
            { value: "open_url", label: "打开 URL" },
            { value: "open_file", label: "用应用打开文件" },
          ]} />
          <TextInput name="app_name" label="应用名称" placeholder="Safari, Finder, 微信..." />
          <TextInput name="url" label="URL（可选）" placeholder="https://..." mono />
          <TextInput name="file_path" label="文件路径（可选）" placeholder="/path/to/file" mono />
        </>
      ),
    },
    onAdd: () => ({
      id: `app_${nanoid(5)}`, type: NodeType.OpenApp,
      data: { title: "启动应用", action: "open", app_name: "", url: "", file_path: "" },
    }),
  },

  // ===== Keyboard Type =====
  {
    type: NodeType.KeyboardType,
    meta: { defaultPorts: portsFor(NodeType.KeyboardType) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-keyboard-type" />
          <SelectField name="action" label="操作" options={[
            { value: "type_text", label: "输入文本" },
            { value: "key_combo", label: "发送快捷键" },
            { value: "key_code", label: "发送按键代码" },
          ]} />
          <TextArea name="text" label="文本内容" placeholder="要输入的文字或 {{prev.result}}" rows={2} />
          <TextInput name="key_combo" label="快捷键" placeholder="command+c, command+shift+s" />
          <TextInput name="key_code" label="按键代码" placeholder="36=回车, 48=Tab, 53=Esc" />
        </>
      ),
    },
    onAdd: () => ({
      id: `kb_${nanoid(5)}`, type: NodeType.KeyboardType,
      data: { title: "键盘输入", action: "type_text", text: "", key_combo: "", key_code: "" },
    }),
  },

  // ===== User Input =====
  {
    type: NodeType.UserInput,
    meta: { defaultPorts: portsFor(NodeType.UserInput) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-user-input" />
          <SelectField name="input_type" label="输入类型" options={[
            { value: "text", label: "文本输入" },
            { value: "confirm", label: "确认 (是/否)" },
          ]} />
          <TextInput name="prompt" label="提示文字" placeholder="请输入..." />
          <TextInput name="default_value" label="默认值" placeholder="可选" />
        </>
      ),
    },
    onAdd: () => ({
      id: `ui_${nanoid(5)}`, type: NodeType.UserInput,
      data: { title: "用户输入", input_type: "text", prompt: "请输入", default_value: "" },
    }),
  },

  // ===== File Watch =====
  {
    type: NodeType.FileWatch,
    meta: { defaultPorts: portsFor(NodeType.FileWatch) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-file-watch" />
          <FilePathInput name="path" label="监听路径" placeholder="/path/to/watch" />
          <TextInput name="timeout_secs" label="超时（秒）" placeholder="30" />
        </>
      ),
    },
    onAdd: () => ({
      id: `fw_${nanoid(5)}`, type: NodeType.FileWatch,
      data: { title: "文件监听", path: "", timeout_secs: "30" },
    }),
  },

  // ===== Comment =====
  {
    type: NodeType.Comment,
    meta: { defaultPorts: portsFor(NodeType.Comment) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-comment" />
          <TextArea name="comment" label="备注" rows={4} />
        </>
      ),
    },
    onAdd: () => ({
      id: `cmt_${nanoid(5)}`, type: NodeType.Comment,
      data: { title: "注释", comment: "" },
    }),
  },

  // ===== Variable Set =====
  {
    type: NodeType.VariableSet,
    meta: { defaultPorts: portsFor(NodeType.VariableSet) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-variable-set" />
          <TextInput name="key" label="变量名" />
          <TextArea name="value" label="变量值" />
        </>
      ),
    },
    onAdd: () => ({
      id: `vset_${nanoid(5)}`, type: NodeType.VariableSet,
      data: { title: "设置变量", key: "", value: "" },
    }),
  },

  // ===== Variable Get =====
  {
    type: NodeType.VariableGet,
    meta: { defaultPorts: portsFor(NodeType.VariableGet) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-variable-get" />
          <TextInput name="key" label="变量名" />
        </>
      ),
    },
    onAdd: () => ({
      id: `vget_${nanoid(5)}`, type: NodeType.VariableGet,
      data: { title: "读取变量", key: "" },
    }),
  },

  // ===== Database =====
  {
    type: NodeType.Database,
    meta: { defaultPorts: portsFor(NodeType.Database) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-database" />
          <SelectField name="operation" label="操作" options={[
            { value: "create_table", label: "创建表" },
            { value: "insert", label: "插入" },
            { value: "select", label: "查询" },
            { value: "update", label: "更新" },
            { value: "delete", label: "删除" },
          ]} />
          <TextInput name="db_path" label="数据库路径" placeholder="默认使用内置数据库" />
          <TextInput name="table" label="表名" />
          <TextArea name="data" label="数据 (JSON)" rows={3} mono />
          <TextInput name="where_clause" label="条件" />
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `db_${nanoid(5)}`, type: NodeType.Database,
      data: { title: "数据库", operation: "select", db_path: "", table: "", data: "", where_clause: "", on_error: "stop" },
    }),
  },

  // ===== SQL Query =====
  {
    type: NodeType.SqlQuery,
    meta: { defaultPorts: portsFor(NodeType.SqlQuery) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-sql-query" />
          <TextInput name="db_path" label="数据库路径" />
          <TextArea name="sql" label="SQL 语句" rows={5} mono />
          <TextArea name="params" label="参数 (JSON 数组)" rows={2} mono />
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `sql_${nanoid(5)}`, type: NodeType.SqlQuery,
      data: { title: "SQL 查询", db_path: "", sql: "", params: "[]", on_error: "stop" },
    }),
  },

  // ===== Merge =====
  {
    type: NodeType.Merge,
    meta: { defaultPorts: portsFor(NodeType.Merge) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-merge" />
          <SelectField name="merge_mode" label="合并模式" options={[
            { value: "object", label: "对象合并" },
            { value: "array", label: "数组合并" },
          ]} />
          <TextInput name="source_nodes" label="源节点 ID (逗号分隔)" />
        </>
      ),
    },
    onAdd: () => ({
      id: `merge_${nanoid(5)}`, type: NodeType.Merge,
      data: { title: "合并", merge_mode: "object", source_nodes: "" },
    }),
  },

  // ===== Batch Process =====
  {
    type: NodeType.BatchProcess,
    meta: { defaultPorts: portsFor(NodeType.BatchProcess) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-batch-process" />
          <TextArea name="items" label="数组数据" rows={3} mono />
          <TextInput name="concurrency" label="并发数" placeholder="5" />
          <SelectField name="error_mode" label="错误处理" options={[
            { value: "terminated", label: "遇错停止" },
            { value: "continue_on_error", label: "忽略错误继续" },
            { value: "remove_abnormal", label: "移除异常结果" },
          ]} />
        </>
      ),
    },
    onAdd: () => ({
      id: `batch_${nanoid(5)}`, type: NodeType.BatchProcess,
      data: { title: "批量处理", items: "[]", concurrency: "5", error_mode: "terminated" },
    }),
  },

  // ===== Image Generate =====
  {
    type: NodeType.ImageGenerate,
    meta: { defaultPorts: portsFor(NodeType.ImageGenerate) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-image-generate" />
          <AiPresetSelector />
          <TextArea name="prompt" label="生成提示" rows={3} />
          <SelectField name="size" label="尺寸" options={[
            { value: "1024x1024", label: "1024x1024" },
            { value: "512x512", label: "512x512" },
            { value: "256x256", label: "256x256" },
          ]} />
          <SelectField name="quality" label="质量" options={[
            { value: "standard", label: "标准" },
            { value: "hd", label: "高清" },
          ]} />
          <SelectField name="style" label="风格" options={[
            { value: "vivid", label: "鲜明" },
            { value: "natural", label: "自然" },
          ]} />
          <NodeSectionDivider label="API 配置">
            <TextInput name="model" label="模型" placeholder="dall-e-3" />
          </NodeSectionDivider>
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `igen_${nanoid(5)}`, type: NodeType.ImageGenerate,
      data: {
        title: "图片生成", prompt: "", size: "1024x1024", quality: "standard", style: "vivid",
        provider_id: "", model: "", on_error: "stop",
      },
    }),
  },

  // ===== TTS =====
  {
    type: NodeType.Tts,
    meta: { defaultPorts: portsFor(NodeType.Tts) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-tts" />
          <AiPresetSelector />
          <SelectField name="engine" label="引擎" options={[
            { value: "openai", label: "OpenAI" },
            { value: "local", label: "本地" },
          ]} />
          <TextArea name="text" label="文本" rows={3} />
          <SelectField name="voice" label="声音" options={[
            { value: "alloy", label: "Alloy" },
            { value: "echo", label: "Echo" },
            { value: "fable", label: "Fable" },
            { value: "onyx", label: "Onyx" },
            { value: "nova", label: "Nova" },
            { value: "shimmer", label: "Shimmer" },
          ]} />
          <NodeSectionDivider label="API 配置">
            <TextInput name="model" label="模型" placeholder="tts-1" />
          </NodeSectionDivider>
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `tts_${nanoid(5)}`, type: NodeType.Tts,
      data: {
        title: "语音合成", engine: "openai", text: "", voice: "alloy",
        provider_id: "", model: "", on_error: "stop",
      },
    }),
  },

  // ===== STT =====
  {
    type: NodeType.Stt,
    meta: { defaultPorts: portsFor(NodeType.Stt) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-stt" />
          <AiPresetSelector />
          <FilePathInput name="audio_path" label="音频文件" />
          <TextInput name="language" label="语言提示 (可选)" />
          <NodeSectionDivider label="API 配置">
            <TextInput name="model" label="模型" placeholder="whisper-1" />
          </NodeSectionDivider>
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `stt_${nanoid(5)}`, type: NodeType.Stt,
      data: {
        title: "语音识别", audio_path: "", language: "",
        provider_id: "", model: "", on_error: "stop",
      },
    }),
  },

  // ===== Intent Recognition =====
  {
    type: NodeType.IntentRecognition,
    meta: {
      defaultPorts: [{ type: "input" }, { type: "output" }, { type: "output" }, { type: "output" }],
    },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-intent-recognition" />
          <AiPresetSelector />
          <TextArea name="intents" label="意图列表 (JSON)" rows={4} mono placeholder='[{"name":"order","description":"下单"}]' />
          <TextArea name="text" label="待分类文本" rows={2} />
          <NodeSectionDivider label="API 配置">
            <TextInput name="model" label="模型" placeholder="gpt-4o" />
          </NodeSectionDivider>
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `intent_${nanoid(5)}`, type: NodeType.IntentRecognition,
      data: {
        title: "意图识别", intents: "[]", text: "",
        provider_id: "", model: "", on_error: "stop",
      },
    }),
  },

  // ===== Knowledge Write =====
  {
    type: NodeType.KnowledgeWrite,
    meta: { defaultPorts: portsFor(NodeType.KnowledgeWrite) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-knowledge-write" />
          <AiPresetSelector />
          <TextInput name="collection" label="集合名" />
          <TextArea name="content" label="内容" rows={3} />
          <TextArea name="metadata" label="元数据 (JSON)" rows={2} mono />
          <NodeSectionDivider label="Embedding API">
            <TextInput name="model" label="模型" placeholder="text-embedding-3-small" />
          </NodeSectionDivider>
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `kw_${nanoid(5)}`, type: NodeType.KnowledgeWrite,
      data: {
        title: "写入知识库", collection: "", content: "", metadata: "{}",
        provider_id: "", model: "", on_error: "stop",
      },
    }),
  },

  // ===== Knowledge Search =====
  {
    type: NodeType.KnowledgeSearch,
    meta: { defaultPorts: portsFor(NodeType.KnowledgeSearch) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-knowledge-search" />
          <AiPresetSelector />
          <TextInput name="collection" label="集合名" />
          <TextInput name="query" label="查询" />
          <TextInput name="top_k" label="返回条数" placeholder="5" />
          <NodeSectionDivider label="Embedding API">
            <TextInput name="model" label="模型" placeholder="text-embedding-3-small" />
          </NodeSectionDivider>
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `ks_${nanoid(5)}`, type: NodeType.KnowledgeSearch,
      data: {
        title: "知识检索", collection: "", query: "", top_k: "5",
        provider_id: "", model: "", on_error: "stop",
      },
    }),
  },

  // ===== Webhook Trigger =====
  {
    type: NodeType.WebhookTrigger,
    meta: { defaultPorts: portsFor(NodeType.WebhookTrigger) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-webhook-trigger" />
          <TextInput name="path" label="路径" placeholder="/hook/my-workflow" />
          <SelectField name="method" label="方法" options={[
            { value: "GET", label: "GET" },
            { value: "POST", label: "POST" },
            { value: "ANY", label: "ANY" },
          ]} />
          <TextInput name="port" label="端口" placeholder="9876" />
          <TextInput name="secret" label="密钥 (可选)" />
        </>
      ),
    },
    onAdd: () => ({
      id: `wh_${nanoid(5)}`, type: NodeType.WebhookTrigger,
      data: { title: "Webhook", path: "/hook/my-workflow", method: "POST", port: "9876", secret: "" },
    }),
  },

  // ===== Agent =====
  {
    type: NodeType.Agent,
    meta: { defaultPorts: portsFor(NodeType.Agent) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-agent" />
          <AiPresetSelector />
          <TextArea name="system_prompt" label="系统提示" placeholder="你是一个专业的助手..." rows={3} />
          <TextArea name="user_message" label="用户消息" placeholder="留空则使用上游输入" rows={2} />
          <TextInput name="max_turns" label="最大轮数" placeholder="1" />
          <TextArea name="continue_prompt" label="追问提示" placeholder="请继续深入分析..." rows={2} />
          <NodeSectionDivider label="API 配置">
            <TextInput name="model" label="模型" placeholder="gpt-4o" />
          </NodeSectionDivider>
        </>
      ),
    },
    onAdd: () => ({
      id: `agent_${nanoid(5)}`, type: NodeType.Agent,
      data: {
        title: "AI Agent", system_prompt: "", user_message: "", max_turns: "1",
        continue_prompt: "", provider_id: "", model: "",
      },
    }),
  },

  // ===== List Operator =====
  {
    type: NodeType.ListOperator,
    meta: { defaultPorts: portsFor(NodeType.ListOperator) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-list-operator" />
          <SelectField name="operation" label="操作" options={[
            { value: "filter", label: "过滤" },
            { value: "sort", label: "排序" },
            { value: "limit", label: "截取" },
            { value: "extract", label: "提取索引" },
          ]} />
          <TextInput name="field" label="字段名" placeholder="留空则操作值本身" />
          <SelectField name="condition" label="条件" options={[
            { value: "contains", label: "包含" },
            { value: "not_contains", label: "不包含" },
            { value: "starts_with", label: "开头是" },
            { value: "ends_with", label: "结尾是" },
            { value: "equals", label: "等于" },
            { value: "not_equals", label: "不等于" },
            { value: "gt", label: "大于" },
            { value: "lt", label: "小于" },
            { value: "empty", label: "为空" },
            { value: "not_empty", label: "不为空" },
          ]} />
          <TextInput name="condition_value" label="条件值" />
          <SelectField name="sort_direction" label="排序方向" options={[
            { value: "asc", label: "升序" },
            { value: "desc", label: "降序" },
          ]} />
          <TextInput name="limit_count" label="截取数量" placeholder="10" />
          <TextInput name="extract_index" label="提取索引" placeholder="0" />
        </>
      ),
    },
    onAdd: () => ({
      id: `listop_${nanoid(5)}`, type: NodeType.ListOperator,
      data: { title: "列表操作", operation: "filter", field: "", condition: "contains", condition_value: "", sort_direction: "asc", limit_count: "10", extract_index: "0" },
    }),
  },

  // ===== Template Render =====
  {
    type: NodeType.TemplateRender,
    meta: { defaultPorts: portsFor(NodeType.TemplateRender) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-template-render" />
          <TextArea name="template" label="模板" placeholder="你好 {{name}}，{{#if vip}}VIP 用户{{/if}}" rows={5} mono />
          <TextArea name="data" label="额外数据 (JSON)" placeholder='{"name": "张三"}' rows={2} mono />
        </>
      ),
    },
    onAdd: () => ({
      id: `tmpl_${nanoid(5)}`, type: NodeType.TemplateRender,
      data: { title: "模板渲染", template: "", data: "" },
    }),
  },

  // ===== Document Extractor =====
  {
    type: NodeType.DocumentExtractor,
    meta: { defaultPorts: portsFor(NodeType.DocumentExtractor) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-document-extractor" />
          <FilePathInput name="file_path" label="文件路径" placeholder="支持 PDF/DOCX/HTML/TXT" />
        </>
      ),
    },
    onAdd: () => ({
      id: `docex_${nanoid(5)}`, type: NodeType.DocumentExtractor,
      data: { title: "文档解析", file_path: "" },
    }),
  },

  // ===== Parameter Extractor =====
  {
    type: NodeType.ParameterExtractor,
    meta: { defaultPorts: portsFor(NodeType.ParameterExtractor) },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-parameter-extractor" />
          <AiPresetSelector />
          <TextArea name="schema" label="提取字段 (JSON)" placeholder='[{"name":"email","type":"string","description":"邮箱地址","required":true}]' rows={4} mono />
          <TextArea name="text" label="输入文本" placeholder="留空则使用上游输出" rows={2} />
          <NodeSectionDivider label="API 配置">
            <TextInput name="model" label="模型" placeholder="gpt-4o-mini" />
          </NodeSectionDivider>
          <ErrorStrategySelect />
        </>
      ),
    },
    onAdd: () => ({
      id: `pex_${nanoid(5)}`, type: NodeType.ParameterExtractor,
      data: { title: "参数提取", schema: "[]", text: "", provider_id: "", model: "" },
    }),
  },

  // ===== Human Review =====
  {
    type: NodeType.HumanReview,
    meta: { defaultPorts: [{ type: "input" }, { type: "output" }, { type: "output" }] },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-human-review" />
          <TextInput name="title" label="审核标题" placeholder="请审核此操作" />
          <TextArea name="description" label="说明" placeholder="描述需要审核的内容" rows={2} />
          <TextInput name="actions" label="操作选项" placeholder="approve,reject" />
          <TextInput name="timeout_secs" label="超时 (秒)" placeholder="300" />
        </>
      ),
    },
    onAdd: () => ({
      id: `review_${nanoid(5)}`, type: NodeType.HumanReview,
      data: { title: "人工审核", description: "", actions: "approve,reject", timeout_secs: "300" },
    }),
  },

  // ===== Parallel =====
  {
    type: NodeType.Parallel,
    meta: { defaultPorts: [{ type: "input" }, { type: "output" }, { type: "output" }] },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-parallel" />
        </>
      ),
    },
    onAdd: () => ({
      id: `parallel_${nanoid(5)}`, type: NodeType.Parallel,
      data: { title: "并行分支" },
    }),
  },

  // ===== Result Dialog =====
  {
    type: NodeType.ResultDialog,
    meta: { defaultPorts: [{ type: "input" as const }] },
    formMeta: {
      render: () => (
        <>
          <TitleField className="node-result-dialog" />
          <TextInput name="title" label="窗口标题" placeholder="结果" />
          <TextArea name="content" label="展示内容" placeholder="留空则使用上游输出" rows={3} />
        </>
      ),
    },
    onAdd: () => ({
      id: `result_dialog_${nanoid()}`,
      type: NodeType.ResultDialog,
      data: { title: "结果展示", content: "" },
    }),
  },
];
