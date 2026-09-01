import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClosePrompt } from "./components/ClosePrompt";
import { ProfilePicker } from "./components/ProfilePicker";
import { ExpiredProfileScreen } from "./components/StatusScreens";
import type { SavedProfile } from "./types";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));
const tauriRoot = fileURLToPath(new URL("../src-tauri/", import.meta.url));

function profile(index: number): SavedProfile {
  return {
    id: `${index}0000000-4000-4000-8000-00000000000${index}`,
    userId: `qa-${index}`,
    tenantSlug: index === 3 ? "workspace" : "doflow",
    name: `Profilo ${index}`,
    email: `profilo${index}@example.test`,
    initials: `P${index}`,
    createdAt: "2026-01-01T00:00:00Z",
    lastUsedAt: "2026-01-01T00:00:00Z",
    webviewContextId: `${index}0000000-4000-4000-8000-00000000000${index}`,
  };
}

describe("desktop native polish contracts", () => {
  it("renders a multi-profile picker without a dominant remove column", () => {
    const markup = renderToStaticMarkup(
      <ProfilePicker profiles={[profile(1), profile(2), profile(3)]} selectedProfileId={profile(1).id} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />,
    );
    expect(markup).toContain("Profili memorizzati");
    expect(markup).toContain("Accedi rapidamente ai tuoi profili");
    expect(markup).toContain("Accedi con un altro account");
    expect(markup).toContain("Gestione profili");
    expect(markup).toContain("profile-picker-panel");
    expect(markup).toContain("mini-wordmark");
    expect(markup).toContain("panel-close-button");
    expect(markup.match(/class="profile-row/g)).toHaveLength(3);
    expect(markup).toContain("profile-row is-selected");
    expect(markup).not.toContain("profile-more");
    expect(markup).not.toContain("Doflow Desktop 9.8.7");
    const pickerSource = readFileSync(fileURLToPath(new URL("components/ProfilePicker.tsx", import.meta.url)), "utf8");
    expect(pickerSource).not.toMatch(/Oliver|Martina|Daniele/);
  });

  it("uses the shared stored-profile panel for an expired profile", () => {
    const expired = profile(1);
    const markup = renderToStaticMarkup(
      <ExpiredProfileScreen profile={expired} profiles={[expired, profile(2)]} onReauthenticate={() => undefined} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />,
    );
    expect(markup).toContain("Profili memorizzati");
    expect(markup).toContain("profile-row is-selected");
    expect(markup).not.toContain("Bentornato");
    expect(markup).not.toContain("Accedi di nuovo");
  });

  it("renders the approved close prompt copy and both explicit choices", () => {
    const markup = renderToStaticMarkup(
      <ClosePrompt onStayActive={() => undefined} onExit={() => undefined} onCancel={() => undefined} />,
    );
    expect(markup).toContain("Chiudere Doflow?");
    expect(markup).toContain("Rimani attivo");
    expect(markup).toContain("Esci da Doflow");
    expect(markup).toContain("Imposta questa opzione come predefinita");
    expect(markup).toContain("Doflow continuerà a funzionare in background");
    expect(markup).toContain("close-prompt-glyph");
    expect(markup).toContain("close-prompt-information");
    expect(markup).toContain("primary-action close-stay-action");
    expect(markup).toContain("secondary-action close-exit-action");
    expect(markup).toContain("panel-close-button");
    expect(markup).toContain('role="dialog"');
  });

  it("declares a release-only Windows GUI subsystem and local native features", () => {
    const main = readFileSync(`${tauriRoot}/src/main.rs`, "utf8");
    const cargo = readFileSync(`${tauriRoot}/Cargo.toml`, "utf8");
    const traySource = readFileSync(`${tauriRoot}/src/tray.rs`, "utf8");
    const remote = JSON.parse(readFileSync(`${tauriRoot}/capabilities/doflow-remote.json`, "utf8"));
    const local = JSON.parse(readFileSync(`${tauriRoot}/capabilities/bootstrap-local.json`, "utf8"));
    const config = JSON.parse(readFileSync(`${tauriRoot}/tauri.conf.json`, "utf8"));
    const desktopPackage = JSON.parse(readFileSync(`${tauriRoot}/../package.json`, "utf8"));

    expect(main).toContain('#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]');
    expect(cargo).toContain('tauri-plugin-single-instance = "=2.4.3"');
    expect(cargo).toContain('features = ["tray-icon"]');
    expect(config.version).toBe("1.1.0");
    expect(desktopPackage.version).toBe("1.1.0");
    expect(cargo).toMatch(/version = "1\.1\.0"/);
    expect(config.bundle.icon).toContain("icons/icon.ico");
    expect(config.bundle.windows.nsis.installerIcon).toBe("icons/icon.ico");
    expect(traySource).toContain("default_window_icon().cloned()");
    expect(traySource).toContain("builder = builder.icon(icon)");
    expect(traySource).toContain("app.package_info().version.to_string()");
    expect(traySource).toContain("Canale Stable");
    for (const icon of [
      "icons/doflow_favicon_source.png",
      "icons/icon.ico",
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
    ]) {
      expect(existsSync(`${tauriRoot}/${icon}`), icon).toBe(true);
    }
    expect(remote.permissions).toEqual([
      "allow-desktop-ready",
      "allow-register-profile-metadata",
      "allow-request-profile-switch",
      "allow-get-update-state",
      "allow-install-current-verified-update",
      "allow-start-desktop-google-oauth",
      "allow-get-desktop-call-capabilities",
      "allow-show-incoming-desktop-call",
      "allow-dismiss-incoming-desktop-call",
      "allow-open-desktop-call",
      "allow-update-desktop-call-credentials",
      "allow-close-desktop-call",
    ]);
    expect(local.permissions).toEqual(expect.arrayContaining([
      "allow-request-desktop-close",
      "allow-resolve-desktop-close",
      "allow-cancel-desktop-close",
    ]));
    expect(sourceRoot).toContain("src");
  });
});
