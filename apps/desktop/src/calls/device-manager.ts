import type { MediaDeviceGroups } from "./types";

export async function enumerateCallDevices(): Promise<MediaDeviceGroups> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { microphones: [], speakers: [], cameras: [] };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    microphones: devices.filter((device) => device.kind === "audioinput"),
    speakers: devices.filter((device) => device.kind === "audiooutput"),
    cameras: devices.filter((device) => device.kind === "videoinput"),
  };
}

export function deviceLabel(device: MediaDeviceInfo, index: number, fallback: string): string {
  const value = device.label.trim();
  return value ? value.slice(0, 120) : `${fallback} ${index + 1}`;
}
