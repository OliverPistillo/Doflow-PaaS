import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UpdateScreen } from "./components/StatusScreens";
import type { DesktopUpdateState } from "./types";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

function update(overrides: Partial<DesktopUpdateState> = {}): DesktopUpdateState {
  return {
    kind: "optional",
    currentVersion: "1.0.1",
    latestVersion: "1.1.0",
    minimumSupportedVersion: "1.0.0",
    policySource: "network",
    updateAvailable: true,
    canContinueWithoutUpdate: true,
    ...overrides,
  };
}

describe("native startup update UI", () => {
  it("shows automatic Stable progress and runtime versions", () => {
    const markup = renderToStaticMarkup(
      <UpdateScreen
        update={update()}
        progress={{ downloaded: 25, total: 100, phase: "downloading" }}
        busy
        onRetry={() => undefined}
        onQuit={() => undefined}
      />,
    );
    expect(markup).toContain("Aggiornamento Doflow");
    expect(markup).toContain("25% completato");
    expect(markup).toContain("Doflow Desktop 1.0.1 · Canale Stable");
    expect(markup).toContain("Versione disponibile 1.1.0");
    expect(markup).not.toContain("Riprova aggiornamento");
  });

  it("offers retry and supported fallback after an optional install failure", () => {
    const markup = renderToStaticMarkup(
      <UpdateScreen
        update={update()}
        progress={{ downloaded: 0, phase: "failed", message: "Controlla la connessione e riprova." }}
        busy={false}
        onRetry={() => undefined}
        onContinue={() => undefined}
        onQuit={() => undefined}
      />,
    );
    expect(markup).toContain("Riprova aggiornamento");
    expect(markup).toContain("Continua con questa versione");
    expect(markup).toContain('role="alert"');
  });

  it("never offers fallback for an unsupported mandatory version", () => {
    const markup = renderToStaticMarkup(
      <UpdateScreen
        update={update({ kind: "mandatory", canContinueWithoutUpdate: false })}
        busy={false}
        onRetry={() => undefined}
        onQuit={() => undefined}
      />,
    );
    expect(markup).toContain("Riprova aggiornamento");
    expect(markup).not.toContain("Continua con questa versione");
  });

  it("keeps profile and remote preparation behind the updater result", () => {
    const app = readFileSync(`${sourceRoot}/App.tsx`, "utf8");
    expect(app).not.toContain("const profilesPromise");
    expect(app).not.toContain("const updatePromise");
    expect(app).toMatch(/const result = await updateRunner\.current!\.run\([\s\S]*if \(result\.status === "continue"\)[\s\S]*await startProfileBootstrap\(\)/);
  });
});
