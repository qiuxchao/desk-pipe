import { useEffect } from "react";

/**
 * Lightweight theme hook for child windows (preview, dialog, status).
 * Reads the stored theme from localStorage and applies the `.dark` class
 * to the document element. Also listens for system preference changes
 * when the theme is set to "system".
 */
export function useWindowTheme() {
  useEffect(() => {
    const root = document.documentElement;

    function apply() {
      const stored = localStorage.getItem("deskpipe-theme") || "system";
      const isDark =
        stored === "dark" ||
        (stored === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    }

    apply();

    // Listen for system preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply();
    mq.addEventListener("change", handler);

    // Listen for storage changes from the main window
    const onStorage = (e: StorageEvent) => {
      if (e.key === "deskpipe-theme") apply();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}
