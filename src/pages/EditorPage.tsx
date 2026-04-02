import { useEffect, useMemo, useState, createContext, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  FreeLayoutEditorProvider,
  EditorRenderer,
  WorkflowNodeRenderer,
  Field,
  useNodeRender,
  type FreeLayoutProps,
  type WorkflowNodeProps,
} from "@flowgram.ai/free-layout-editor";
import { createFreeSnapPlugin } from "@flowgram.ai/free-snap-plugin";
import { createMinimapPlugin } from "@flowgram.ai/minimap-plugin";
import "@flowgram.ai/free-layout-editor/index.css";

import { nodeRegistries } from "@/nodes/registries";
import { NODE_PORT_SPECS, areTypesCompatible } from "@/nodes/port-types";
import { NODE_TYPE_CONFIG } from "@/nodes/constants";
import { NODE_ICONS } from "@/nodes/icons";
import { NodePanel } from "@/components/NodePanel";
import { Toolbar } from "@/components/Toolbar";
import { InspectorSidebar } from "@/components/InspectorSidebar";
import { useContextMenu, ContextMenu } from "@/components/NodeContextMenu";
import { useWorkflow } from "@/hooks/useWorkflow";
import { ExecutionContext, useExecutionState } from "@/contexts/ExecutionContext";
import { NodeUpstreamContext, type UpstreamNode } from "@/contexts/UpstreamContext";
import {
  SelectedNodeContext,
  useSelectedNode,
  useSelectedNodeProvider,
  type InspectorTab,
} from "@/contexts/SelectedNodeContext";
import type { Workflow } from "@/types/workflow";

// Context to pass showMenu down to DefaultNodeRender
interface ContextMenuAPI {
  showMenu: (state: { x: number; y: number; items: { label: string; onClick: () => void; destructive?: boolean; separator?: boolean }[] }) => void;
}
const ContextMenuContext = createContext<ContextMenuAPI>({ showMenu: () => {} });

// Context to pass breakpoints down to DefaultNodeRender
interface BreakpointAPI {
  breakpoints: Set<string>;
  toggleBreakpoint: (nodeId: string) => void;
}
const BreakpointContext = createContext<BreakpointAPI>({ breakpoints: new Set(), toggleBreakpoint: () => {} });

const BLANK_DATA = {
  nodes: [] as any[],
  edges: [] as any[],
};

