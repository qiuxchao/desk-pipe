import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, GitBranch, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface VersionHistoryProps {
  visible: boolean;
  onClose: () => void;
  workflowId: string | null;
  onRestore: (workflowJson: string) => void;
}

function formatTimestamp(ts: string): string {
  // ts format: "20260323_143052"
  const match = ts.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return ts;
  const [, y, mo, d, h, mi, s] = match;
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/** Standalone content component for use inside InspectorSidebar */
export function VersionHistoryContent({
  workflowId,
  onRestore,
}: {
  workflowId: string | null;
  onRestore: (workflowJson: string) => void;
}) {
  const [versions, setVersions] = useState<[string, string][]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (workflowId) {
      invoke<string>("list_workflow_versions", { workflowId })
        .then((json) => setVersions(JSON.parse(json)))
        .catch(console.error);
    }
  }, [workflowId]);

  const handleRestore = async (timestamp: string) => {
    if (!workflowId) return;
    setRestoring(timestamp);
    try {
      const json = await invoke<string>("restore_workflow_version", {
        workflowId,
        timestamp,
      });
      onRestore(json);
      toast.success("已恢复到版本 " + formatTimestamp(timestamp));
    } catch (e) {
      console.error("Restore failed:", e);
      toast.error("恢复失败: " + e);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <ScrollArea className="flex-1 p-3">
      {!workflowId ? (
        <div className="text-center text-muted-foreground text-xs py-12">
          请先保存工作流
        </div>
      ) : versions.length === 0 ? (
        <div className="text-center text-muted-foreground text-xs py-12">
          暂无历史版本
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {versions.map(([ts]) => (
            <div
              key={ts}
              className="rounded-md border border-border bg-background p-2.5 text-xs flex items-center justify-between"
            >
              <span className="text-muted-foreground">
                {formatTimestamp(ts)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                disabled={restoring === ts}
                onClick={() => handleRestore(ts)}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {restoring === ts ? "恢复中..." : "恢复"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

export function VersionHistory({
  visible,
  onClose,
  workflowId,
  onRestore,
}: VersionHistoryProps) {
  if (!visible) return null;

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col relative z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          <h3 className="text-xs font-semibold">版本历史</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <VersionHistoryContent workflowId={workflowId} onRestore={onRestore} />
    </div>
  );
}
