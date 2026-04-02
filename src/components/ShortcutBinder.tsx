import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keyboard, X } from "lucide-react";

interface ShortcutBinderProps {
  currentShortcut?: string;
  error?: string | null;
  onBind: (shortcut: string) => void;
  onUnbind: () => void;
}

export function ShortcutBinder({ currentShortcut, error, onBind, onUnbind }: ShortcutBinderProps) {
  const [listening, setListening] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!listening) return;
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      const key = e.key;
      if (!["Control", "Meta", "Alt", "Shift"].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        setListening(false);
        onBind(parts.join("+"));
      }
    },
    [listening, onBind]
  );

  useEffect(() => {
    if (listening) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [listening, handleKeyDown]);

  return (
    <div className="flex items-center gap-1.5">
      {currentShortcut ? (
        <>
          <Badge variant="secondary" className="font-mono text-[10px] h-5">
            {currentShortcut}
          </Badge>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onUnbind}>
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : listening ? (
        <Badge variant="outline" className="text-[10px] h-5 animate-pulse">
          请按快捷键...
        </Badge>
      ) : (
        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => setListening(true)}>
          <Keyboard className="h-3 w-3 mr-1" />
          绑定快捷键
        </Button>
      )}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
