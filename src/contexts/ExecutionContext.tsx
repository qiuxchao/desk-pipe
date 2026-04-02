import { createContext, useContext } from "react";

interface ExecutionState {
  activeNodeId: string | null;
  nodeResults: Record<string, unknown>;
  nodeStatuses: Record<string, "completed" | "failed" | "skipped">;
}

export const ExecutionContext = createContext<ExecutionState>({
  activeNodeId: null,
  nodeResults: {},
  nodeStatuses: {},
});

export function useExecutionState() {
  return useContext(ExecutionContext);
}
