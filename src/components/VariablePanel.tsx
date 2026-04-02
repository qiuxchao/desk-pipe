import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Variable } from "lucide-react";
import { useExecutionState } from "@/contexts/ExecutionContext";

interface VariablePanelProps {
  visible: boolean;
  onClose: () => void;
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) return <span className="text-muted-foreground italic">null</span>;
  if (typeof data === "string") return <span className="text-primary/80">"{data.length > 80 ? data.slice(0, 80) + "..." : data}"</span>;
  if (typeof data === "number" || typeof data === "boolean") return <span className="text-chart-3">{String(data)}</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        {data.map((item, i) => (
          <div key={i} className="flex gap-1"><span className="text-muted-foreground shrink-0">[{i}]</span><JsonTree data={item} depth={depth + 1} /></div>
        ))}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;
    return (
      <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-1"><span className="text-primary shrink-0 font-medium">{key}:</span><JsonTree data={value} depth={depth + 1} /></div>
        ))}
      </div>
    );
  }

  return <span>{String(data)}</span>;
}

/** Standalone content component for use inside InspectorSidebar */
export function VariablePanelContent() {
  const { nodeResults } = useExecutionState();
  const hasResults = Object.keys(nodeResults).length > 0;

  return (
    <ScrollArea className="flex-1 p-3">
      {!hasResults ? (
        <div className="text-center text-muted-foreground text-xs py-12">
          运行工作流后可在此查看变量
          <div className="mt-2 text-[10px]">
            使用 <code className="text-primary bg-muted px-1 py-0.5 rounded">{"{{prev.field}}"}</code> 引用
          </div>
        </div>
      ) : (
        <div className="text-[11px] font-mono"><JsonTree data={nodeResults} /></div>
      )}
    </ScrollArea>
  );
}

export function VariablePanel({ visible, onClose }: VariablePanelProps) {
  if (!visible) return null;

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col relative z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Variable className="h-3.5 w-3.5" />
          <h3 className="text-xs font-semibold">变量面板</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <VariablePanelContent />
    </div>
  );
}
