import { createRoot } from "react-dom/client";
import "@material-symbols/font-400/rounded.css";
import "@/styles/global.css";
import { PreviewWindow } from "./App";

createRoot(document.getElementById("root")!).render(<PreviewWindow />);
