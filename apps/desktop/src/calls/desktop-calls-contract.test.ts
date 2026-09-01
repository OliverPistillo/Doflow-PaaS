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
      "core:window:allow-close",
      "allow-get-native-call-context",
      "allow-send-native-call-action",
      "allow-close-native-call-window",
    ]);
  });

  it("supports media cleanup, reconnect feedback, device changes and screen-share restoration", () => {
    const window = read("src/calls/LiveKitCallRuntime.tsx");
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
      /api\.close\(\{ action: failed \? "failed" : "end"/,
    ]) expect(window).toMatch(contract);
  });

  it("renders the call shell synchronously and isolates the LiveKit runtime behind an error boundary", () => {
    const entry = read("src/main.tsx");
    const shell = read("src/calls/CallWindow.tsx");
    expect(entry).toContain('import { CallWindow } from "./calls/CallWindow"');
    expect(entry).not.toMatch(/lazy\(\(\) => import\("\.\/calls\/CallWindow"/);
    expect(shell).toContain('import("./LiveKitCallRuntime")');
    expect(shell).toContain("class CallRuntimeBoundary");
    expect(shell).toContain("Impossibile avviare la chiamata");
    expect(shell).toContain("desktop_renderer_failed");
    expect(shell).toContain("api.close");
  });

  it("closes native media windows outside CloseRequested with a re-entrancy guard", () => {
    const manager = read("src-tauri/src/call_manager.rs");
    expect(manager).toContain("closing_sessions: HashSet<String>");
    expect(manager).toContain("schedule_native_window_close");
    expect(manager).toContain("tokio::task::yield_now().await");
    expect(manager).toContain("destroy_window(&close_app, &close_label)");
    expect(manager.indexOf("destroy_window(&close_app, &close_label)")).toBeLessThan(manager.indexOf("dispatch_remote_action_to_profile(&notify_app"));
    expect(manager).toContain("spawn_blocking");
  });

  it("keeps packaged regression fixtures compile-time gated and disabled by default", () => {
    const manifest = read("src-tauri/Cargo.toml");
    const manager = read("src-tauri/src/call_manager.rs");
    const runtime = read("src-tauri/src/lib.rs");
    expect(manifest).toMatch(/\[features\][\s\S]*default = \[\][\s\S]*calls-qa-fixture = \[\]/);
    expect(manager).toMatch(/#\[cfg\(feature = "calls-qa-fixture"\)\][\s\S]*install_qa_fixture/);
    expect(manager).toMatch(/#\[cfg\(feature = "calls-qa-fixture"\)\][\s\S]*install_qa_incoming_fixture/);
    expect(runtime).toContain('#[cfg(feature = "calls-qa-fixture")]');
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
