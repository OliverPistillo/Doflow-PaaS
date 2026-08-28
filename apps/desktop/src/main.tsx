import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

if (import.meta.env.DEV && import.meta.env.VITE_DESKTOP_QA === "1") {
  void import("./qa/AcceptanceFixture").then(({ AcceptanceFixture }) => {
    root.render(
      <StrictMode>
        <AcceptanceFixture />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
