import { useState, useEffect, useCallback, useRef } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useWindowTheme } from "@/hooks/useWindowTheme";

interface DialogData {
  title: string;
  content: string;
}

/** Markdown-lite renderer: headings, code blocks, bold, links, lists */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div key={elements.length} className="my-2 rounded-lg overflow-hidden border border-border/50">
          {lang && (
            <div className="px-3 py-1 bg-muted/80 text-[10px] text-muted-foreground font-mono uppercase tracking-wider border-b border-border/50">
              {lang}
            </div>
          )}
          <pre className="px-3 py-2.5 text-[12px] font-mono leading-relaxed overflow-x-auto bg-muted/40">
            {codeLines.join("\n")}
          </pre>
        </div>
      );
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      elements.push(<h3 key={elements.length} className="text-sm font-semibold mt-3 mb-1">{line.slice(4)}</h3>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={elements.length} className="text-[15px] font-semibold mt-3 mb-1">{line.slice(3)}</h2>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={elements.length} className="text-base font-bold mt-3 mb-1">{line.slice(2)}</h1>);
      i++; continue;
    }

    // Bullet list
    if (line.match(/^[\s]*[-*]\s/)) {
      elements.push(
        <div key={elements.length} className="flex gap-1.5 my-0.5">
          <span className="text-muted-foreground shrink-0 mt-[2px]">•</span>
          <span>{renderInline(line.replace(/^[\s]*[-*]\s/, ""))}</span>
        </div>
      );
      i++; continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={elements.length} className="h-2" />);
      i++; continue;
    }

    // Normal paragraph
    elements.push(<p key={elements.length} className="my-0.5">{renderInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

/** Inline: **bold**, `code`, [link](url) */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<)]+)/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const m = match[0];
    if (m.startsWith("**") && m.endsWith("**")) {
      parts.push(<strong key={match.index}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("`") && m.endsWith("`")) {
      parts.push(
        <code key={match.index} className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono text-primary">
          {m.slice(1, -1)}
        </code>
      );
    } else if (m.startsWith("http")) {
      parts.push(
        <a key={match.index} href={m} target="_blank" rel="noreferrer"
           className="text-blue-500 dark:text-blue-400 hover:underline break-all">{m}</a>
      );
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function DialogWindow() {
  useWindowTheme();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const win = getCurrentWebviewWindow();
    const unlisten = win.listen<DialogData>("dialog_set_data", (event) => {
      setTitle(event.payload.title);
      setContent(event.payload.content);
      setCopied(false);
      scrollRef.current?.scrollTo(0, 0);
    });
    emit("page_loaded");
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const close = useCallback(() => getCurrentWebviewWindow().close(), []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && !window.getSelection()?.toString()) {
        e.preventDefault();
        onCopy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, onCopy]);

  return (
    <div className="flex flex-col w-full h-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-3 px-4 py-3 shrink-0 select-none"
        style={{
          background: "linear-gradient(135deg, oklch(0.55 0.15 260 / 0.08), oklch(0.55 0.15 260 / 0.03))",
        }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: "linear-gradient(135deg, oklch(0.55 0.16 260), oklch(0.48 0.14 250))" }}>
          <span className="material-symbols-rounded text-white text-[16px]">auto_awesome</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{title || "结果"}</div>
          <div className="text-[10px] text-muted-foreground">DeskPipe</div>
        </div>
        <button
          onClick={close}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          title="关闭 (Esc)"
        >
          <span className="material-symbols-rounded text-[16px] text-muted-foreground">close</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {content ? (
          <div className="text-[13px] leading-[1.7] text-foreground/90">
            <MarkdownContent text={content} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <span className="material-symbols-rounded text-[32px] opacity-20">hourglass_empty</span>
            <span className="text-xs">等待内容...</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center gap-2">
        <button
          onClick={onCopy}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            copied
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <span className="material-symbols-rounded text-[14px]">
            {copied ? "check_circle" : "content_copy"}
          </span>
          {copied ? "已复制" : "复制内容"}
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/60">⌘C 复制 · Esc 关闭</span>
      </div>
    </div>
  );
}
