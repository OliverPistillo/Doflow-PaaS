import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = resolve(import.meta.dirname, "..");

describe("remote WebView security contract", () => {
  it("grants only the six versioned Desktop bridge commands to app.doflow.it", () => {
    const capability = JSON.parse(
      readFileSync(resolve(desktopRoot, "src-tauri/capabilities/doflow-remote.json"), "utf8"),
    );
    expect(capability.remote.urls).toEqual(["https://app.doflow.it"]);
    expect(capability.permissions).toEqual([
      "allow-desktop-ready",
      "allow-register-profile-metadata",
      "allow-request-profile-switch",
      "allow-get-update-state",
      "allow-install-current-verified-update",
      "allow-start-desktop-google-oauth",
    ]);
  });

  it("does not expose broad native capabilities to the remote origin", () => {
    const source = readFileSync(
      resolve(desktopRoot, "src-tauri/capabilities/doflow-remote.json"),
      "utf8",
    );
    for (const forbidden of ["fs:", "shell:", "process:", "http:", "updater:", "core:window:"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("remote WebView startup regression", () => {
  const appSource = readFileSync(resolve(desktopRoot, "src/App.tsx"), "utf8");
  const commandSource = readFileSync(
    resolve(desktopRoot, "src-tauri/src/commands.rs"),
    "utf8",
  );
  const webviewSource = readFileSync(
    resolve(desktopRoot, "src-tauri/src/profile_webview.rs"),
    "utf8",
  );

  it("deduplicates StrictMode startup and creates dynamic WebViews off the synchronous IPC path", () => {
    expect(appSource).toContain("const bootstrapRequested = useRef(false)");
    expect(commandSource).toContain("pub async fn prepare_profile_webview");
    expect(commandSource).toContain("app.run_on_main_thread");
    expect(commandSource).toContain("tokio::sync::oneshot::channel()");
  });

  it("initializes WebView2 before hiding and does not replace its browser user agent", () => {
    expect(webviewSource).toContain(".visible(true)");
    expect(webviewSource).toContain(".always_on_bottom(true)");
    expect(webviewSource).toContain("window\n            .hide()");
    expect(webviewSource).not.toContain(".user_agent(");
  });

  it("signals only the actually loaded login route as a needs-auth fallback", () => {
    expect(webviewSource).toContain("window.location.pathname === '/login'");
    expect(webviewSource).toContain("signalDesktopReady('needs-auth')");
    expect(webviewSource).not.toContain("signalDesktopReady('authenticated')");
  });
});

describe("automatic Desktop versioning", () => {
  it("uses a real SemVer patch increment", async () => {
    // @ts-expect-error The workflow executes this JavaScript module directly with Node.
    const { nextDesktopVersion } = await import("../scripts/next-desktop-version.mjs");
    expect(nextDesktopVersion([])).toBe("1.0.0");
    expect(nextDesktopVersion(["desktop-v1.0.9", "desktop-v1.0.10", "not-a-tag"])).toBe("1.0.11");
    expect(nextDesktopVersion(["desktop-v2.4.0-beta.1", "desktop-v1.9.9"])).toBe("2.4.0");
  });
});

describe("Desktop release workflow", () => {
  const workflow = readFileSync(resolve(desktopRoot, "../../.github/workflows/desktop-release.yml"), "utf8");

  it("validates on main while publication remains explicitly gated", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("DESKTOP_RELEASE_ENABLED");
    expect(workflow).toContain("if: needs.release-gate.outputs.enabled == 'true' && github.ref == 'refs/heads/main'");
    expect(workflow).toContain("environment: desktop-release");
  });

  it("builds the triggering SHA and validates signed draft artifacts before publishing", () => {
    expect(workflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
    expect(workflow).toContain("tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f");
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}");
    expect(workflow).toContain("DOFLOW_UPDATER_PUBLIC_KEY: ${{ vars.TAURI_SIGNING_PUBLIC_KEY }}");
    expect(workflow).toContain("pubkey = $env:DOFLOW_UPDATER_PUBLIC_KEY");
    expect(workflow).toContain("includeUpdaterJson: true");
    expect(workflow).toContain("validate-release-assets.mjs");
    expect(workflow).toContain("if ($tagCommit -ne \"$env:GITHUB_SHA\")");
    expect(workflow.indexOf("validate-release-assets.mjs")).toBeLessThan(workflow.indexOf("--draft=false --latest"));
  });
});

describe("release asset validation", () => {
  it("accepts only a complete Windows x64 updater set", async () => {
    // @ts-expect-error The workflow executes this JavaScript module directly with Node.
    const { validateReleaseAssets } = await import("../scripts/validate-release-assets.mjs");
    const directory = mkdtempSync(resolve(tmpdir(), "doflow-desktop-release-"));
    const installer = "Doflow_1.2.3_x64-setup.exe";
    try {
      writeFileSync(resolve(directory, installer), "fixture");
      writeFileSync(resolve(directory, "Doflow_1.2.3_x64_en-US.msi"), "fixture");
      writeFileSync(resolve(directory, `${installer}.sig`), "fixture");
      writeFileSync(
        resolve(directory, "latest.json"),
        JSON.stringify({
          version: "1.2.3",
          platforms: {
            "windows-x86_64": {
              url: `https://github.com/OliverPistillo/Doflow-PaaS/releases/download/desktop-v1.2.3/${installer}`,
              signature: "a".repeat(64),
            },
          },
        }),
      );
      expect(validateReleaseAssets(directory, "1.2.3").updaterName).toBe(installer);
      rmSync(resolve(directory, `${installer}.sig`));
      expect(() => validateReleaseAssets(directory, "1.2.3")).toThrow("Updater signature file is missing");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("acceptance fixture isolation", () => {
  it("loads the QA surface only behind Vite DEV and the explicit QA mode", () => {
    const source = readFileSync(resolve(desktopRoot, "src/main.tsx"), "utf8");
    expect(source).toContain('import.meta.env.DEV && import.meta.env.VITE_DESKTOP_QA === "1"');
    expect(source).toContain('import("./qa/AcceptanceFixture")');
  });
});
