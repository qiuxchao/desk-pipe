import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";

interface PreviewState {
  visible: boolean;
  src: string;
  title: string;
  scale: number;
  rotate: number;
  position: { x: number; y: number };
}

const INITIAL_STATE: PreviewState = {
  visible: false,
  src: "",
  title: "",
  scale: 1,
  rotate: 0,
  position: { x: 0, y: 0 },
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

export function ImagePreviewOverlay() {
  const [state, setState] = useState<PreviewState>(INITIAL_STATE);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const unlisten = listen<{ path: string; title?: string }>(
      "show_image_preview",
      (event) => {
        const { path, title } = event.payload;
        const src = convertFileSrc(path);
        setState({
          visible: true,
          src,
          title: title ?? path.split("/").pop() ?? "预览",
          scale: 1,
          rotate: 0,
          position: { x: 0, y: 0 },
        });
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const close = useCallback(() => setState(INITIAL_STATE), []);

  const fitToScreen = useCallback(() => {
    setState((s) => ({ ...s, scale: 1, position: { x: 0, y: 0 } }));
  }, []);

  const rotate = useCallback(() => {
    setState((s) => ({ ...s, rotate: (s.rotate + 90) % 360 }));
  }, []);

  useEffect(() => {
    if (!state.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.visible, close]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setState((s) => {
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.scale + delta * s.scale));
      return { ...s, scale: newScale };
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
    setState((s) => ({
      ...s,
      position: { x: s.position.x + dx, y: s.position.y + dy },
    }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!state.visible) return null;

  const zoomPct = Math.round(state.scale * 100);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm"
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 text-white text-sm shrink-0 select-none">
        <span className="truncate max-w-[40%] font-medium">{state.title}</span>
        <div className="flex items-center gap-3">
          <span className="text-white/70 tabular-nums">{zoomPct}%</span>
          <button
            onClick={fitToScreen}
            className="px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs"
            title="适应屏幕"
          >
            适应
          </button>
          <button
            onClick={rotate}
            className="px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs"
            title="旋转 90°"
          >
            旋转
          </button>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/20 transition-colors text-lg leading-none"
            title="关闭 (Esc)"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        <img
          src={state.src}
          alt={state.title}
          draggable={false}
          className="max-w-none select-none pointer-events-none"
          style={{
            transform: `translate(${state.position.x}px, ${state.position.y}px) scale(${state.scale}) rotate(${state.rotate}deg)`,
            transition: dragging.current ? "none" : "transform 0.15s ease-out",
          }}
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-center px-4 py-1.5 bg-black/60 text-white/50 text-xs shrink-0 select-none gap-6">
        <span>滚轮缩放</span>
        <span>拖拽平移</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  );
}
