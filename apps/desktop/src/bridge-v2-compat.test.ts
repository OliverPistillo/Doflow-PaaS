// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  closeDesktopCall,
  getDesktopCallCapabilities,
  getDesktopCallsDeviceId,
  getDesktopEmailPrefill,
  getDesktopUpdateState,
  installDesktopUpdate,
  invalidateSavedDesktopPassword,
  isDoflowDesktop,
  notifyDesktopReady,
  openDesktopCall,
  registerDesktopProfile,
  requestDesktopProfileSwitch,
  showIncomingDesktopCall,
  stageDesktopPassword,
  subscribeDesktopCallActions,
  supportsDesktopSecureCredentials,
  takeSavedDesktopPassword,
  updateDesktopCallCredentials,
} from "../../frontend/src/lib/desktop-bridge";

const profileId = "10000000-4000-4000-8000-000000000001";
const sessionId = "20000000-4000-4000-8000-000000000002";

afterEach(() => {
  Reflect.deleteProperty(window, "__DOFLOW_DESKTOP__");
  vi.restoreAllMocks();
});

describe("new frontend with the shipped Desktop 1.1.3 bridge v2", () => {
  it("preserves profile, updater, Calls and bridge operations while secure credentials stay unavailable", async () => {
    const desktopReady = vi.fn(async () => undefined);
    const registerProfileMetadata = vi.fn(async () => ({ profiles: [] }));
    const requestProfileSwitch = vi.fn(async () => undefined);
    const getUpdateState = vi.fn(async () => ({
      kind: "none" as const,
      currentVersion: "1.1.3",
      policySource: "none" as const,
      updateAvailable: false,
    }));
    const installCurrentVerifiedUpdate = vi.fn(async () => undefined);
    const getCalls = vi.fn(async () => ({
      schemaVersion: 2,
      capabilities: ["calls.internal", "calls.video", "calls.screenShare"],
      notificationActions: false,
    }));
    const showIncoming = vi.fn(async () => undefined);
    const openCall = vi.fn(async () => undefined);
    const updateCredentials = vi.fn(async () => undefined);
    const closeCall = vi.fn(async () => undefined);
    const unsubscribe = vi.fn();
    const onCallAction = vi.fn(() => unsubscribe);

    Object.defineProperty(window, "__DOFLOW_DESKTOP__", {
      configurable: true,
      value: {
        isDesktop: true,
        platform: "windows",
        appVersion: "1.1.3",
        bridgeVersion: 2,
        profileId,
        profileEmail: "synthetic@example.test",
        desktopReady,
        registerProfileMetadata,
        requestProfileSwitch,
        getUpdateState,
        installCurrentVerifiedUpdate,
        startDesktopGoogleOAuth: async () => undefined,
        getDesktopCallCapabilities: getCalls,
        showIncomingDesktopCall: showIncoming,
        dismissIncomingDesktopCall: async () => undefined,
        openDesktopCall: openCall,
        updateDesktopCallCredentials: updateCredentials,
        closeDesktopCall: closeCall,
        onDesktopCallAction: onCallAction,
      },
    });

    expect(isDoflowDesktop()).toBe(true);
    expect(getDesktopEmailPrefill()).toBe("synthetic@example.test");
    expect(supportsDesktopSecureCredentials()).toBe(false);
    await expect(stageDesktopPassword("synthetic-value")).resolves.toBe(false);
    await expect(takeSavedDesktopPassword()).resolves.toBeNull();
    await expect(invalidateSavedDesktopPassword()).resolves.toBe(false);

    await expect(notifyDesktopReady("authenticated")).resolves.toBe(true);
    expect(desktopReady).toHaveBeenCalledWith("authenticated");
    await expect(registerDesktopProfile({
      userId: "synthetic-user",
      tenantId: "synthetic-tenant",
      tenantSlug: "synthetic",
      name: "Synthetic user",
      email: "synthetic@example.test",
    })).resolves.toEqual({ credentialStatus: "none" });
    expect(registerProfileMetadata).toHaveBeenCalledOnce();
    await expect(requestDesktopProfileSwitch()).resolves.toBe(true);
    expect(requestProfileSwitch).toHaveBeenCalledOnce();
    await expect(getDesktopUpdateState()).resolves.toMatchObject({ currentVersion: "1.1.3" });
    await expect(installDesktopUpdate()).resolves.toBe(true);
    expect(installCurrentVerifiedUpdate).toHaveBeenCalledOnce();

    const call = {
      sessionId,
      callType: "video" as const,
      direction: "incoming" as const,
      displayName: "Partecipante sintetico",
      guestMode: false,
    };
    const credentials = {
      serverUrl: "wss://synthetic.livekit.cloud",
      accessToken: "synthetic-not-a-real-token",
    };
    expect(getDesktopCallsDeviceId()).toBe(`desktop-${profileId}`);
    await expect(getDesktopCallCapabilities()).resolves.toMatchObject({ schemaVersion: 2 });
    await expect(showIncomingDesktopCall(call)).resolves.toBe(true);
    await expect(openDesktopCall(call, credentials)).resolves.toBe(true);
    await expect(updateDesktopCallCredentials(sessionId, credentials)).resolves.toBe(true);
    await expect(closeDesktopCall(sessionId)).resolves.toBe(true);
    expect(subscribeDesktopCallActions(() => undefined)).toBe(unsubscribe);
    expect(showIncoming).toHaveBeenCalledWith(call);
    expect(openCall).toHaveBeenCalledWith(call, credentials);
    expect(updateCredentials).toHaveBeenCalledWith(sessionId, credentials);
    expect(closeCall).toHaveBeenCalledWith(sessionId);
    expect(onCallAction).toHaveBeenCalledOnce();
  });
});