function DefaultNodeRender(props: WorkflowNodeProps) {
  const { form, data, updateData, deleteNode } = useNodeRender();
  const { activeNodeId, nodeStatuses } = useExecutionState();
  const { showMenu } = useContext(ContextMenuContext);
  const { breakpoints: bpSet, toggleBreakpoint } = useContext(BreakpointContext);
  const { selectedNodeId, inspectorPortalRef, setSelectedNode } = useSelectedNode();
  const nodeId = (props.node as any)?.id;
  const nodeType = (props.node as any)?.flowNodeType as string | undefined;
  const isExecuting = activeNodeId != null && activeNodeId === nodeId;
  const status = nodeId ? nodeStatuses[nodeId] : undefined;
  const isDisabled = !!data?.disabled;
  const isSelected = selectedNodeId === nodeId;
  const hasBreakpoint = nodeId ? bpSet.has(nodeId) : false;

  const config = nodeType
    ? NODE_TYPE_CONFIG[nodeType as keyof typeof NODE_TYPE_CONFIG]
    : null;
  const title = (data?.title as string) || config?.label || nodeType || "节点";

  // Compute upstream nodes for variable selector
  const upstreamNodes = useMemo<UpstreamNode[]>(() => {
    try {
      const inputNodes = (props.node as any)?.lines?.allInputNodes;
      if (!inputNodes || !Array.isArray(inputNodes)) return [];
      return inputNodes.map((n: any) => ({
        id: n.id ?? "",
        title: n.getData?.()?.title ?? n.id ?? "",
        type: (n as any).flowNodeType ?? "",
      }));
    } catch {
      return [];
    }
  }, [props.node]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: isDisabled ? "启用节点" : "禁用节点",
            onClick: () => {
              updateData({ ...data, disabled: !isDisabled });
            },
          },
          {
            label: "测试运行",
            onClick: async () => {
              try {
                const nodeData = { ...data };
                delete nodeData.title;
                delete nodeData.disabled;
                const result = await invoke<string>("test_run_node", {
                  nodeType: nodeType || "",
                  configJson: JSON.stringify(nodeData),
                });
                const parsed = JSON.parse(result);
                const summary =
                  typeof parsed.result === "string"
                    ? parsed.result.slice(0, 200)
                    : JSON.stringify(parsed, null, 2).slice(0, 200);
                toast.success("测试完成: " + summary);
              } catch (e) {
                toast.error("测试失败: " + String(e));
              }
            },
          },
          {
            label: hasBreakpoint ? "取消断点" : "设置断点",
            onClick: () => {
              if (nodeId) toggleBreakpoint(nodeId);
            },
          },
          { label: "", onClick: () => {}, separator: true },
          {
            label: "删除节点",
            destructive: true,
            onClick: () => {
              deleteNode();
            },
          },
        ],
      });
    },
    [isDisabled, data, updateData, deleteNode, showMenu, nodeType, hasBreakpoint, nodeId, toggleBreakpoint]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (nodeId && nodeType) {
        setSelectedNode(nodeId, nodeType, title);
      }
    },
    [nodeId, nodeType, title, setSelectedNode]
  );

  return (
    <div onContextMenu={handleContextMenu} onClick={handleClick}>
      <WorkflowNodeRenderer
        className={`compact-node-card ${isExecuting ? "executing" : ""} ${status ? `node-${status}` : ""} ${isDisabled ? "node-disabled" : ""} ${isSelected ? "node-selected" : ""} ${hasBreakpoint ? "node-breakpoint" : ""}`}
        node={props.node}
      >
        {/* Compact display on canvas */}
        <div className="compact-node-inner">
          <div
            className="compact-node-icon"
            style={{ background: config?.color ?? "oklch(0.5 0 0)" }}
          >
            {config?.icon ? NODE_ICONS[config.icon] ?? null : null}
          </div>
          <span className="compact-node-title">{title}</span>
          {isExecuting && (
            <div className="compact-node-status status-running" />
          )}
          {status === "completed" && !isExecuting && (
            <div className="compact-node-status status-completed" />
          )}
          {status === "failed" && !isExecuting && (
            <div className="compact-node-status status-failed" />
          )}
        </div>

        {/* Condition port labels */}
        {nodeType === "condition" && (
          <div className="node-condition-ports">
            <span className="port-true">True</span>
            <span className="port-false">False</span>
          </div>
        )}

        {/* Form portaled to inspector when selected */}
        <NodeUpstreamContext.Provider value={upstreamNodes}>
          {isSelected && inspectorPortalRef.current
            ? createPortal(
                <div className="inspector-form-content">{form?.render()}</div>,
                inspectorPortalRef.current
              )
            : null}
        </NodeUpstreamContext.Provider>
      </WorkflowNodeRenderer>
    </div>
  );
}

interface EditorPageProps {
  workflowId?: string;
  onBack: () => void;
}

