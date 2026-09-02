import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { CallWindow } from "./calls/CallWindow";
import { IncomingCallWindow } from "./calls/IncomingCallWindow";
import { resolveDesktopSurface } from "./calls/window-routing";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const native = isTauri();
const surface = resolveDesktopSurface(native, native ? getCurrentWindow().label : "bootstrap");
document.documentElement.dataset.doflowRenderer = surface;

if (import.meta.env.DEV && import.meta.env.VITE_DESKTOP_QA === "1") {
  void import("./qa/AcceptanceFixture").then(({ AcceptanceFixture }) => {
    root.render(
      <StrictMode>
        <AcceptanceFixture />
      </StrictMode>,
    );
  });
} else if (surface === "incoming") {
  root.render(
    <StrictMode>
      <IncomingCallWindow />
    </StrictMode>,
  );
} else if (surface === "call") {
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
