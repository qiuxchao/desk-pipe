import { useState, useEffect, useCallback } from "react";

interface MenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  separator?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (menu) {
      const handler = () => close();
      window.addEventListener("click", handler);
      window.addEventListener("contextmenu", handler);
      return () => {
        window.removeEventListener("click", handler);
        window.removeEventListener("contextmenu", handler);
      };
    }
  }, [menu, close]);

  return { menu, showMenu: setMenu, closeMenu: close };
}

export function ContextMenu({ menu }: { menu: ContextMenuState | null }) {
  if (!menu) return null;
  return (
    <div
      className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-popover shadow-lg py-1 text-xs"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="border-t border-border my-1" />
        ) : (
          <button
            key={i}
            className={`w-full text-left px-3 py-1.5 hover:bg-accent transition-colors ${
              item.destructive ? "text-destructive" : ""
            }`}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
