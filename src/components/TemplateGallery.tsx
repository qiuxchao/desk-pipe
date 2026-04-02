import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { templates, templateCategories, categoryLabels } from "@/data/templates";
import type { TemplateCategory } from "@/data/templates";
import { Terminal, Clipboard, FileText, Globe, X, Sparkles, Search, Link } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

const ICONS: Record<string, React.ReactNode> = {
  terminal: <Terminal className="h-5 w-5" />,
  clipboard: <Clipboard className="h-5 w-5" />,
  file: <FileText className="h-5 w-5" />,
  globe: <Globe className="h-5 w-5" />,
  sparkles: <Sparkles className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  ai: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  file: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  system: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  dev: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  data: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

interface TemplateGalleryProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: (typeof templates)[0]) => void;
}

export function TemplateGallery({ visible, onClose, onSelect }: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  if (!visible) return null;

  const filteredTemplates = templates.filter((tpl) => {
    const matchesCategory = activeCategory === "all" || tpl.category === activeCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      tpl.name.toLowerCase().includes(query) ||
      tpl.description.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError("");
    try {
      await invoke("import_workflow_from_url", { url: importUrl.trim() });
      setImportUrl("");
      onClose();
    } catch (e) {
      setImportError(String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 backdrop-blur-sm">
      <Card className="w-full max-w-[680px] max-h-[80vh] flex flex-col shadow-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">工作流模板</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search + Category Tabs */}
        <div className="px-5 pt-3 pb-2 space-y-3 border-b border-border">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {templateCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeCategory === cat.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {filteredTemplates.map((tpl, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onSelect(tpl)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    {ICONS[tpl.icon] ?? null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{tpl.name}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</div>
                <div className="flex items-center justify-between mt-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 border-0 ${CATEGORY_COLORS[tpl.category]}`}
                  >
                    {categoryLabels[tpl.category]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {tpl.workflow.nodes.length} 个节点
                  </span>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                没有找到匹配的模板
              </div>
            )}
          </div>
        </div>

        {/* Import from URL */}
        <div className="px-5 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              placeholder="从 URL 导入工作流 JSON..."
              value={importUrl}
              onChange={(e) => {
                setImportUrl(e.target.value);
                setImportError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleImportFromUrl();
              }}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              className="h-8 text-xs shrink-0"
              disabled={importing || !importUrl.trim()}
              onClick={handleImportFromUrl}
            >
              {importing ? "导入中..." : "导入"}
            </Button>
          </div>
          {importError && (
            <p className="text-xs text-destructive mt-1.5">{importError}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
