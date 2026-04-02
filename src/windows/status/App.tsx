import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useWindowTheme } from "@/hooks/useWindowTheme";

interface WorkflowEvent {
  workflow_id: string;
  event_type: string;
  node_id?: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp?: number;
}

interface StepInfo {
  nodeId: string;
  title: string;
  status: "running" | "completed" | "failed" | "skipped";
  startTime: number;
  endTime?: number;
}

export function StatusWindow() {
  useWindowTheme();

  const [workflowName, setWorkflowName] = useState("");
  const [overallStatus, setOverallStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [steps]);

  useEffect(() => {
    const unlisten = listen<WorkflowEvent>("workflow_event", (event) => {
      const ev = event.payload;

      switch (ev.event_type) {
        case "started":
          setWorkflowName(ev.workflow_id);
          setOverallStatus("running");
          setSteps([]);
          break;
        case "node_started": {
          const title =
            (ev.data?.title as string) ||
            (ev.data?.type as string) ||
            ev.node_id || "Unknown";
          setSteps((prev) => [
            ...prev,
            { nodeId: ev.node_id || "", title, status: "running", startTime: ev.timestamp || Date.now() },
          ]);
          break;
        }
        case "node_completed":
          setSteps((prev) =>
            prev.map((s) =>
              s.nodeId === ev.node_id && s.status === "running"
                ? { ...s, status: "completed" as const, endTime: ev.timestamp || Date.now() }
                : s
            )
          );
          break;
        case "node_failed":
          setSteps((prev) =>
            prev.map((s) =>
              s.nodeId === ev.node_id && s.status === "running"
                ? { ...s, status: "failed" as const, endTime: ev.timestamp || Date.now() }
                : s
            )
          );
          break;
        case "node_skipped":
          setSteps((prev) => [
            ...prev,
            {
              nodeId: ev.node_id || "",
              title: ev.node_id || "Skipped",
              status: "skipped",
              startTime: ev.timestamp || Date.now(),
              endTime: ev.timestamp || Date.now(),
            },
          ]);
          break;
        case "completed":
          setOverallStatus("completed");
          break;
        case "failed":
          setOverallStatus("failed");
          break;
      }
    });

    // Signal to the backend that the event listener is ready
    unlisten.then(() => {
      invoke("status_window_ready");
    });

    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const close = useCallback(() => {
    getCurrentWebviewWindow().hide();
  }, []);

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalCount = steps.length;

  function formatDuration(start: number, end?: number): string {
    if (!end) return "";
    const ms = end - start;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  const statusDot = (status: StepInfo["status"]) => {
    const base = "w-[6px] h-[6px] rounded-full shrink-0";
    switch (status) {
      case "running": return <span className={`${base} bg-[oklch(0.55_0.18_260)] animate-pulse`} />;
      case "completed": return <span className={`${base} bg-[oklch(0.60_0.16_150)]`} />;
      case "failed": return <span className={`${base} bg-[oklch(0.58_0.22_25)]`} />;
      case "skipped": return <span className={`${base} bg-[oklch(0.55_0.01_260)]`} />;
    }
  };

  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", width: "100%", height: "100%",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "12px", color: "var(--color-foreground, #1a1a2e)", background: "var(--color-background, #fafafe)",
    }}>
      {/* Title bar */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", userSelect: "none", cursor: "default",
          borderBottom: "1px solid var(--color-border, #e4e4ed)",
        }}
      >
        {overallStatus === "running" && (
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 1s linear infinite", shrink: 0 }}>
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="oklch(0.55 0.18 260 / 0.2)" strokeWidth="2" />
            <path d="M 7 1.5 A 5.5 5.5 0 0 1 12.5 7" fill="none" stroke="oklch(0.55 0.18 260)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {overallStatus === "completed" && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="oklch(0.60 0.16 150)" />
            <path d="M4.5 7L6.2 8.7L9.5 5.3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {overallStatus === "failed" && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="oklch(0.58 0.22 25)" />
            <path d="M5 5L9 9M9 5L5 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        {overallStatus === "idle" && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="oklch(0.55 0.02 260)" strokeWidth="1.2" />
            <path d="M5.5 4.5L10 7L5.5 9.5Z" fill="oklch(0.55 0.02 260)" />
          </svg>
        )}
        <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {workflowName || "DeskPipe"}
        </span>
        <button
          onClick={close}
          style={{
            width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", background: "transparent", borderRadius: 4, cursor: "pointer",
            color: "var(--color-muted-foreground, #888)",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-accent, #eee)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="隐藏"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2L8 8M8 2L2 8" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      {overallStatus === "running" && totalCount > 0 && (
        <div style={{ padding: "8px 14px 4px" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", fontSize: 10,
            color: "var(--color-muted-foreground, #888)", marginBottom: 4,
          }}>
            <span>进度</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{completedCount}/{totalCount}</span>
          </div>
          <div style={{
            width: "100%", height: 3, background: "var(--color-muted, #eee)",
            borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${progressPct}%`,
              background: "oklch(0.55 0.18 260)", borderRadius: 2,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      {/* Steps */}
      <div ref={listRef} style={{
        flex: 1, overflowY: "auto", padding: "6px 10px",
      }}>
        {steps.length === 0 && overallStatus === "idle" && (
          <div style={{
            textAlign: "center", color: "var(--color-muted-foreground, #999)",
            paddingTop: 40, fontSize: 11,
          }}>
            等待工作流执行...
          </div>
        )}
        {steps.map((step, i) => (
          <div
            key={`${step.nodeId}-${i}`}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 4px", borderRadius: 4,
            }}
          >
            {statusDot(step.status)}
            <span style={{
              flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontSize: 11,
            }}>
              {step.title}
            </span>
            <span style={{
              fontSize: 10, color: "var(--color-muted-foreground, #999)",
              fontVariantNumeric: "tabular-nums", flexShrink: 0,
            }}>
              {step.status === "running" ? (
                <span style={{ color: "oklch(0.55 0.18 260)" }}>...</span>
              ) : formatDuration(step.startTime, step.endTime)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderTop: "1px solid var(--color-border, #e4e4ed)",
        fontSize: 11,
      }}>
        {overallStatus === "running" && <span style={{ color: "oklch(0.55 0.18 260)" }}>执行中</span>}
        {overallStatus === "completed" && <span style={{ color: "oklch(0.60 0.16 150)" }}>执行完成</span>}
        {overallStatus === "failed" && <span style={{ color: "oklch(0.58 0.22 25)" }}>执行失败</span>}
        {overallStatus === "idle" && <span style={{ color: "var(--color-muted-foreground, #999)" }}>就绪</span>}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--color-border, #ddd); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--color-muted-foreground, #aaa); }
      `}</style>
    </div>
  );
}
