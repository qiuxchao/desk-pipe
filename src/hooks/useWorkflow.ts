import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import type { Workflow, WorkflowEvent } from "@/types/workflow";

export function useWorkflow() {
  const [workflowName, setWorkflowName] = useState("My Workflow");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowShortcut, setWorkflowShortcut] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugContext, setDebugContext] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeResults, setNodeResults] = useState<Record<string, unknown>>({});
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "completed" | "failed" | "skipped">>({});
  const [shellOutput, setShellOutput] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const getDocRef = useRef<(() => { nodes: unknown[]; edges: unknown[] }) | null>(null);

  // Auto-clear status message after 2s
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 2000);
      return () => clearTimeout(t);
    }
  }, [statusMessage]);

  useEffect(() => {
    const unlistenShell = listen<{ line: string; stream: string }>("shell_output", (event) => {
      setShellOutput((prev) => [...prev, `[${event.payload.stream}] ${event.payload.line}`]);
    });

    const unlisten = listen<WorkflowEvent>("workflow_event", (event) => {
      const data = event.payload;
      setEvents((prev) => [...prev, data]);

      if (data.event_type === "node_started") {
        setActiveNodeId(data.node_id ?? null);
      } else if (data.event_type === "node_completed") {
        setActiveNodeId(null);
        if (data.node_id && data.data) {
          setNodeResults((prev) => ({
            ...prev,
            [data.node_id!]: data.data,
          }));
        }
        if (data.node_id) {
          setNodeStatuses(prev => ({ ...prev, [data.node_id!]: "completed" }));
        }
      } else if (data.event_type === "node_skipped") {
        if (data.node_id) {
          setNodeStatuses(prev => ({ ...prev, [data.node_id!]: "skipped" }));
        }
      } else if (data.event_type === "node_failed") {
        setActiveNodeId(null);
        if (data.node_id) {
          setNodeStatuses(prev => ({ ...prev, [data.node_id!]: "failed" }));
        }
      }

      if (data.event_type === "debug_pause") {
        const payload = data.data as Record<string, unknown> | undefined;
        if (payload && !payload.auto_continue) {
          setIsDebugging(true);
          setActiveNodeId(data.node_id ?? null);
          setDebugContext(payload as Record<string, unknown>);
        }
      }

      if (data.event_type === "completed" || data.event_type === "failed") {
        setIsRunning(false);
        setIsDebugging(false);
        setDebugContext(null);
        setActiveNodeId(null);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenShell.then((fn) => fn());
    };
  }, []);

  const setDocumentGetter = useCallback(
    (getter: () => { nodes: unknown[]; edges: unknown[] }) => {
      getDocRef.current = getter;
    },
    []
  );

  const doSave = useCallback(async (): Promise<string | null> => {
    const getter = getDocRef.current;
    if (!getter) return null;

    const doc = getter();
    const id = workflowId ?? `wf_${nanoid()}`;
    const workflow: Workflow = {
      id,
      name: workflowName,
      nodes: doc.nodes as Workflow["nodes"],
      edges: doc.edges as Workflow["edges"],
      shortcut: workflowShortcut,
    };

    try {
      const savedId = await invoke<string>("save_workflow", {
        workflowJson: JSON.stringify(workflow),
      });
      setWorkflowId(savedId);
      setIsDirty(false);
      return savedId;
    } catch (e) {
      console.error("Save failed:", e);
      toast.error("保存失败: " + e);
      return null;
    }
  }, [workflowId, workflowName, workflowShortcut]);

  const saveWorkflow = useCallback(async () => {
    const id = await doSave();
    if (id) {
      toast.success("已保存");
    }
  }, [doSave]);

  const executeWorkflow = useCallback(async () => {
    let id = workflowId;
    if (!id) {
      id = await doSave();
      if (!id) return;
    } else {
      await doSave();
    }

    setEvents([]);
    setNodeResults({});
    setNodeStatuses({});
    setShellOutput([]);
    setIsRunning(true);
    setActiveNodeId(null);

    try {
      await invoke("execute_workflow", { workflowId: id });
    } catch (e) {
      console.error("Execution failed:", e);
      toast.error("执行失败: " + e);
      setIsRunning(false);
    }
  }, [workflowId, doSave]);

  const debugWorkflow = useCallback(async (breakpoints: string[] = []) => {
    let id = workflowId;
    if (!id) {
      id = await doSave();
      if (!id) return;
    } else {
      await doSave();
    }

    setEvents([]);
    setNodeResults({});
    setNodeStatuses({});
    setShellOutput([]);
    setIsRunning(true);
    setIsDebugging(true);
    setDebugContext(null);
    setActiveNodeId(null);

    try {
      await invoke("debug_workflow", { workflowId: id, breakpoints });
    } catch (e) {
      console.error("Debug execution failed:", e);
      toast.error("调试失败: " + e);
      setIsRunning(false);
      setIsDebugging(false);
    }
  }, [workflowId, doSave]);

  const debugAction = useCallback(async (action: string) => {
    try {
      await invoke("debug_action", { action });
    } catch (e) {
      console.error("Debug action failed:", e);
      toast.error("调试指令失败: " + e);
    }
  }, []);

  const setInitialWorkflow = useCallback((wf: Workflow) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setWorkflowShortcut(wf.shortcut ?? undefined);
    setEvents([]);
    setNodeResults({});
    setNodeStatuses({});
  }, []);

  const bindShortcut = useCallback(
    async (shortcut: string) => {
      let id = workflowId;
      if (!id) {
        id = await doSave();
        if (!id) return;
      }
      try {
        await invoke("bind_workflow_shortcut", {
          workflowId: id,
          shortcut,
        });
        setWorkflowShortcut(shortcut);
        setLastError(null);
        toast.success("快捷键 " + shortcut + " 已绑定");
      } catch (e) {
        const msg = String(e);
        console.error("Bind shortcut failed:", msg);
        toast.error("快捷键绑定失败: " + msg);
        setLastError(msg);
      }
    },
    [workflowId, doSave]
  );

  const unbindShortcut = useCallback(async () => {
    if (!workflowId) return;
    try {
      await invoke("unbind_workflow_shortcut", { workflowId });
      setWorkflowShortcut(undefined);
      setLastError(null);
    } catch (e) {
      console.error("Unbind shortcut failed:", e);
    }
  }, [workflowId]);

  const getCurrentWorkflowJSON = useCallback((): Workflow | null => {
    const getter = getDocRef.current;
    if (!getter) return null;
    const doc = getter();
    return {
      id: workflowId ?? `wf_${nanoid()}`,
      name: workflowName,
      nodes: doc.nodes as Workflow["nodes"],
      edges: doc.edges as Workflow["edges"],
      shortcut: workflowShortcut,
    };
  }, [workflowId, workflowName, workflowShortcut]);

  const setWorkflowNameAndDirty = useCallback((name: string) => {
    setWorkflowName(name);
    setIsDirty(true);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  return {
    workflowName,
    setWorkflowName: setWorkflowNameAndDirty,
    isDirty,
    markDirty,
    workflowId,
    workflowShortcut,
    isRunning,
    isDebugging,
    debugContext,
    events,
    activeNodeId,
    nodeResults,
    nodeStatuses,
    shellOutput,
    lastError,
    statusMessage,
    saveWorkflow,
    executeWorkflow,
    debugWorkflow,
    debugAction,
    setInitialWorkflow,
    getCurrentWorkflowJSON,
    setDocumentGetter,
    bindShortcut,
    unbindShortcut,
  };
}
