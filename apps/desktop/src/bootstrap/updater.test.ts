import { describe, expect, it, vi } from "vitest";
import { createStartupUpdateRunner } from "./updater";
import type { DesktopUpdateState } from "../types";

function update(
  kind: DesktopUpdateState["kind"],
  updateAvailable = kind === "optional" || kind === "mandatory",
): DesktopUpdateState {
  return {
    kind,
    currentVersion: "1.0.1",
    latestVersion: updateAvailable ? "1.1.0" : undefined,
    minimumSupportedVersion: "1.0.0",
    policySource: "network",
    updateAvailable,
    canContinueWithoutUpdate: kind !== "mandatory",
  };
}

function callbacks() {
  return {
    formatError: (error: unknown) => String(error),
    onUpdateResolved: vi.fn(),
    onInstallStarted: vi.fn(),
    onInstallFailed: vi.fn(),
  };
}

describe("startup updater gate", () => {
  it.each(["optional", "mandatory"] as const)(
    "installs a valid %s update before allowing startup",
    async (kind) => {
      const order: string[] = [];
      const api = {
        checkForUpdates: vi.fn(async () => { order.push("check"); return update(kind); }),
        getUpdateState: vi.fn(async () => update(kind)),
        installUpdate: vi.fn(async () => { order.push("install"); }),
      };
      const result = await createStartupUpdateRunner(api).run(callbacks());
      expect(result.status).toBe("restart-pending");
      expect(order).toEqual(["check", "install"]);
    },
  );

  it("continues only when no update is available", async () => {
    const api = {
      checkForUpdates: vi.fn(async () => update("none", false)),
      getUpdateState: vi.fn(async () => update("none", false)),
      installUpdate: vi.fn(async () => undefined),
    };
    const result = await createStartupUpdateRunner(api).run(callbacks());
    expect(result.status).toBe("continue");
    expect(api.installUpdate).not.toHaveBeenCalled();
  });

  it("blocks unavailable and unsupported states without inventing an install", async () => {
    const unavailable = update("unavailable", false);
    const mandatoryWithoutArtifact = {
      ...update("mandatory", false),
      canContinueWithoutUpdate: false,
    };
    for (const state of [unavailable, mandatoryWithoutArtifact]) {
      const api = {
        checkForUpdates: vi.fn(async () => state),
        getUpdateState: vi.fn(async () => state),
        installUpdate: vi.fn(async () => undefined),
      };
      expect((await createStartupUpdateRunner(api).run(callbacks())).status).toBe("blocked");
      expect(api.installUpdate).not.toHaveBeenCalled();
    }
  });

  it("preserves runtime support metadata when the update command fails", async () => {
    const previous = update("none", false);
    const api = {
      checkForUpdates: vi.fn(async () => { throw new Error("offline"); }),
      getUpdateState: vi.fn(async () => previous),
      installUpdate: vi.fn(async () => undefined),
    };
    const listener = callbacks();
    const result = await createStartupUpdateRunner(api).run(listener);
    expect(result.status).toBe("blocked");
    expect(result.update).toMatchObject({
      kind: "unavailable",
      currentVersion: "1.0.1",
      canContinueWithoutUpdate: true,
    });
    expect(listener.onUpdateResolved).toHaveBeenCalledOnce();
  });

  it("coalesces StrictMode-style concurrent runs into one install", async () => {
    let finishInstall: (() => void) | undefined;
    const install = new Promise<void>((resolve) => { finishInstall = resolve; });
    const api = {
      checkForUpdates: vi.fn(async () => update("optional")),
      getUpdateState: vi.fn(async () => update("optional")),
      installUpdate: vi.fn(() => install),
    };
    const runner = createStartupUpdateRunner(api);
    const first = runner.run(callbacks());
    const second = runner.run(callbacks());
    expect(first).toBe(second);
    finishInstall?.();
    await Promise.all([first, second]);
    expect(api.checkForUpdates).toHaveBeenCalledOnce();
    expect(api.installUpdate).toHaveBeenCalledOnce();
  });

  it("reopens the gate after a failed attempt so retry is explicit", async () => {
    const api = {
      checkForUpdates: vi.fn(async () => update("optional")),
      getUpdateState: vi.fn(async () => update("optional")),
      installUpdate: vi.fn(async () => { throw new Error("install failed"); }),
    };
    const runner = createStartupUpdateRunner(api);
    expect((await runner.run(callbacks())).status).toBe("blocked");
    expect((await runner.run(callbacks())).status).toBe("blocked");
    expect(api.installUpdate).toHaveBeenCalledTimes(2);
  });
});
