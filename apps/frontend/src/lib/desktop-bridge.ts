"use client";

import * as React from "react";

export type DesktopUpdateState = {
  kind: "none" | "optional" | "mandatory" | "unavailable";
  currentVersion: string;
  latestVersion?: string;
  minimumSupportedVersion?: string;
  message?: string;
  policySource: "network" | "cache" | "none";
  updateAvailable: boolean;
  canContinueWithoutUpdate?: boolean;
};

export type DesktopNativeCallType = "audio" | "video";
export type DesktopNativeCallDirection = "incoming" | "outgoing" | "guest";
export type DesktopNativeCall = {
  sessionId: string;
  callType: DesktopNativeCallType;
  direction: DesktopNativeCallDirection;
  displayName: string;
  guestMode: boolean;
  expiresAt?: string;
};
export type DesktopLivekitCredentials = { serverUrl: string; accessToken: string };
export type DesktopCallActionEvent = {
  sessionId: string;
  action: "accept" | "reject" | "cancel" | "end" | "failed" | "refreshToken" | "ready";
  reason?: string;
};
export type DesktopCallCapabilities = {
  schemaVersion: number;
  capabilities: string[];
  notificationActions: boolean;
};

type DesktopProfileMetadata = {
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials?: string;
};

type DoflowDesktopContext = {
  readonly isDesktop: true;
  readonly platform: "windows";
  readonly appVersion: string;
  readonly bridgeVersion: number;
  readonly profileId: string;
  readonly profileEmail?: string;
  desktopReady: (state: "authenticated" | "needs-auth" | "mfa") => Promise<void>;
  registerProfileMetadata: (metadata: DesktopProfileMetadata) => Promise<unknown>;
  requestProfileSwitch: () => Promise<void>;
  getUpdateState: () => Promise<DesktopUpdateState>;
  installCurrentVerifiedUpdate: () => Promise<void>;
  startDesktopGoogleOAuth: () => Promise<void>;
  getDesktopCallCapabilities?: () => Promise<DesktopCallCapabilities>;
  showIncomingDesktopCall?: (call: DesktopNativeCall) => Promise<void>;
  dismissIncomingDesktopCall?: (sessionId: string) => Promise<void>;
  openDesktopCall?: (call: DesktopNativeCall, credentials: DesktopLivekitCredentials) => Promise<void>;
  updateDesktopCallCredentials?: (sessionId: string, credentials: DesktopLivekitCredentials) => Promise<void>;
  closeDesktopCall?: (sessionId: string) => Promise<void>;
  onDesktopCallAction?: (handler: (event: DesktopCallActionEvent) => void) => () => void;
};

export type LegacyDesktopUpdater = {
  readonly identity: object;
  readonly appVersion: string;
  getUpdateState: () => Promise<DesktopUpdateState>;
  installCurrentVerifiedUpdate: () => Promise<void>;
};

declare global {
  interface Window {
    __DOFLOW_DESKTOP__?: DoflowDesktopContext;
  }
}

function context(): DoflowDesktopContext | null {
  if (typeof window === "undefined") return null;
  const candidate = window.__DOFLOW_DESKTOP__;
  if (
    candidate?.isDesktop !== true
    || candidate.platform !== "windows"
    || candidate.bridgeVersion < 1
    || typeof candidate.profileId !== "string"
  ) {
    return null;
  }
  return candidate;
}

export function resolveLegacyDesktopUpdater(candidate: unknown): LegacyDesktopUpdater | null {
  if (!candidate || typeof candidate !== "object") return null;
  const desktop = candidate as Partial<DoflowDesktopContext>;
  if (
    desktop.isDesktop !== true
    || desktop.platform !== "windows"
    || desktop.bridgeVersion !== 1
    || typeof desktop.appVersion !== "string"
    || desktop.appVersion.trim() === ""
    || typeof desktop.getUpdateState !== "function"
    || typeof desktop.installCurrentVerifiedUpdate !== "function"
  ) {
    return null;
  }
  return {
    identity: candidate,
    appVersion: desktop.appVersion,
    getUpdateState: desktop.getUpdateState.bind(candidate),
    installCurrentVerifiedUpdate: desktop.installCurrentVerifiedUpdate.bind(candidate),
  };
}

export function getLegacyDesktopUpdater(): LegacyDesktopUpdater | null {
  if (typeof window === "undefined") return null;
  return resolveLegacyDesktopUpdater(window.__DOFLOW_DESKTOP__);
}

export class LegacyDesktopUpdateAttemptRegistry {
  readonly #attempted = new WeakSet<object>();

