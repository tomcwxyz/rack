import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";
import "./editor.css";
import "./setup-editor.css";
import "./build.css";
import "./creation-routes.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Rack could not find its application root.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
