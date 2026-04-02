import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem("deskpipe-theme") as Theme) || "system";
  });

  useEffect(() => {
    const root = document.documentElement;

    function applyTheme(t: Theme) {
      if (t === "dark") {
        root.classList.add("dark");
      } else if (t === "light") {
        root.classList.remove("dark");
      } else {
        // system
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", isDark);
      }
    }

    applyTheme(theme);
    localStorage.setItem("deskpipe-theme", theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
