import { createContext, useContext } from "react";

export interface UpstreamNode {
  id: string;
  title: string;
  type: string;
}

/**
 * Context that holds the upstream nodes for the currently-rendering node.
 * Set by DefaultNodeRender, consumed by form components (TextInput, TextArea).
 */
export const NodeUpstreamContext = createContext<UpstreamNode[]>([]);

export function useNodeUpstream(): UpstreamNode[] {
  return useContext(NodeUpstreamContext);
}
