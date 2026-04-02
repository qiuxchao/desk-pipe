import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Save, Play, Loader2, Pencil, History, Variable,
  Download, ArrowLeft, Check, GitBranch, Bug,
  SkipForward, StepForward, FastForward, Square,
} from "lucide-react";
import { ShortcutBinder } from "@/components/ShortcutBinder";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Workflow } from "@/types/workflow";
import type { InspectorTab } from "@/contexts/SelectedNodeContext";

interface ToolbarProps {
  onBack: () => void;
  onSave: () => void;
  onExecute: () => void;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  isRunning: boolean;
  isDebugging?: boolean;
  workflowName: string;
  onNameChange: (name: string) => void;
  currentShortcut?: string;
  shortcutError?: string | null;
  statusMessage?: string | null;
  getCurrentWorkflowJSON: () => Workflow | null;
  onBindShortcut: (shortcut: string) => void;
  onUnbindShortcut: () => void;
  onDebug?: () => void;
  onDebugAction?: (action: string) => void;
  debugContext?: Record<string, unknown> | null;
  hasUnsavedChanges?: boolean;
}

export function Toolbar({
  onBack,
  onSave,
  onExecute,
  activeTab,
  onTabChange,
  isRunning,
  isDebugging,
  workflowName,
  onNameChange,
  currentShortcut,
  shortcutError,
  statusMessage,
  getCurrentWorkflowJSON,
  onBindShortcut,
  onUnbindShortcut,
  onDebug,
  onDebugAction,
  debugContext: _debugContext,
  hasUnsavedChanges,
}: ToolbarProps) {
  const [editing, setEditing] = useState(false);

  const handleExport = async () => {
    const wf = getCurrentWorkflowJSON();
    if (!wf) return;
    try {
      const path = await save({
        defaultPath: `${wf.name}.deskpipe.json`,
        filters: [{ name: "DeskPipe", extensions: ["json"] }],
      });
      if (path) {
        await writeTextFile(path, JSON.stringify(wf, null, 2));
      }
    } catch (e) {
      console.error("导出失败:", e);
    }
  };

  const tabBtn = (tab: InspectorTab, Icon: typeof Variable, label: string) => (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 text-[11px] px-2 ${activeTab === tab ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground"}`}
      onClick={() => onTabChange(tab)}
    >
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Button>
  );

  return (
    <div className="flex h-11 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-2 shrink-0">
      {/* Left side */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack} title="返回">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-4 mx-0.5" />
        {editing ? (
          <Input
            autoFocus
            value={workflowName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            className="h-7 w-auto min-w-32 max-w-48 text-sm"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-[13px] font-semibold hover:text-primary transition-colors px-1"
          >
            {workflowName || "未命名工作流"}
            {hasUnsavedChanges && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1" />}
            <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        )}
        <ShortcutBinder
          currentShortcut={currentShortcut}
          error={shortcutError}
          onBind={onBindShortcut}
          onUnbind={onUnbindShortcut}
        />
        {statusMessage && (
          <span className="flex items-center gap-1 text-xs text-primary animate-in fade-in ml-1">
            <Check className="h-3 w-3" />
            {statusMessage}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-0.5">
        {tabBtn("variables", Variable, "变量")}
        {tabBtn("history", History, "历史")}
        {tabBtn("versions", GitBranch, "版本")}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleExport} title="导出">
          <Download className="h-3 w-3" />
        </Button>
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Button variant="outline" size="sm" className="h-7 text-[11px] px-3" onClick={onSave} title="保存 (⌘S)">
          <Save className="h-3 w-3 mr-1" />
          保存
          <span className="text-muted-foreground ml-1 text-[9px]">⌘S</span>
        </Button>
        {isDebugging ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2"
              onClick={() => onDebugAction?.("step")}
              title="下一步 (Step)"
            >
              <StepForward className="h-3 w-3 mr-1" />
              下一步
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2"
              onClick={() => onDebugAction?.("skip")}
              title="跳过 (Skip)"
            >
              <SkipForward className="h-3 w-3 mr-1" />
              跳过
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2"
              onClick={() => onDebugAction?.("continue")}
              title="继续 (Continue)"
            >
              <FastForward className="h-3 w-3 mr-1" />
              继续
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-[11px] px-2"
              onClick={() => onDebugAction?.("stop")}
              title="停止 (Stop)"
            >
              <Square className="h-3 w-3 mr-1" />
              停止
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-3"
              onClick={onDebug}
              disabled={isRunning}
              title="调试 (⌘D)"
            >
              <Bug className="h-3 w-3 mr-1" />
              调试
              <span className="text-muted-foreground ml-1 text-[9px]">⌘D</span>
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px] px-4"
              onClick={onExecute}
              disabled={isRunning}
              title="运行 (⌘↵)"
            >
              {isRunning ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              {isRunning ? "运行中..." : "运行"}
              {!isRunning && <span className="text-primary-foreground/60 ml-1 text-[9px]">⌘↵</span>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
