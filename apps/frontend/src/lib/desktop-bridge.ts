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

export function isDoflowDesktop() {
  return context() !== null;
}

export function useDoflowDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(false);
  React.useEffect(() => setIsDesktop(isDoflowDesktop()), []);
  return isDesktop;
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