  claim(updater: LegacyDesktopUpdater) {
    if (this.#attempted.has(updater.identity)) return false;
    this.#attempted.add(updater.identity);
    return true;
  }
}

function isDesktopUpdateState(value: unknown): value is DesktopUpdateState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<DesktopUpdateState>;
  return (
    ["none", "optional", "mandatory", "unavailable"].includes(state.kind || "")
    && typeof state.currentVersion === "string"
    && ["network", "cache", "none"].includes(state.policySource || "")
    && typeof state.updateAvailable === "boolean"
  );
}

export async function coordinateLegacyDesktopUpdate(
  updater: LegacyDesktopUpdater,
  onUpdateFound: (state: DesktopUpdateState) => void | Promise<void> = () => undefined,
) {
  const state = await updater.getUpdateState();
  if (!isDesktopUpdateState(state)) throw new Error("Invalid Desktop update state");
  const shouldInstall = state.updateAvailable
    && (state.kind === "optional" || state.kind === "mandatory");
  if (!shouldInstall) return { status: "none" as const, state };
  await onUpdateFound(state);
  await updater.installCurrentVerifiedUpdate();
  return { status: "restart-pending" as const, state };
}

export function isDoflowDesktop() {
  return context() !== null;
}

export function useDoflowDesktop() {
  return React.useSyncExternalStore(
    () => () => undefined,
    isDoflowDesktop,
    () => false,
  );
}

export function getDesktopEmailPrefill() {
  const email = context()?.profileEmail?.trim().toLowerCase();
  return email && /^\S+@\S+\.\S+$/.test(email) ? email : "";
}

export async function startDesktopGoogleOAuth(): Promise<boolean> {
  const desktop = context();
  if (!desktop) return false;
  await desktop.startDesktopGoogleOAuth();
  return true;
}

export async function notifyDesktopReady(state: "authenticated" | "needs-auth" | "mfa") {
  const desktop = context();
  if (!desktop) return false;
  await desktop.desktopReady(state);
  return true;
}

export async function registerDesktopProfile(metadata: DesktopProfileMetadata) {
  const desktop = context();
  if (!desktop) return false;
  await desktop.registerProfileMetadata(metadata);
  return true;
}

export async function requestDesktopProfileSwitch() {
  const desktop = context();
  if (!desktop) return false;
  await desktop.requestProfileSwitch();
  return true;
}

export async function getDesktopUpdateState() {
  return context()?.getUpdateState() ?? null;
}

export async function installDesktopUpdate() {
  const desktop = context();
  if (!desktop) return false;
  await desktop.installCurrentVerifiedUpdate();
  return true;
}

function callContext(): DoflowDesktopContext | null {
  const desktop = context();
  if (!desktop || desktop.bridgeVersion < 2) return null;
  if (
    typeof desktop.getDesktopCallCapabilities !== "function"
    || typeof desktop.showIncomingDesktopCall !== "function"
    || typeof desktop.dismissIncomingDesktopCall !== "function"
    || typeof desktop.openDesktopCall !== "function"
    || typeof desktop.updateDesktopCallCredentials !== "function"
    || typeof desktop.closeDesktopCall !== "function"
    || typeof desktop.onDesktopCallAction !== "function"
  ) return null;
  return desktop;
}

export function getDesktopCallsDeviceId() {
  const profileId = callContext()?.profileId;
  return profileId && /^[0-9a-f-]{36}$/i.test(profileId) ? `desktop-${profileId}` : null;
}

export async function getDesktopCallCapabilities() {
  return callContext()?.getDesktopCallCapabilities?.() ?? null;
}

export async function showIncomingDesktopCall(call: DesktopNativeCall) {
  const desktop = callContext();
  if (!desktop?.showIncomingDesktopCall) return false;
  await desktop.showIncomingDesktopCall(call);
  return true;
}

export async function dismissIncomingDesktopCall(sessionId: string) {
  const desktop = callContext();
  if (!desktop?.dismissIncomingDesktopCall) return false;
  await desktop.dismissIncomingDesktopCall(sessionId);
  return true;
}

export async function openDesktopCall(call: DesktopNativeCall, credentials: DesktopLivekitCredentials) {
  const desktop = callContext();
  if (!desktop?.openDesktopCall) return false;
  await desktop.openDesktopCall(call, credentials);
  return true;
}

export async function updateDesktopCallCredentials(sessionId: string, credentials: DesktopLivekitCredentials) {
  const desktop = callContext();
  if (!desktop?.updateDesktopCallCredentials) return false;
  await desktop.updateDesktopCallCredentials(sessionId, credentials);
  return true;
}

export async function closeDesktopCall(sessionId: string) {
  const desktop = callContext();
  if (!desktop?.closeDesktopCall) return false;
  await desktop.closeDesktopCall(sessionId);
  return true;
}

export function subscribeDesktopCallActions(handler: (event: DesktopCallActionEvent) => void) {
  return callContext()?.onDesktopCallAction?.(handler) ?? null;
}
