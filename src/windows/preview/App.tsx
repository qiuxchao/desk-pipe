import { useState, useEffect, useRef, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useWindowTheme } from "@/hooks/useWindowTheme";

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

interface PreviewData {
  path: string;
  title: string;
}

export function PreviewWindow() {
  useWindowTheme();

  const [src, setSrc] = useState("");
  const [title, setTitle] = useState("");
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const window = getCurrentWebviewWindow();
    const unlisten = window.listen<PreviewData>("preview_set_data", (event) => {
      const { path, title: t } = event.payload;
      setSrc(convertFileSrc(path));
      setTitle(t);
      setScale(1);
      setRotate(0);
      setPosition({ x: 0, y: 0 });
    });

    // Notify Rust that the page is loaded
    emit("page_loaded");

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const close = useCallback(() => {
    getCurrentWebviewWindow().close();
  }, []);

  const fitToScreen = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s * 1.25));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s / 1.25));
  }, []);

  const rotateLeft = useCallback(() => {
    setRotate((r) => (r - 90 + 360) % 360);
  }, []);

  const rotateRight = useCallback(() => {
    setRotate((r) => (r + 90) % 360);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "=" || e.key === "+") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key === "r" || e.key === "R") rotateRight();
      else if (e.key === "0") fitToScreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, zoomIn, zoomOut, rotateRight, fitToScreen]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => {
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta * s));
    });
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPosition((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const zoomPct = Math.round(scale * 100);

  return (
    <div
      className="flex flex-col w-full h-full bg-background"
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Top bar */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-4 py-2 bg-secondary text-foreground text-sm shrink-0 select-none"
      >
        <span className="truncate max-w-[40%] font-medium">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums text-xs">{zoomPct}%</span>
          <button
            onClick={zoomIn}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent transition-colors"
            title="放大"
          >
            <span className="material-symbols-rounded text-[18px]">zoom_in</span>
          </button>
          <button
            onClick={zoomOut}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent transition-colors"
            title="缩小"
          >
            <span className="material-symbols-rounded text-[18px]">zoom_out</span>
          </button>
          <button
            onClick={fitToScreen}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent transition-colors"
            title="适应屏幕 (0)"
          >
            <span className="material-symbols-rounded text-[18px]">fit_screen</span>
          </button>
          <button
            onClick={rotateLeft}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent transition-colors"
            title="向左旋转"
          >
            <span className="material-symbols-rounded text-[18px]">rotate_left</span>
          </button>
          <button
            onClick={rotateRight}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent transition-colors"
            title="向右旋转 (R)"
          >
            <span className="material-symbols-rounded text-[18px]">rotate_right</span>
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent transition-colors"
            title="关闭 (Esc)"
          >
            <span className="material-symbols-rounded text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        {src ? (
          <img
            src={src}
            alt={title}
            draggable={false}
            className="max-w-none select-none pointer-events-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotate}deg)`,
              transition: dragging.current ? "none" : "transform 0.15s ease-out",
            }}
          />
        ) : (
          <div className="text-muted-foreground text-sm">等待图片加载...</div>
        )}
      </div>

      {/* Bottom hints */}
      <div className="flex items-center justify-center px-4 py-1.5 bg-secondary text-muted-foreground text-xs shrink-0 select-none gap-6">
        <span>滚轮缩放</span>
        <span>拖拽平移</span>
        <span>+/- 缩放</span>
        <span>R 旋转</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  );
}
