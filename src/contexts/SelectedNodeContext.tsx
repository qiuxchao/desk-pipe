import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import type { RefObject } from "react";

export type InspectorTab = "config" | "log" | "variables" | "history" | "versions" | "debug";

interface SelectedNodeState {
  selectedNodeId: string | null;
  selectedNodeType: string | null;
  selectedNodeTitle: string | null;
  inspectorPortalRef: RefObject<HTMLDivElement | null>;
  setSelectedNode: (id: string, type: string, title: string) => void;
  clearSelectedNode: () => void;
}

const SelectedNodeContext = createContext<SelectedNodeState>({
  selectedNodeId: null,
  selectedNodeType: null,
  selectedNodeTitle: null,
  inspectorPortalRef: { current: null },
  setSelectedNode: () => {},
  clearSelectedNode: () => {},
});

export function useSelectedNode() {
  return useContext(SelectedNodeContext);
}

export function useSelectedNodeProvider() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [selectedNodeTitle, setSelectedNodeTitle] = useState<string | null>(null);
  const inspectorPortalRef = useRef<HTMLDivElement>(null);

  const setSelectedNode = useCallback((id: string, type: string, title: string) => {
    setSelectedNodeId(id);
    setSelectedNodeType(type);
    setSelectedNodeTitle(title);
  }, []);

  const clearSelectedNode = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
    setSelectedNodeTitle(null);
  }, []);

  const value = useMemo(() => ({
    selectedNodeId,
    selectedNodeType,
    selectedNodeTitle,
    inspectorPortalRef,
    setSelectedNode,
    clearSelectedNode,
  }), [selectedNodeId, selectedNodeType, selectedNodeTitle, setSelectedNode, clearSelectedNode]);

  return { value };
}

export { SelectedNodeContext };
