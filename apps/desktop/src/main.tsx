import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { CallWindow } from "./calls/CallWindow";
import { IncomingCallWindow } from "./calls/IncomingCallWindow";
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
} else if (isTauri() && getCurrentWindow().label.startsWith("incoming-")) {
  root.render(
    <StrictMode>
      <IncomingCallWindow />
    </StrictMode>,
  );
} else if (isTauri() && getCurrentWindow().label.startsWith("call-")) {
  root.render(
    <StrictMode>
      <CallWindow />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
