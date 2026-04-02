import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

async function closeWindow() {
  try {
    await getCurrentWebviewWindow().close();
  } catch {
    try {
      await getCurrentWebviewWindow().destroy();
    } catch {
      // fallback
      window.close();
    }
  }
}

type Tool = "select" | "rect" | "arrow" | "text";

interface Region {
  x: number; y: number; w: number; h: number;
}

interface Annotation {
  type: "rect" | "arrow" | "text";
  x1: number; y1: number; x2: number; y2: number;
  text?: string;
  color: string;
}

export function ScreenshotApp() {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [color, setColor] = useState("#ff3b30");
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Listen for screenshot data from backend
  useEffect(() => {
    const unlisten = listen<{ path: string; width: number; height: number }>(
      "screenshot_data",
      (event) => {
        const url = convertFileSrc(event.payload.path);
        setBgImage(url);
      }
    );
    // Notify backend we're ready
    getCurrentWebviewWindow().emit("screenshot_ready", {});
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // ESC to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeWindow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Draw overlay + annotations on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Clear selected region
    if (region) {
      ctx.clearRect(region.x, region.y, region.w, region.h);
      // Border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(region.x, region.y, region.w, region.h);
      // Size label
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(region.x, region.y - 22, 100, 20);
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui";
      ctx.fillText(`${Math.round(region.w)} × ${Math.round(region.h)}`, region.x + 6, region.y - 7);
    }

    // Draw annotations
    [...annotations, currentAnnotation].forEach((ann) => {
      if (!ann) return;
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 2;

      if (ann.type === "rect") {
        ctx.strokeRect(ann.x1, ann.y1, ann.x2 - ann.x1, ann.y2 - ann.y1);
      } else if (ann.type === "arrow") {
        drawArrow(ctx, ann.x1, ann.y1, ann.x2, ann.y2);
      } else if (ann.type === "text" && ann.text) {
        ctx.font = "16px system-ui";
        ctx.fillText(ann.text, ann.x1, ann.y1);
      }
    });
  }, [bgImage, region, annotations, currentAnnotation]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (textInput) return;

    if (tool === "select" && !region) {
      setSelecting(true);
      setDrawing(true);
      setStartPos({ x: e.clientX, y: e.clientY });
    } else if (tool === "text" && region) {
      setTextInput({ x: e.clientX, y: e.clientY });
      setTextValue("");
    } else if ((tool === "rect" || tool === "arrow") && region) {
      setDrawing(true);
      setStartPos({ x: e.clientX, y: e.clientY });
    }
  }, [tool, region, textInput]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;

    if (selecting) {
      const x = Math.min(startPos.x, e.clientX);
      const y = Math.min(startPos.y, e.clientY);
      const w = Math.abs(e.clientX - startPos.x);
      const h = Math.abs(e.clientY - startPos.y);
      setRegion({ x, y, w, h });
    } else if (tool === "rect" || tool === "arrow") {
      setCurrentAnnotation({
        type: tool, color,
        x1: startPos.x, y1: startPos.y,
        x2: e.clientX, y2: e.clientY,
      });
    }
  }, [drawing, tool, startPos, region, color]);

  const handleMouseUp = useCallback(() => {
    setDrawing(false);
    setSelecting(false);
    if (currentAnnotation) {
      setAnnotations((prev) => [...prev, currentAnnotation]);
      setCurrentAnnotation(null);
    }
  }, [currentAnnotation]);

  const handleConfirm = async () => {
    if (!region || !bgImage) return;

    const dpr = window.devicePixelRatio || 1;

    // If there are annotations, composite them onto the cropped region
    if (annotations.length > 0) {
      // Create an offscreen canvas with the cropped region
      const offscreen = document.createElement("canvas");
      const cropW = Math.round(region.w * dpr);
      const cropH = Math.round(region.h * dpr);
      offscreen.width = cropW;
      offscreen.height = cropH;
      const octx = offscreen.getContext("2d")!;

      // Draw the background image cropped to the region
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = bgImage;
      });
      octx.drawImage(
        img,
        region.x * dpr, region.y * dpr, cropW, cropH,
        0, 0, cropW, cropH
      );

      // Draw annotations offset by region position
      octx.scale(dpr, dpr);
      annotations.forEach((ann) => {
        octx.strokeStyle = ann.color;
        octx.fillStyle = ann.color;
        octx.lineWidth = 2;
        const ox = -region.x;
        const oy = -region.y;

        if (ann.type === "rect") {
          octx.strokeRect(ann.x1 + ox, ann.y1 + oy, ann.x2 - ann.x1, ann.y2 - ann.y1);
        } else if (ann.type === "arrow") {
          drawArrow(octx, ann.x1 + ox, ann.y1 + oy, ann.x2 + ox, ann.y2 + oy);
        } else if (ann.type === "text" && ann.text) {
          octx.font = "16px system-ui";
          octx.fillText(ann.text, ann.x1 + ox, ann.y1 + oy);
        }
      });

      // Export as blob and write via Tauri fs
      const blob = await new Promise<Blob>((resolve) =>
        offscreen.toBlob((b) => resolve(b!), "image/png")
      );
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Write to temp file via a data URL approach — pass base64 to backend
      const base64 = btoa(String.fromCharCode(...bytes));
      await invoke("screenshot_region_complete_with_image", {
        imageBase64: base64,
        width: Math.round(region.w),
        height: Math.round(region.h),
      });
    } else {
      // No annotations — just send coordinates for backend cropping
      await invoke("screenshot_region_complete", {
        x: Math.round(region.x * dpr),
        y: Math.round(region.y * dpr),
        width: Math.round(region.w * dpr),
        height: Math.round(region.h * dpr),
      });
    }
    closeWindow();
  };

  const handleCancel = () => {
    closeWindow();
  };

  const handleTextConfirm = () => {
    if (textInput && textValue.trim()) {
      setAnnotations((prev) => [
        ...prev,
        { type: "text", color, x1: textInput.x, y1: textInput.y, x2: 0, y2: 0, text: textValue },
      ]);
    }
    setTextInput(null);
    setTextValue("");
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  if (!bgImage) {
    return (
      <div style={{
        width: "100vw", height: "100vh", background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#666", fontSize: 16, fontFamily: "system-ui",
      }}>
        正在加载截图...（按 ESC 取消）
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        cursor: tool === "select" && !region ? "crosshair" : tool === "text" ? "text" : "default",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background screenshot */}
      <img
        src={bgImage}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
        draggable={false}
      />

      {/* Overlay canvas for dark mask + annotations */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />

      {/* Toolbar — appears below the region */}
      {region && region.w > 10 && (
        <div
          style={{
            position: "absolute",
            left: region.x + region.w - 300,
            top: region.y + region.h + 8,
            display: "flex",
            gap: 2,
            background: "rgba(30,30,30,0.9)",
            borderRadius: 10,
            padding: "4px 6px",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Tools */}
          <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")} title="矩形">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
          </ToolBtn>
          <ToolBtn active={tool === "arrow"} onClick={() => setTool("arrow")} title="箭头">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3M13 3H7M13 3V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </ToolBtn>
          <ToolBtn active={tool === "text"} onClick={() => setTool("text")} title="文字">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4V3H13V4M8 3V13M6 13H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </ToolBtn>
          <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "2px 4px" }} />
          {/* Color picker */}
          {["#ff3b30", "#ff9500", "#34c759", "#007aff", "#fff"].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 18, height: 18, borderRadius: 9, background: c, border: color === c ? "2px solid #fff" : "2px solid transparent",
                cursor: "pointer", flexShrink: 0,
              }}
            />
          ))}
          <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "2px 4px" }} />
          {/* Undo */}
          <ToolBtn onClick={handleUndo} title="撤销">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6H10C12 6 13 7.5 13 9C13 10.5 12 12 10 12H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 4L3 6L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </ToolBtn>
          <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "2px 4px" }} />
          {/* Cancel / Confirm */}
          <ToolBtn onClick={handleCancel} title="取消">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </ToolBtn>
          <button
            onClick={handleConfirm}
            style={{
              background: "#34c759", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            确认
          </button>
        </div>
      )}

      {/* Text input overlay */}
      {textInput && (
        <input
          autoFocus
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") handleTextConfirm();
            if (e.key === "Escape") setTextInput(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => {
            // Delay to allow clicking toolbar buttons without losing input
            setTimeout(handleTextConfirm, 200);
          }}
          style={{
            position: "absolute",
            left: textInput.x,
            top: textInput.y - 10,
            background: "rgba(0,0,0,0.5)",
            border: "none",
            borderBottom: `2px solid ${color}`,
            color,
            fontSize: 16,
            fontWeight: 500,
            outline: "none",
            minWidth: 150,
            padding: "4px 6px",
            borderRadius: 4,
            zIndex: 100,
          }}
          placeholder="输入文字..."
        />
      )}
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "rgba(255,255,255,0.2)" : "transparent",
        border: "none", borderRadius: 6, color: "#fff", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const headLen = 12;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}
