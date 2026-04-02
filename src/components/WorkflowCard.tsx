import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play, Pencil, Trash2, Download, Keyboard, Clock,
  Terminal, Timer, Bell, Globe, GitBranch, Repeat,
} from "lucide-react";
import type { Workflow } from "@/types/workflow";

const NODE_ICONS: Record<string, React.ReactNode> = {
  shell: <Terminal className="h-3 w-3" />,
  delay: <Timer className="h-3 w-3" />,
  notification: <Bell className="h-3 w-3" />,
  http_request: <Globe className="h-3 w-3" />,
  condition: <GitBranch className="h-3 w-3" />,
  loop: <Repeat className="h-3 w-3" />,
};

interface WorkflowCardProps {
  workflow: Workflow;
  onEdit: () => void;
  onExecute: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export function WorkflowCard({
  workflow,
  onEdit,
  onExecute,
  onDelete,
  onExport,
}: WorkflowCardProps) {
  const actionNodes = workflow.nodes.filter(
    (n) => n.type !== "start" && n.type !== "end"
  );
  const uniqueTypes = [...new Set(actionNodes.map((n) => n.type))];

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{workflow.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {actionNodes.length} node{actionNodes.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Node type pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {uniqueTypes.slice(0, 4).map((type) => (
            <Badge key={type} variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
              {NODE_ICONS[type] ?? null}
              {type.replace("_", " ")}
            </Badge>
          ))}
          {uniqueTypes.length > 4 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{uniqueTypes.length - 4}
            </Badge>
          )}
        </div>

        {/* Meta badges */}
        <div className="flex items-center gap-2 mb-4">
          {workflow.shortcut && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Keyboard className="h-2.5 w-2.5" />
              {workflow.shortcut}
            </Badge>
          )}
          {workflow.cron && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="h-2.5 w-2.5" />
              {workflow.cron}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onExport();
            }}
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
