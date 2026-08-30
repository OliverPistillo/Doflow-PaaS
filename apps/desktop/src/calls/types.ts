export type NativeCallType = "audio" | "video";
export type NativeCallDirection = "incoming" | "outgoing" | "guest";

export interface NativeCallDescriptor {
  sessionId: string;
  callType: NativeCallType;
  direction: NativeCallDirection;
  displayName: string;
  guestMode: boolean;
  expiresAt?: string;
}

export interface LivekitCredentials {
  serverUrl: string;
  accessToken: string;
}

export interface NativeCallContext {
  call: NativeCallDescriptor;
  credentials?: LivekitCredentials;
}

export type NativeCallAction =
  | "accept"
  | "reject"
  | "cancel"
  | "end"
  | "failed"
  | "refreshToken"
  | "ready";

export interface NativeCallActionPayload {
  action: NativeCallAction;
  reason?: string;
}

export interface DesktopCallCapabilities {
  schemaVersion: number;
  capabilities: string[];
  notificationActions: boolean;
}

export interface MediaDeviceGroups {
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
}
