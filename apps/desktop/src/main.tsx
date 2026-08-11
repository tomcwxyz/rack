import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@neondatabase/auth-ui/css";
import { App } from "./App.js";
import { ManagedAuthProvider } from "./managedAuth.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ManagedAuthProvider>
      <App />
    </ManagedAuthProvider>
  </StrictMode>,
);
