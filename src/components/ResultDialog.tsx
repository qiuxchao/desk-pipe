import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

interface DialogState {
  visible: boolean;
  title: string;
  content: string;
  nodeId?: string;
}

const INITIAL_STATE: DialogState = {
  visible: false,
  title: "",
  content: "",
};

export function ResultDialog() {
  const [state, setState] = useState<DialogState>(INITIAL_STATE);
  const [copied, setCopied] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<{ title: string; content: string; node_id?: string }>(
      "show_result_dialog",
      (event) => {
        const { title, content, node_id } = event.payload;
        setState({ visible: true, title, content, nodeId: node_id });
        setPosition(null); // reset to default bottom-right
        setCopied(false);
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_STATE);
    setPinned(false);
  }, []);

  useEffect(() => {
    if (!state.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.visible, close]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(state.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [state.content]);

  const onTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      dragging.current = true;
      const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        setPosition({
          x: ev.clientX - dragOffset.current.x,
          y: ev.clientY - dragOffset.current.y,
        });
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    []
  );

  if (!state.visible) return null;

  const posStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : { right: 24, bottom: 24 };

  return (
    <div
      className="fixed z-[9998] animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{
        width: 420,
        maxHeight: "60vh",
        ...posStyle,
      }}
    >
      <div
        className="flex flex-col rounded-xl shadow-2xl border overflow-hidden"
        style={{
          background: "var(--color-card, #1e1e2e)",
          borderColor: "var(--color-border, rgba(255,255,255,0.08))",
          color: "var(--color-card-foreground, #e0e0e0)",
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 py-2 shrink-0 cursor-move select-none"
          style={{ borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.08))" }}
          onMouseDown={onTitleMouseDown}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 opacity-60"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm font-medium truncate flex-1">{state.title}</span>
          <button
            onClick={() => setPinned((p) => !p)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-xs"
            title={pinned ? "取消固定" : "固定窗口"}
            style={{ opacity: pinned ? 1 : 0.5 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M12 17v5M9 2h6l-1 7h4l-7 8 1-5H8l1-10z" />
            </svg>
          </button>
          <button
            onClick={close}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-lg leading-none"
            title="关闭 (Esc)"
          >
            &times;
          </button>
        </div>

        {/* Content area */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed"
          style={{ maxHeight: "calc(60vh - 90px)" }}
        >
          <pre
            className="whitespace-pre-wrap break-words font-sans"
            style={{ margin: 0 }}
          >
            {state.content}
          </pre>
        </div>

        {/* Bottom actions */}
        <div
          className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ borderTop: "1px solid var(--color-border, rgba(255,255,255,0.08))" }}
        >
          <button
            onClick={onCopy}
            className="px-3 py-1 rounded text-xs transition-colors bg-accent"
            style={{
              background: copied ? "rgba(34,197,94,0.2)" : undefined,
              color: copied ? "#22c55e" : undefined,
            }}
          >
            {copied ? "已复制 \u2713" : "复制"}
          </button>
          <div className="flex-1" />
          <span className="text-[10px] opacity-30">Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
