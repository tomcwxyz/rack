import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@neondatabase/auth-ui/css";
import { ManagedAuthProvider } from "../../desktop/src/managedAuth.js";
import { App } from "./App.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ManagedAuthProvider><App /></ManagedAuthProvider>
  </StrictMode>,
);
