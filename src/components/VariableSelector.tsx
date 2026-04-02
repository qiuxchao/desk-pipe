import { useState, useRef, useEffect } from "react";
import { NODE_OUTPUT_FIELDS } from "@/nodes/variable-specs";

interface UpstreamNode {
  id: string;
  title: string;
  type: string;
}

interface VariableSelectorProps {
  onSelect: (variable: string) => void;
  upstreamNodes?: UpstreamNode[];
}

export function VariableSelector({ onSelect, upstreamNodes = [] }: VariableSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Build dynamic groups
  const groups: { label: string; items: { value: string; code: string; desc: string }[] }[] = [];

  // 1. "prev" shortcut — fields from the immediate upstream node (last connected)
  const prevFields = new Map<string, string>();
  if (upstreamNodes.length > 0) {
    const lastNode = upstreamNodes[upstreamNodes.length - 1];
    const fields = NODE_OUTPUT_FIELDS[lastNode.type] || [];
    for (const f of fields) {
      prevFields.set(f.field, f.desc);
    }
  }
  // Always include generic "result"
  if (!prevFields.has("result")) prevFields.set("result", "结果");

  groups.push({
    label: "上一个节点",
    items: Array.from(prevFields.entries()).map(([field, desc]) => ({
      value: `{{prev.${field}}}`,
      code: `prev.${field}`,
      desc,
    })),
  });

  // 2. Each upstream node as a group
  for (const node of upstreamNodes) {
    const fields = NODE_OUTPUT_FIELDS[node.type] || [{ field: "result", desc: "结果" }];
    groups.push({
      label: node.title || node.id,
      items: fields.map((f) => ({
        value: `{{nodes.${node.id}.${f.field}}}`,
        code: `${node.id}.${f.field}`,
        desc: f.desc,
      })),
    });
  }

  // 3. Loop variables
  groups.push({
    label: "循环变量",
    items: [
      { value: "{{loop_item}}", code: "loop_item", desc: "当前循环项" },
      { value: "{{loop_index}}", code: "loop_index", desc: "当前循环索引" },
    ],
  });

  return (
    <div className="variable-selector" ref={ref}>
      <button
        type="button"
        className="variable-selector-btn"
        onClick={() => setOpen(!open)}
        title="插入变量引用"
      >
        {"{x}"}
      </button>
      {open && (
        <div className="variable-selector-dropdown">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="variable-selector-group">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.value}
                  className="variable-selector-item"
                  onClick={() => { onSelect(item.value); setOpen(false); }}
                >
                  <code className="variable-selector-code">{item.code}</code>
                  <span className="variable-selector-desc">{item.desc}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
