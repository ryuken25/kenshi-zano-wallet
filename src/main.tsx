import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { log } from "./core/logger";

// §4: catch any stray unhandled rejection / error so it never silently dies.
window.addEventListener("unhandledrejection", (e) => {
  log.error("unhandledrejection:", String(e.reason?.message ?? e.reason));
});
window.addEventListener("error", (e) => {
  log.error("window error:", e.message);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
