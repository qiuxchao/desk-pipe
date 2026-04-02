import { useState, useMemo } from "react";
import { NODE_TYPE_CONFIG } from "@/nodes/constants";
import { NODE_ICONS } from "@/nodes/icons";
import { NODE_CATEGORIES } from "@/nodes/port-types";
import { WorkflowDragService, useService } from "@flowgram.ai/free-layout-editor";
import type { NodeType } from "@/types/workflow";
import { nodeRegistries } from "@/nodes/registries";
import { Search, PanelLeftOpen, X } from "lucide-react";

export function NodePanel() {
  const dragService = useService<WorkflowDragService>(WorkflowDragService);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const results: { type: string; config: (typeof NODE_TYPE_CONFIG)[NodeType] }[] = [];
    for (const cat of NODE_CATEGORIES) {
      for (const type of cat.types) {
        const config = NODE_TYPE_CONFIG[type as NodeType];
        if (!config) continue;
        if (
          config.label.toLowerCase().includes(q) ||
          (config.description && config.description.toLowerCase().includes(q))
        ) {
          results.push({ type, config });
        }
      }
    }
    return results;
  }, [search]);

  const renderNodeItem = (type: string, config: (typeof NODE_TYPE_CONFIG)[NodeType]) => {
    const registry = nodeRegistries.find((r) => r.type === type);
    const defaultData = registry?.onAdd?.({} as any);

    return (
      <div
        key={type}
        className="group flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-grab hover:bg-accent/80 active:cursor-grabbing transition-colors select-none"
        onMouseDown={(e) => {
          dragService.startDragCard(type, e as any, {
            data: defaultData?.data ?? { title: config.label },
          });
        }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md text-white shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)` }}
        >
          {NODE_ICONS[config.icon] ?? null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-medium truncate leading-tight">
            {config.label}
          </div>
          <div className="text-[9.5px] text-muted-foreground truncate leading-tight mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {config.description}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Toggle button — always visible on the left edge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute left-3 top-3 z-30 w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border shadow-sm hover:bg-accent transition-colors"
          title="节点面板"
        >
          <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Backdrop — close on click */}
      {open && (
        <div
          className="absolute inset-0 z-20"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`absolute left-0 top-0 bottom-0 z-30 w-56 bg-card/95 backdrop-blur-md border-r border-border flex flex-col shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">节点</span>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索节点..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 pl-7 pr-2 text-[11px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {filteredItems !== null ? (
            <div className="flex flex-col gap-0.5 px-1.5">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  没有匹配的节点
                </div>
              ) : (
                filteredItems.map(({ type, config }) => renderNodeItem(type, config))
              )}
            </div>
          ) : (
            NODE_CATEGORIES.map((cat) => (
              <div key={cat.label} className="mb-2">
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {cat.label}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 px-1.5">
                  {cat.types.map((type) => {
                    const config = NODE_TYPE_CONFIG[type as NodeType];
                    if (!config) return null;
                    return renderNodeItem(type, config);
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
