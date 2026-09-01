export type SavedProfile = {
  id: string;
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials?: string;
  createdAt: string;
  lastUsedAt: string;
  webviewContextId: string;
};

export type ProfileRegistry = {
  version: 1;
  lastUsedProfileId?: string;
  profiles: SavedProfile[];
  recoveredFromCorruption?: boolean;
};

export type UpdateKind = "none" | "optional" | "mandatory" | "unavailable";

export type DesktopUpdateState = {
  kind: UpdateKind;
  currentVersion: string;
  latestVersion?: string;
  minimumSupportedVersion?: string;
  message?: string;
  policySource: "network" | "cache" | "none";
  updateAvailable: boolean;
  canContinueWithoutUpdate: boolean;
};

export type PreparedProfile = {
  profileId: string;
  existing: boolean;
};

export type RemoteReadyPayload = {
  profileId: string;
  state: "authenticated" | "needs-auth" | "mfa";
};

export type UpdateProgressPayload = {
  downloaded: number;
  total?: number;
  phase: "starting" | "downloading" | "installing" | "failed";
  message?: string;
};
