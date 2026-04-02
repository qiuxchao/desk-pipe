import { useState, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { HomePage } from "@/pages/HomePage";
import { EditorPage } from "@/pages/EditorPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useTheme } from "@/hooks/useTheme";

type Page =
  | { view: "home" }
  | { view: "editor"; workflowId?: string }
  | { view: "settings" };

function App() {
  useTheme(); // Apply theme class at root level so all pages inherit it
  const [page, setPage] = useState<Page>({ view: "home" });

  const goHome = useCallback(() => setPage({ view: "home" }), []);
  const goEditor = useCallback(
    (workflowId?: string) => setPage({ view: "editor", workflowId }),
    []
  );
  const goSettings = useCallback(() => setPage({ view: "settings" }), []);

  return (
    <TooltipProvider>
      {page.view === "home" ? (
        <HomePage
          onNewWorkflow={() => goEditor()}
          onEditWorkflow={goEditor}
          onOpenSettings={goSettings}
        />
      ) : page.view === "editor" ? (
        <EditorPage workflowId={page.workflowId} onBack={goHome} />
      ) : (
        <SettingsPage onBack={goHome} />
      )}
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
