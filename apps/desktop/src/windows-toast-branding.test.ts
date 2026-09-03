import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(desktopRoot, "../..");
const readDesktop = (path: string) => readFileSync(resolve(desktopRoot, path), "utf8");
const readRepo = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("Windows toast branding contract", () => {
  const notification = readDesktop("src-tauri/src/notification.rs");
  const callManager = readDesktop("src-tauri/src/call_manager.rs");
  const cargo = readDesktop("src-tauri/Cargo.toml");
  const lock = readDesktop("src-tauri/Cargo.lock");
  const config = JSON.parse(readDesktop("src-tauri/tauri.conf.json"));
  const manifest = JSON.parse(readRepo("scripts/doflow-brand-assets.manifest.json"));
  const workflow = readRepo(".github/workflows/desktop-release.yml");

  it("routes Calls through one Windows-specific WinRT toast with preserved content", () => {
    expect(callManager).toContain("crate::notification::show_incoming_call(&app)");
    expect(callManager).not.toContain(".notification()\n");
    expect(notification).toContain('const NOTIFICATION_TITLE: &str = "Doflow Calls"');
    expect(notification).toContain('const NOTIFICATION_BODY: &str = "Chiamata Doflow in arrivo"');
    expect(notification).toContain("ToastNotificationManager::CreateToastNotifierWithId");
    expect(notification).toContain("ToastNotification::CreateToastNotification");
    expect(notification).toContain("url::Url::from_file_path");
    expect(notification).toContain("SetCurrentProcessExplicitAppUserModelID");
    expect(notification).toContain('"appLogoOverride"');
    expect(notification).toContain('omitting hint-crop="circle"');
    expect(notification).toContain('duration="short"');
    expect(notification).toContain('<audio silent="true"/>');
    expect(notification).not.toMatch(/powershell|Command::new|generic invoke/i);
  });

  it("pins the already-resolved WinRT backend and does not introduce a duplicate version", () => {
    expect(cargo).toContain('windows = { version = "=0.61.3"');
    expect(lock.match(/name = "tauri-winrt-notification"/g)).toHaveLength(1);
    expect(lock.match(/name = "windows"\r?\nversion = "0\.61\.3"/g)).toHaveLength(1);
    expect(lock).toMatch(/name = "tauri-winrt-notification"\r?\nversion = "0\.7\.3"/);
    expect(lock).toMatch(/name = "notify-rust"\r?\nversion = "4\.17\.0"/);
    expect(lock).toMatch(/name = "tauri-plugin-notification"\r?\nversion = "2\.3\.3"/);
  });

  it("bundles one deterministic local PNG and validates its trust boundary", () => {
    expect(manifest.notificationResource).toMatchObject({
      path: "apps/desktop/src-tauri/icons/notification-app-logo.png",
      bundleDestination: "notification-app-logo.png",
      width: 512,
      height: 512,
      sha256: "882116585a3bf34d595b57663748681c42f2c02983a0de3e8b1554a7876b3dfa",
    });
    expect(config.bundle.resources).toEqual({
      "icons/notification-app-logo.png": "notification-app-logo.png",
    });
    expect(notification).toContain("validate_resource_path(resource_dir, &logo_path)");
    expect(notification).toContain("is_unc_path");
    expect(notification).toContain("canonical_candidate.starts_with(&canonical_dir)");
    expect(notification).not.toMatch(/https?:\/\/|javascript|invoke_handler/);
  });

  it("preserves production identity without ineffective shell-attribution installer workarounds", () => {
    expect(config.productName).toBe("Doflow");
    expect(config.identifier).toBe("it.doflow.desktop");
    expect(config.bundle.windows.nsis).not.toHaveProperty("installerHooks");
    expect(config.bundle.windows).not.toHaveProperty("wix");
    expect(existsSync(resolve(desktopRoot, "src-tauri/windows/nsis/notification-branding.nsh"))).toBe(false);
    expect(existsSync(resolve(desktopRoot, "src-tauri/windows/wix/notification-branding.wxs"))).toBe(false);
  });

  it("locks the accepted Windows shell limitation without adding a new packaging stack", () => {
    const productionContract = [cargo, lock, JSON.stringify(config), workflow].join("\n");
    expect(productionContract).not.toMatch(
      /Microsoft\.WindowsAppSDK|Microsoft\.Windows\.AppNotifications|AppNotificationManager|WindowsAppRuntime|ToastActivatorCLSID|CustomActivator|sparse[ -]package|\bMSIX\b/i,
    );
    expect(notification).not.toMatch(/AppNotificationManager|Microsoft\.Windows\.AppNotifications/i);
    expect(notification).toContain("ToastNotificationManager::CreateToastNotifierWithId");
    expect(notification).toContain("SetCurrentProcessExplicitAppUserModelID");
  });

  it("does not add remote commands, broad capabilities, or a second toast", () => {
    const remote = readDesktop("src-tauri/capabilities/doflow-remote.json");
    const local = readDesktop("src-tauri/capabilities/calls-local.json");
    const lib = readDesktop("src-tauri/src/lib.rs");
    expect(lib).not.toMatch(/notification::[A-Za-z_]+,/);
    expect(remote).not.toMatch(/notification|filesystem|fs:|shell:|process:/i);
    expect(local).not.toMatch(/notification|filesystem|fs:|shell:|process:/i);
    expect(callManager.match(/show_incoming_call\(&app\)/g)).toHaveLength(1);
  });
});
