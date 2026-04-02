import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, History } from "lucide-react";
import type { ExecutionRecord } from "@/types/workflow";

interface ExecutionHistoryProps {
  visible: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  completed: "成功",
  failed: "失败",
  running: "运行中",
};

/** Standalone content component for use inside InspectorSidebar */
export function ExecutionHistoryContent() {
  const [records, setRecords] = useState<ExecutionRecord[]>([]);

  useEffect(() => {
    invoke<string>("list_execution_history", { workflowId: null })
      .then((json) => setRecords(JSON.parse(json)))
      .catch(console.error);
  }, []);

  return (
    <ScrollArea className="flex-1 p-3">
      {records.length === 0 ? (
        <div className="text-center text-muted-foreground text-xs py-12">
          暂无执行记录
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {records.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-background p-2.5 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs truncate">{r.workflow_name}</span>
                <Badge
                  variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}
                  className="text-[10px] h-4"
                >
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
              <div className="text-muted-foreground text-[10px]">
                {new Date(r.started_at).toLocaleString("zh-CN")}
              </div>
              {r.completed_at && (
                <div className="text-muted-foreground text-[10px]">
                  耗时 {((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

export function ExecutionHistory({ visible, onClose }: ExecutionHistoryProps) {
  if (!visible) return null;

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col relative z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          <h3 className="text-xs font-semibold">执行历史</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ExecutionHistoryContent />
    </div>
  );
}
