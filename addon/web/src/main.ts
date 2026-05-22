import "./styles/reset.css";
import "./styles/tokens.css";
import { initTheme } from "./theme.js";
import "./components/knx-app.js";

initTheme();

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root");
root.innerHTML = "<knx-app></knx-app>";
