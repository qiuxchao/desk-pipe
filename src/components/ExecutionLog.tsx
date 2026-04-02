import { useRef, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, XCircle, MinusCircle, Loader2, Play, Download, ChevronDown } from "lucide-react";
import type { WorkflowEvent } from "@/types/workflow";
import { JsonHighlight } from "@/components/JsonHighlight";

interface ExecutionLogProps {
  events: WorkflowEvent[];
  visible: boolean;
  onClose: () => void;
}

/** Extract a human-readable Chinese summary from node output */
function summarize(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  if (typeof d.stdout === "string" && (d.stdout as string).trim()) {
    const out = (d.stdout as string).trim();
    return `输出: ${out.length > 100 ? out.slice(0, 100) + "..." : out}`;
  }
  if (typeof d.status === "number") {
    return `状态码 ${d.status}`;
  }
  if (typeof d.text === "string" && d.written) {
    const t = (d.text as string).trim();
    return `已写入: ${t.length > 80 ? t.slice(0, 80) + "..." : t}`;
  }
  if (typeof d.text === "string") {
    const t = (d.text as string).trim();
    return `内容: ${t.length > 80 ? t.slice(0, 80) + "..." : t}`;
  }
  if (d.notification_sent) return `通知已发送「${d.title}」`;
  if (typeof d.delayed_ms === "number") return `已等待 ${d.delayed_ms}ms`;
  if (d.written && d.path) return `已写入文件 ${d.path}`;
  if (d.copied) return `已复制到 ${d.destination}`;
  if (d.moved) return `已移动到 ${d.destination}`;
  if (typeof d.content === "string" && d.path) {
    return `已读取 ${d.path} (${d.size} 字节)`;
  }
  if (typeof d.result === "boolean" && d.operator) {
    return d.result ? "条件成立 ✓" : "条件不成立 ✗";
  }
  // AI result
  if (typeof d.result === "string" && d.provider) {
    const r = (d.result as string).trim();
    return `${d.provider}: ${r.length > 120 ? r.slice(0, 120) + "..." : r}`;
  }
  // Screenshot
  if (d.path && d.width && d.height) {
    return `${d.width}x${d.height} → ${d.path}`;
  }
  if (d.previewed) {
    return `已预览 ${d.path}`;
  }
  // Generic result
  if (typeof d.result === "string") {
    const r = (d.result as string).trim();
    return r.length > 120 ? r.slice(0, 120) + "..." : r;
  }
  if (typeof d.result === "number") {
    return `结果: ${d.result}`;
  }
  if (Array.isArray(d.result)) {
    return `${(d.result as unknown[]).length} 项数据`;
  }
  if (typeof d.count === "number") {
    return `${d.count} 项`;
  }
  return null;
}

interface Step {
  nodeId: string;
  title: string;
  nodeType: string;
  status: "running" | "completed" | "failed" | "skipped";
  output?: string | null;
  error?: string;
  rawData?: unknown;
  inputData?: unknown;
  startTime?: number;
  endTime?: number;
}

function buildSteps(events: WorkflowEvent[]) {
  const steps: Step[] = [];
  let workflowStatus: "idle" | "running" | "completed" | "failed" = "idle";
  const stepMap = new Map<string, Step>();

  for (const ev of events) {
    if (ev.event_type === "started") { workflowStatus = "running"; continue; }
    if (ev.event_type === "completed") { workflowStatus = "completed"; continue; }
    if (ev.event_type === "failed" && !ev.node_id) { workflowStatus = "failed"; continue; }

    const nodeId = ev.node_id ?? "";
    if (!nodeId) continue;

    if (ev.event_type === "node_started") {
      const evData = ev.data as Record<string, unknown> | undefined;
      const step: Step = {
        nodeId,
        title: (evData?.title as string) ?? nodeId,
        nodeType: (evData?.type as string) ?? "",
        status: "running",
        inputData: evData?.input,
        startTime: ev.timestamp,
      };
      stepMap.set(nodeId, step);
      steps.push(step);
    }

    if (ev.event_type === "node_completed" && stepMap.has(nodeId)) {
      const step = stepMap.get(nodeId)!;
      step.status = "completed";
      step.output = summarize(ev.data);
      step.rawData = ev.data;
      step.endTime = ev.timestamp;
    }

    if (ev.event_type === "node_skipped") {
      const step: Step = {
        nodeId,
        title: nodeId,
        nodeType: "",
        status: "skipped",
      };
      stepMap.set(nodeId, step);
      steps.push(step);
    }

    if (ev.event_type === "node_failed" && stepMap.has(nodeId)) {
      const step = stepMap.get(nodeId)!;
      step.status = "failed";
      step.error = ev.error ?? "执行出错";
      step.endTime = ev.timestamp;
    }
  }

  return { steps, workflowStatus };
}

