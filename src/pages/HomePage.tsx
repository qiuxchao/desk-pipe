import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TemplateGallery } from "@/components/TemplateGallery";
import {
  Plus, Upload, Workflow, Play, Pencil, Trash2, Download,
  Keyboard, Clock, Settings, Search, Copy, Sun, Moon, Monitor, FolderOpen, Loader2,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useTheme } from "@/hooks/useTheme";
import type { Workflow as WorkflowType } from "@/types/workflow";
import { NODE_TYPE_CONFIG } from "@/nodes/constants";

interface HomePageProps {
  onNewWorkflow: () => void;
  onEditWorkflow: (workflowId: string) => void;
  onOpenSettings: () => void;
}

export function HomePage({ onNewWorkflow, onEditWorkflow, onOpenSettings }: HomePageProps) {
  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "group">("name");
  const [groupModal, setGroupModal] = useState<{ wf: WorkflowType; value: string } | null>(null);
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const loadWorkflows = useCallback(async () => {
    try {
      const json = await invoke<string>("list_workflows");
      setWorkflows(JSON.parse(json));
    } catch (e) {
      console.error("加载工作流失败:", e);
      toast.error("加载工作流失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleDelete = async (id: string, name: string) => {
    // 使用 Tauri dialog 替代 confirm (webview 中 confirm 可能不阻塞)
    const { ask } = await import("@tauri-apps/plugin-dialog");
    const confirmed = await ask(`确定删除工作流「${name}」吗？`, { title: "删除确认", kind: "warning" });
    if (!confirmed) return;
    try {
      await invoke("delete_workflow", { workflowId: id });
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      console.error("删除失败:", e);
      toast.error("删除失败");
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await invoke("execute_workflow", { workflowId: id });
      toast.success("工作流已启动");
    } catch (e) {
      console.error("执行失败:", e);
      toast.error("执行失败: " + e);
    }
  };

  const handleExport = async (wf: WorkflowType) => {
    try {
      const path = await save({
        defaultPath: `${wf.name}.deskpipe.json`,
        filters: [{ name: "DeskPipe", extensions: ["json"] }],
      });
      if (path) {
        await writeTextFile(path, JSON.stringify(wf, null, 2));
        toast.success("导出成功");
      }
    } catch (e) {
      console.error("导出失败:", e);
      toast.error("导出失败");
    }
  };

  const handleImport = async () => {
    try {
      const path = await open({
        filters: [{ name: "DeskPipe", extensions: ["json"] }],
      });
      if (path) {
        const content = await readTextFile(path as string);
        const workflow = JSON.parse(content);
        workflow.id = `wf_${nanoid()}`;
        await invoke("save_workflow", { workflowJson: JSON.stringify(workflow) });
        await loadWorkflows();
        toast.success("导入成功");
      }
    } catch (e) {
      console.error("导入失败:", e);
      toast.error("导入失败");
    }
  };

  const handleSelectTemplate = async (tpl: { name: string; workflow: Omit<WorkflowType, "id"> }) => {
    const workflow: WorkflowType = { ...tpl.workflow, id: `wf_${nanoid()}` };
    try {
      await invoke("save_workflow", { workflowJson: JSON.stringify(workflow) });
      await loadWorkflows();
    } catch (e) {
      console.error("从模板创建失败:", e);
      toast.error("从模板创建失败");
    }
  };

  const actionNodes = (wf: WorkflowType) =>
    wf.nodes.filter((n) => n.type !== "start" && n.type !== "end");

  const groups = useMemo(() => {
    const set = new Set<string>();
    workflows.forEach(wf => { if (wf.group) set.add(wf.group); });
    return Array.from(set).sort();
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    let result = workflows;
    if (selectedGroup) {
      result = result.filter(wf => wf.group === selectedGroup);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(wf => wf.name.toLowerCase().includes(q));
    }
    // Apply sorting
    result = [...result].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "zh");
      }
      // sort by group
      const ga = a.group || "";
      const gb = b.group || "";
      return ga.localeCompare(gb, "zh") || a.name.localeCompare(b.name, "zh");
    });
    return result;
  }, [workflows, searchQuery, selectedGroup, sortBy]);

  const handleClone = async (wf: WorkflowType) => {
    try {
      const cloned: WorkflowType = {
        ...JSON.parse(JSON.stringify(wf)),
        id: `wf_${nanoid()}`,
        name: `${wf.name} (副本)`,
      };
      await invoke("save_workflow", { workflowJson: JSON.stringify(cloned) });
      await loadWorkflows();
      toast.success("工作流已复制");
    } catch (e) {
      console.error("复制失败:", e);
      toast.error("复制失败");
    }
  };

  const handleSetGroup = (wf: WorkflowType) => {
    setGroupModal({ wf, value: wf.group || "" });
  };

  const handleGroupModalSave = async () => {
    if (!groupModal) return;
    const updated = { ...groupModal.wf, group: groupModal.value.trim() || undefined };
    try {
      await invoke("save_workflow", { workflowJson: JSON.stringify(updated) });
      await loadWorkflows();
    } catch (e) {
      console.error(e);
      toast.error("设置分组失败");
    }
    setGroupModal(null);
  };

  const getNodeTypeBadges = (wf: WorkflowType) => {
    const nodes = actionNodes(wf);
    const uniqueTypes = [...new Set(nodes.map((n) => n.type))];
    const maxShow = 4;
    const visible = uniqueTypes.slice(0, maxShow);
    const remaining = uniqueTypes.length - maxShow;
    return { visible, remaining };
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-8 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <Workflow className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight">DeskPipe</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={`主题: ${theme === "light" ? "浅色" : theme === "dark" ? "深色" : "跟随系统"}`}
            onClick={cycleTheme}
          >
            <ThemeIcon className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={onOpenSettings}>
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            设置
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleImport}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            导入
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowTemplates(true)}>
            从模板创建
          </Button>
          <Button size="sm" className="text-xs" onClick={onNewWorkflow}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            新建工作流
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {/* Section header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight">我的工作流</h2>
            <p className="text-sm text-muted-foreground mt-1">
              创建、编辑、执行你的自动化工作流
            </p>
          </div>

          {/* Search + Sort */}
          {!loading && workflows.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索工作流..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "group")}>
                <SelectTrigger size="sm" className="text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">按名称</SelectItem>
                  <SelectItem value="group">按分组</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Group filter tabs */}
          {!loading && groups.length > 0 && (
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              <button
                onClick={() => setSelectedGroup(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedGroup ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                全部
              </button>
              {groups.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g === selectedGroup ? null : g)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedGroup === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
          ) : workflows.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center py-28">
              <div className="h-14 w-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-5">
                <Workflow className="h-7 w-7 text-primary/50" />
              </div>
              <h3 className="text-base font-semibold mb-2">开始你的第一个自动化</h3>
              <p className="text-sm text-muted-foreground mb-8 text-center max-w-[280px] leading-relaxed">
                用拖拽方式编排工作流，绑定快捷键一键触发
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => setShowTemplates(true)}>
                  从模板开始
                </Button>
                <Button size="sm" className="h-9 px-4" onClick={onNewWorkflow}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  空白工作流
                </Button>
              </div>
            </div>
          ) : (
            /* Workflow list — Linear-style rows instead of cards */
            <div className="border border-border rounded-lg overflow-hidden">
              {filteredWorkflows.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-12">
                  没有匹配的工作流
                </div>
              ) : filteredWorkflows.map((wf, idx) => {
                const nodes = actionNodes(wf);
                const { visible: visibleTypes, remaining } = getNodeTypeBadges(wf);
                return (
                  <div
                    key={wf.id}
                    className={`group flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 cursor-pointer transition-colors ${
                      idx !== filteredWorkflows.length - 1 ? "border-b border-border" : ""
                    }`}
                    onClick={() => onEditWorkflow(wf.id)}
                  >
                    {/* Icon */}
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Workflow className="h-4 w-4 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{wf.name}</div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {nodes.length} 个节点
                        </span>
                        {wf.shortcut && (
                          <Badge variant="outline" className="text-[10px] gap-0.5 h-4 px-1.5">
                            <Keyboard className="h-2.5 w-2.5" />
                            {wf.shortcut}
                          </Badge>
                        )}
                        {wf.cron && (
                          <Badge variant="outline" className="text-[10px] gap-0.5 h-4 px-1.5">
                            <Clock className="h-2.5 w-2.5" />
                            {wf.cron}
                          </Badge>
                        )}
                        {wf.group && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-0.5 h-4 px-1.5 cursor-pointer hover:bg-accent"
                            onClick={(e) => { e.stopPropagation(); setSelectedGroup(wf.group!); }}
                          >
                            <FolderOpen className="h-2.5 w-2.5" />
                            {wf.group}
                          </Badge>
                        )}
                        {visibleTypes.map((type) => {
                          const config = NODE_TYPE_CONFIG[type as keyof typeof NODE_TYPE_CONFIG];
                          return config ? (
                            <Badge
                              key={type}
                              variant="secondary"
                              className="text-[10px] h-4 px-1.5"
                            >
                              {config.label}
                            </Badge>
                          ) : null;
                        })}
                        {remaining > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            +{remaining}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions — visible on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="执行"
                        onClick={(e) => { e.stopPropagation(); handleExecute(wf.id); }}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="编辑"
                        onClick={(e) => { e.stopPropagation(); onEditWorkflow(wf.id); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="复制"
                        onClick={(e) => { e.stopPropagation(); handleClone(wf); }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="导出"
                        onClick={(e) => { e.stopPropagation(); handleExport(wf); }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="设置分组"
                        onClick={(e) => { e.stopPropagation(); handleSetGroup(wf); }}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={(e) => { e.stopPropagation(); handleDelete(wf.id, wf.name); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showTemplates && (
        <TemplateGallery
          visible
          onClose={() => setShowTemplates(false)}
          onSelect={(tpl) => { handleSelectTemplate(tpl); setShowTemplates(false); }}
        />
      )}

      {/* Group name modal */}
      {groupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg shadow-lg p-5 w-80">
            <h3 className="text-sm font-semibold mb-3">设置分组</h3>
            <Input
              autoFocus
              placeholder="输入分组名称（留空移除分组）"
              value={groupModal.value}
              onChange={(e) => setGroupModal({ ...groupModal, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") handleGroupModalSave(); }}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setGroupModal(null)}>
                取消
              </Button>
              <Button size="sm" onClick={handleGroupModalSave}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
