import { createRoot } from "react-dom/client";
import "@material-symbols/font-400/rounded.css";
import "@/styles/global.css";
import { DialogWindow } from "./App";

createRoot(document.getElementById("root")!).render(<DialogWindow />);