export function EditorPage({ workflowId, onBack }: EditorPageProps) {
  const [initialData, setInitialData] = useState<{
    nodes: any[];
    edges: any[];
  } | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [loadingData, setLoadingData] = useState(!!workflowId);
  const { menu, showMenu } = useContextMenu();
  const contextMenuAPI = useMemo(() => ({ showMenu }), [showMenu]);

  const [activeTab, setActiveTab] = useState<InspectorTab>("config");
  const selectedNodeProvider = useSelectedNodeProvider();

  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set());

  const {
    workflowName,
    setWorkflowName,
    workflowId: currentWorkflowId,
    workflowShortcut,
    isRunning,
    isDebugging,
    debugContext,
    events,
    activeNodeId,
    nodeResults,
    nodeStatuses,
    lastError,
    statusMessage,
    isDirty,
    markDirty,
    saveWorkflow,
    executeWorkflow,
    debugWorkflow,
    debugAction,
    getCurrentWorkflowJSON,
    setDocumentGetter,
    bindShortcut,
    unbindShortcut,
    setInitialWorkflow,
  } = useWorkflow();

  // Auto-switch to log tab when executing
  const handleExecute = useCallback(async () => {
    setActiveTab("log");
    await executeWorkflow();
  }, [executeWorkflow]);

  const handleDebug = useCallback(async () => {
    setActiveTab("debug");
    await debugWorkflow(Array.from(breakpoints));
  }, [debugWorkflow, breakpoints]);

  const toggleBreakpoint = useCallback((nodeId: string) => {
    setBreakpoints(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const breakpointAPI = useMemo<BreakpointAPI>(() => ({ breakpoints, toggleBreakpoint }), [breakpoints, toggleBreakpoint]);

  // Load workflow data if editing existing
  useEffect(() => {
    if (workflowId) {
      invoke<string>("load_workflow", { workflowId })
        .then((json) => {
          const wf: Workflow = JSON.parse(json);
          setInitialWorkflow(wf);
          setInitialData({ nodes: wf.nodes, edges: wf.edges });
          setLoadingData(false);
        })
        .catch((e) => {
          console.error("Failed to load workflow:", e);
          setInitialData(BLANK_DATA);
          setLoadingData(false);
        });
    } else {
      setInitialData(BLANK_DATA);
    }
  }, [workflowId, setInitialWorkflow]);

  // Keyboard shortcuts: Cmd+S to save, Cmd+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveWorkflow();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleExecute();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveWorkflow, handleExecute]);

  // Click canvas blank area to clear node selection (not close sidebar)
  const handleCanvasClick = useCallback(() => {
    selectedNodeProvider.value.clearSelectedNode();
  }, [selectedNodeProvider]);

  const editorProps = useMemo<FreeLayoutProps>(
    () => ({
      nodeRegistries,
      initialData: initialData!,
      background: true,
      readonly: false,
      nodeEngine: { enable: true },
      history: { enable: true, enableChangeNode: true },
      canAddLine(_ctx, fromPort, toPort) {
        if (fromPort.node === toPort.node) return false;
        if (fromPort.node.lines?.allInputNodes?.includes(toPort.node)) return false;

        const fromType = (fromPort.node as any)?.flowNodeType;
        const toType = (toPort.node as any)?.flowNodeType;
        const fromSpec = fromType ? NODE_PORT_SPECS[fromType] : undefined;
        const toSpec = toType ? NODE_PORT_SPECS[toType] : undefined;

        if (fromSpec?.outputType && toSpec?.inputType) {
          return areTypesCompatible(fromSpec.outputType, toSpec.inputType);
        }
        return true;
      },
      getNodeDefaultRegistry(type) {
        return {
          type,
          meta: { defaultExpanded: true },
          formMeta: {
            render: () => (
              <Field<string> name="title">
                {({ field }) => (
                  <div className="demo-free-node-title">{field.value}</div>
                )}
              </Field>
            ),
          },
        };
      },
      materials: {
        renderDefaultNode: DefaultNodeRender,
      },
      onInit: (ctx) => {
        setDocumentGetter(
          () =>
            ctx.document.toJSON() as { nodes: unknown[]; edges: unknown[] }
        );
      },
      onAllLayersRendered(ctx) {
        ctx.document.fitView(false);
      },
      plugins: () => [
        createMinimapPlugin({ disableLayer: true }),
        createFreeSnapPlugin({}),
      ],
    }),
    [initialData, setDocumentGetter]
  );

  if (loadingData || !initialData) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">加载工作流...</span>
        </div>
      </div>
    );
  }

  return (
    <ExecutionContext.Provider value={{ activeNodeId, nodeResults, nodeStatuses }}>
      <SelectedNodeContext.Provider value={selectedNodeProvider.value}>
        <ContextMenuContext.Provider value={contextMenuAPI}>
          <BreakpointContext.Provider value={breakpointAPI}>
          <div className="w-screen h-screen flex flex-col bg-background font-sans">
            <Toolbar
              onBack={onBack}
              onSave={saveWorkflow}
              onExecute={handleExecute}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isRunning={isRunning}
              workflowName={workflowName}
              onNameChange={setWorkflowName}
              currentShortcut={workflowShortcut}
              shortcutError={lastError}
              statusMessage={statusMessage}
              getCurrentWorkflowJSON={getCurrentWorkflowJSON}
              onBindShortcut={bindShortcut}
              onUnbindShortcut={unbindShortcut}
              isDebugging={isDebugging}
              onDebug={handleDebug}
              onDebugAction={debugAction}
              debugContext={debugContext}
              hasUnsavedChanges={isDirty}
            />

            <div className="flex flex-1 overflow-hidden">
              <FreeLayoutEditorProvider key={editorKey} {...editorProps}>
                <div className="flex-1 relative" onClick={handleCanvasClick} onMouseDown={markDirty}>
                  <EditorRenderer className="demo-free-editor" />
                  <NodePanel />
                </div>
                <InspectorSidebar
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  events={events}
                  workflowId={currentWorkflowId}
                  isDebugging={isDebugging}
                  debugContext={debugContext}
                  onRestore={(json) => {
                    const wf: Workflow = JSON.parse(json);
                    setInitialWorkflow(wf);
                    setInitialData({ nodes: wf.nodes, edges: wf.edges });
                    setEditorKey(k => k + 1);
                    setActiveTab("config");
                  }}
                />
              </FreeLayoutEditorProvider>
            </div>

            <ContextMenu menu={menu} />
          </div>
          </BreakpointContext.Provider>
        </ContextMenuContext.Provider>
      </SelectedNodeContext.Provider>
    </ExecutionContext.Provider>
  );
}