const NODE_TYPE_LABELS: Record<string, string> = {
  shell: "Shell",
  delay: "延时",
  notification: "通知",
  clipboard_read: "剪贴板",
  clipboard_write: "剪贴板",
  file_read: "文件",
  file_write: "文件",
  file_copy: "文件",
  file_move: "文件",
  http_request: "HTTP",
  condition: "条件",
  loop: "循环",
  sub_workflow: "子流程",
};

/** Standalone content component for use inside InspectorSidebar */
export function ExecutionLogContent({ events }: { events: WorkflowEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { steps, workflowStatus } = useMemo(() => buildSteps(events), [events]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution-log-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with status */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {workflowStatus === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          {workflowStatus === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
          {workflowStatus === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
          <h3 className="text-xs font-semibold">
            {workflowStatus === "running" ? "执行中..." : workflowStatus === "completed" ? "全部完成" : workflowStatus === "failed" ? "执行失败" : "执行结果"}
          </h3>
          {workflowStatus === "completed" && steps.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {steps.length} 个步骤
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExport} title="导出日志">
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Steps timeline */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="p-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Play className="h-6 w-6 mb-3 opacity-20" />
              <span className="text-xs">点击「运行」开始执行</span>
            </div>
          ) : (
            <div className="relative">
              {steps.length > 1 && (
                <div className="absolute left-[11px] top-5 bottom-5 w-px bg-border" />
              )}

              <div className="flex flex-col gap-0">
                {steps.map((step) => (
                  <div key={step.nodeId} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* Dot */}
                    <div className="relative z-10 shrink-0 mt-0.5">
                      {step.status === "running" ? (
                        <div className="h-[22px] w-[22px] rounded-full bg-primary/10 flex items-center justify-center">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        </div>
                      ) : step.status === "completed" ? (
                        <div className="h-[22px] w-[22px] rounded-full bg-primary/10 flex items-center justify-center">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                      ) : step.status === "skipped" ? (
                        <div className="h-[22px] w-[22px] rounded-full bg-muted flex items-center justify-center">
                          <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="h-[22px] w-[22px] rounded-full bg-destructive/10 flex items-center justify-center">
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div
                        className="flex items-center gap-2 cursor-pointer select-none"
                        onClick={() => setExpanded(expanded === step.nodeId ? null : step.nodeId)}
                      >
                        <span className="text-xs font-medium">{step.title}</span>
                        {step.nodeType && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {NODE_TYPE_LABELS[step.nodeType] ?? step.nodeType}
                          </span>
                        )}
                        {step.endTime && step.startTime && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {((step.endTime - step.startTime) / 1000).toFixed(1)}s
                          </span>
                        )}
                        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform shrink-0 ${expanded === step.nodeId ? "rotate-180" : ""}`} />
                      </div>

                      {step.output && expanded !== step.nodeId && (
                        <div className="mt-1.5 text-[11px] text-foreground/70 bg-muted/60 rounded px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap break-all max-h-20 overflow-auto">
                          {step.output}
                        </div>
                      )}

                      {step.error && expanded !== step.nodeId && (
                        <div className="mt-1.5 text-[11px] text-destructive bg-destructive/5 rounded px-2.5 py-1.5">
                          {step.error}
                        </div>
                      )}

                      {/* Expanded detail view */}
                      {expanded === step.nodeId && (
                        <div className="mt-2 space-y-2">
                          {step.inputData != null && (
                            <div className="text-[10px] font-mono bg-muted/40 rounded-md p-2">
                              <div className="mb-1 text-muted-foreground font-sans font-semibold">输入数据</div>
                              <JsonHighlight data={step.inputData} maxHeight="180px" />
                            </div>
                          )}

                          {step.rawData != null && (
                            <div className="text-[10px] font-mono bg-muted/40 rounded-md p-2">
                              <div className="mb-1 text-muted-foreground font-sans font-semibold">输出数据</div>
                              <JsonHighlight data={step.rawData} maxHeight="180px" />
                            </div>
                          )}

                          {step.error && (
                            <div className="text-[10px] font-mono bg-destructive/5 rounded-md p-2">
                              <div className="mb-1 text-destructive font-sans font-semibold">错误详情</div>
                              <pre className="whitespace-pre-wrap break-all text-destructive/80">
                                {step.error}
                              </pre>
                            </div>
                          )}

                          {step.endTime && step.startTime && (
                            <div className="text-[10px] text-muted-foreground">
                              耗时: {((step.endTime - step.startTime) / 1000).toFixed(2)}s
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExecutionLog({ events, visible, onClose }: ExecutionLogProps) {
  if (!visible) return null;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col relative z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold">执行日志</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ExecutionLogContent events={events} />
    </div>
  );
}
