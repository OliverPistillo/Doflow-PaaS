import { describe, expect, it, vi } from "vitest";
import {
  coordinateLegacyDesktopUpdate,
  LegacyDesktopUpdateAttemptRegistry,
  resolveLegacyDesktopUpdater,
  type DesktopUpdateState,
} from "../../frontend/src/lib/desktop-bridge";

const available: DesktopUpdateState = {
  kind: "optional",
  currentVersion: "1.0.1",
  latestVersion: "1.1.0",
  minimumSupportedVersion: "1.0.0",
  policySource: "network",
  updateAvailable: true,
};

function candidate(bridgeVersion: number, state: DesktopUpdateState = available) {
  return {
    isDesktop: true,
    platform: "windows",
    bridgeVersion,
    appVersion: "1.0.1",
    profileId: "profile",
    getUpdateState: vi.fn(async () => state),
    installCurrentVerifiedUpdate: vi.fn(async () => undefined),
  };
}

describe("legacy Desktop updater coordinator", () => {
  it("is a no-op in a browser and on bridge v2 or newer", () => {
    expect(resolveLegacyDesktopUpdater(undefined)).toBeNull();
    expect(resolveLegacyDesktopUpdater(candidate(2))).toBeNull();
    expect(resolveLegacyDesktopUpdater(candidate(3))).toBeNull();
  });

  it("accepts only the exact bridge v1 updater capability", () => {
    expect(resolveLegacyDesktopUpdater(candidate(1))).not.toBeNull();
    expect(resolveLegacyDesktopUpdater({ ...candidate(1), getUpdateState: undefined })).toBeNull();
    expect(resolveLegacyDesktopUpdater({ ...candidate(1), installCurrentVerifiedUpdate: undefined })).toBeNull();
  });

  it("automatically installs the verified update reported by bridge v1", async () => {
    const bridge = candidate(1);
    const updater = resolveLegacyDesktopUpdater(bridge)!;
    const found = vi.fn();
    await expect(coordinateLegacyDesktopUpdate(updater, found)).resolves.toMatchObject({
      status: "restart-pending",
      state: available,
    });
    expect(found).toHaveBeenCalledWith(available);
    expect(bridge.installCurrentVerifiedUpdate).toHaveBeenCalledOnce();
  });

  it("also automatically installs a mandatory bridge v1 update", async () => {
    const bridge = candidate(1, { ...available, kind: "mandatory", canContinueWithoutUpdate: false });
    const updater = resolveLegacyDesktopUpdater(bridge)!;
    await expect(coordinateLegacyDesktopUpdate(updater)).resolves.toMatchObject({ status: "restart-pending" });
    expect(bridge.installCurrentVerifiedUpdate).toHaveBeenCalledOnce();
  });

  it("does not install when bridge v1 reports no valid update", async () => {
    const bridge = candidate(1, { ...available, kind: "none", updateAvailable: false });
    const updater = resolveLegacyDesktopUpdater(bridge)!;
    await expect(coordinateLegacyDesktopUpdate(updater)).resolves.toMatchObject({ status: "none" });
    expect(bridge.installCurrentVerifiedUpdate).not.toHaveBeenCalled();
  });

  it("surfaces a native installation failure without a duplicate attempt", async () => {
    const bridge = candidate(1);
    bridge.installCurrentVerifiedUpdate = vi.fn(async () => { throw new Error("install failed"); });
    const updater = resolveLegacyDesktopUpdater(bridge)!;
    await expect(coordinateLegacyDesktopUpdate(updater)).rejects.toThrow("install failed");
    expect(bridge.installCurrentVerifiedUpdate).toHaveBeenCalledOnce();
  });

  it("claims a bridge once across StrictMode-style duplicate effects", () => {
    const updater = resolveLegacyDesktopUpdater(candidate(1))!;
    const registry = new LegacyDesktopUpdateAttemptRegistry();
    expect(registry.claim(updater)).toBe(true);
    expect(registry.claim(updater)).toBe(false);
  });

  it("rejects malformed updater state before invoking native install", async () => {
    const bridge = candidate(1);
    bridge.getUpdateState = vi.fn(async () => ({ ...available, kind: "invented" as never }));
    const updater = resolveLegacyDesktopUpdater(bridge)!;
    await expect(coordinateLegacyDesktopUpdate(updater)).rejects.toThrow("Invalid Desktop update state");
    expect(bridge.installCurrentVerifiedUpdate).not.toHaveBeenCalled();
  });
});
