import { useSelectedNode, type InspectorTab } from "@/contexts/SelectedNodeContext";
import { ExecutionLogContent } from "@/components/ExecutionLog";
import { VariablePanelContent } from "@/components/VariablePanel";
import { ExecutionHistoryContent } from "@/components/ExecutionHistory";
import { VersionHistoryContent } from "@/components/VersionHistory";
import { NODE_TYPE_CONFIG } from "@/nodes/constants";
import { NODE_ICONS } from "@/nodes/icons";
import { Settings, FileText, Variable, History, GitBranch, Bug } from "lucide-react";
import type { WorkflowEvent } from "@/types/workflow";

const TABS: { key: InspectorTab; label: string; icon: typeof Settings }[] = [
  { key: "config", label: "配置", icon: Settings },
  { key: "log", label: "日志", icon: FileText },
  { key: "variables", label: "变量", icon: Variable },
  { key: "history", label: "历史", icon: History },
  { key: "versions", label: "版本", icon: GitBranch },
  { key: "debug", label: "调试", icon: Bug },
];

interface InspectorSidebarProps {
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  events: WorkflowEvent[];
  workflowId: string | null;
  isDebugging?: boolean;
  debugContext?: Record<string, unknown> | null;
  onRestore: (json: string) => void;
}

export function InspectorSidebar({
  activeTab,
  onTabChange,
  events,
  workflowId,
  isDebugging,
  debugContext,
  onRestore,
}: InspectorSidebarProps) {
  const { selectedNodeId, selectedNodeType, selectedNodeTitle, inspectorPortalRef } = useSelectedNode();

  const config = selectedNodeType
    ? NODE_TYPE_CONFIG[selectedNodeType as keyof typeof NODE_TYPE_CONFIG]
    : null;

  return (
    <div className="inspector-sidebar">
      {/* Tab bar */}
      <div className="inspector-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`inspector-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => onTabChange(tab.key)}
            >
              <Icon className="h-3 w-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="inspector-content">
        {activeTab === "config" && (
          <div className="inspector-config-tab">
            {selectedNodeId ? (
              <>
                <div className="inspector-node-header">
                  <div
                    className="inspector-node-icon"
                    style={{ background: config?.color ?? "oklch(0.5 0 0)" }}
                  >
                    {config?.icon ? NODE_ICONS[config.icon] ?? null : null}
                  </div>
                  <div className="inspector-node-info">
                    <span className="inspector-node-title">{selectedNodeTitle}</span>
                    <span className="inspector-node-type">{config?.label ?? selectedNodeType}</span>
                  </div>
                </div>
                <div className="inspector-form" ref={inspectorPortalRef} />
              </>
            ) : (
              <div className="inspector-empty">
                <Settings className="h-8 w-8 opacity-15" />
                <span>点击节点查看配置</span>
              </div>
            )}
          </div>
        )}

        {activeTab === "log" && (
          <ExecutionLogContent events={events} />
        )}

        {activeTab === "variables" && (
          <VariablePanelContent />
        )}

        {activeTab === "history" && (
          <ExecutionHistoryContent />
        )}

        {activeTab === "versions" && (
          <VersionHistoryContent workflowId={workflowId} onRestore={onRestore} />
        )}

        {activeTab === "debug" && (
          <div className="p-3 space-y-3 text-xs">
            {isDebugging ? (
              <>
                <div className="font-semibold text-sm">调试模式</div>
                {debugContext ? (
                  <div className="space-y-2">
                    <div className="text-muted-foreground">当前暂停节点上下文:</div>
                    <div className="bg-muted/50 rounded p-2 overflow-auto max-h-[200px]">
                      <div className="font-medium mb-1">prev:</div>
                      <pre className="text-[10px] whitespace-pre-wrap break-all">
                        {JSON.stringify((debugContext as any)?.context?.prev ?? null, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-muted/50 rounded p-2 overflow-auto max-h-[200px]">
                      <div className="font-medium mb-1">variables:</div>
                      <pre className="text-[10px] whitespace-pre-wrap break-all">
                        {JSON.stringify((debugContext as any)?.context?.variables ?? {}, null, 2)}
                      </pre>
                    </div>
                    <div className="text-muted-foreground">
                      已执行节点数: {(debugContext as any)?.context?.node_count ?? 0}
                    </div>
                    {(debugContext as any)?.breakpoints && (
                      <div className="text-muted-foreground">
                        断点: {((debugContext as any).breakpoints as string[]).length} 个
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground">等待暂停...</div>
                )}
              </>
            ) : (
              <div className="inspector-empty">
                <Bug className="h-8 w-8 opacity-15" />
                <span>点击工具栏"调试"按钮开始调试</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
