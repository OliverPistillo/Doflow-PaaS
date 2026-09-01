import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const tag = "desktop-v1.0.1";

function git(...args: string[]) {
  return execFileSync("git", ["-C", repositoryRoot, ...args], { encoding: "utf8" }).trim();
}

describe("published Desktop 1.0.1 compatibility contract", () => {
  it("reads the immutable tag without checking it out or changing the worktree", () => {
    const statusBefore = git("status", "--short");
    expect(git("rev-list", "-n", "1", tag)).toBe("1357f2123d19b557e9755f9993ffcf9991f33250");
    const bridge = git("show", `${tag}:apps/frontend/src/lib/desktop-bridge.ts`);
    const nativeBridge = git("show", `${tag}:apps/desktop/src-tauri/src/profile_webview.rs`);
    const models = git("show", `${tag}:apps/desktop/src-tauri/src/models.rs`);
    expect(models).toContain("pub const BRIDGE_VERSION: u8 = 1;");
    expect(bridge).toContain("readonly appVersion: string");
    expect(bridge).toContain("readonly bridgeVersion: number");
    expect(bridge).toContain("getUpdateState");
    expect(bridge).toContain("installCurrentVerifiedUpdate");
    expect(nativeBridge).toContain("get_update_state");
    expect(nativeBridge).toContain("install_current_verified_update");
    expect(git("status", "--short")).toBe(statusBefore);
  });

  it("keeps the first 1.1 rollout policy transitional only while 1.1.0 is unpublished", () => {
    const sourcePackage = JSON.parse(readFileSync(join(repositoryRoot, "apps/desktop/package.json"), "utf8"));
    const releasePolicy = JSON.parse(readFileSync(join(repositoryRoot, "apps/desktop/release-policy.json"), "utf8"));
    const publishedTags = git("tag", "--list", "desktop-v1.1.0");
    if (sourcePackage.version === "1.1.0" && publishedTags === "") {
      expect(releasePolicy.minimumSupportedVersion).toBe("1.0.0");
    }
  });
});
