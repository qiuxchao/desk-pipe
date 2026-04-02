import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNodeRender } from "@flowgram.ai/free-layout-editor";

interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  provider_type: string;
  is_default: boolean;
}

/**
 * Provider selector for AI nodes.
 * Loads providers from global settings (configured in Settings page).
 * Sets `provider_id` on the node config — backend resolves the full credentials.
 */
export function AiPresetSelector() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const { data, updateData } = useNodeRender();

  useEffect(() => {
    invoke<string>("get_ai_providers")
      .then(json => setProviders(JSON.parse(json)))
      .catch(() => {});
  }, []);

  const currentProviderId = (data?.provider_id as string) || "";

  if (providers.length === 0) {
    return (
      <div className="node-field">
        <label>AI 提供商</label>
        <div style={{ fontSize: 11, color: "var(--node-label-color)", padding: "6px 0" }}>
          请先在设置中添加 AI 提供商
        </div>
      </div>
    );
  }

  return (
    <div className="node-field">
      <label>AI 提供商</label>
      <select
        value={currentProviderId}
        onChange={(e) => {
          if (data) {
            const provider = providers.find(p => p.id === e.target.value);
            updateData({
              ...data,
              provider_id: e.target.value,
              // Allow model override — pre-fill with provider's default model
              model: provider?.model || data.model || "",
            });
          }
        }}
      >
        <option value="">使用默认提供商</option>
        {providers.map(p => (
          <option key={p.id} value={p.id}>
            {p.name || p.id}{p.model ? ` (${p.model})` : ""}{p.is_default ? " ★" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
