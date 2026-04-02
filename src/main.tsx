import { createRoot } from "react-dom/client";
import App from "./App";
import "@material-symbols/font-400/rounded.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(<App />);
