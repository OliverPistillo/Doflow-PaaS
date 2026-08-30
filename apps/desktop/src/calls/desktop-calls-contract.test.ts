import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(desktopRoot, path), "utf8");

describe("native Desktop Calls contract", () => {
  it("keeps credentials memory-only and routes native windows through validated session labels", () => {
    const manager = read("src-tauri/src/call_manager.rs");
    expect(manager).toContain("Uuid::parse_str");
    expect(manager).toContain("parsed.get_version_num() != 4");
    expect(manager).toContain('const CALL_LABEL_PREFIX: &str = "call-"');
    expect(manager).toContain('const INCOMING_LABEL_PREFIX: &str = "incoming-"');
    expect(manager).toContain("active: Option<RoutedCall>");
    expect(manager).toContain("credentials: Option<LivekitCredentials>");
    expect(manager).not.toMatch(/write\(|write_all|atomic_write|localStorage|sessionStorage/);
  });

  it("exposes only exact call commands to the cloud origin and local call windows", () => {
    const remote = JSON.parse(read("src-tauri/capabilities/doflow-remote.json"));
    const local = JSON.parse(read("src-tauri/capabilities/calls-local.json"));
    expect(remote.remote.urls).toEqual(["https://app.doflow.it"]);
    expect(remote.windows).toEqual(["remote-*"]);
    expect(remote.permissions).toEqual(expect.arrayContaining([
      "allow-get-desktop-call-capabilities",
      "allow-show-incoming-desktop-call",
      "allow-dismiss-incoming-desktop-call",
      "allow-open-desktop-call",
      "allow-update-desktop-call-credentials",
      "allow-close-desktop-call",
    ]));
    expect(local.windows).toEqual(["call-*", "incoming-*"]);
    expect(local.permissions).toEqual([
      "core:event:default",
      "allow-get-native-call-context",
      "allow-send-native-call-action",
    ]);
  });

  it("supports media cleanup, reconnect feedback, device changes and screen-share restoration", () => {
    const window = read("src/calls/CallWindow.tsx");
    for (const contract of [
      /RoomEvent\.Reconnecting/,
      /RoomEvent\.Reconnected/,
      /RoomEvent\.MediaDevicesChanged/,
      /setMicrophoneEnabled/,
      /setCameraEnabled/,
      /setScreenShareEnabled/,
      /switchActiveDevice/,
      /publication\.track\?\.stop\(\)/,
      /restoreCameraPreview/,
      /nativeCallWindow\.sendAction\(\{ action: failed \? "failed" : "end"/,
    ]) expect(window).toMatch(contract);
  });

  it("allows secure LiveKit transports from bundled windows without broad native APIs", () => {
    const config = JSON.parse(read("src-tauri/tauri.conf.json"));
    const csp = String(config.app.security.csp);
    expect(csp).toContain("wss:");
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).not.toContain("unsafe-eval");
    expect(read("src-tauri/capabilities/calls-local.json")).not.toMatch(/fs:|shell:|process:|http:/);
  });
});
