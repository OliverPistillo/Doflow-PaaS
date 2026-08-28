import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import semver from "semver";

export function validateReleaseAssets(directory, expectedVersion) {
  if (!semver.valid(expectedVersion)) throw new Error("Expected version is not valid SemVer");
  const names = readdirSync(directory);
  const manifestPath = resolve(directory, "latest.json");
  if (!existsSync(manifestPath)) throw new Error("latest.json is missing");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== expectedVersion) throw new Error("latest.json version mismatch");
  const platform = manifest.platforms?.["windows-x86_64"];
  if (!platform || typeof platform.url !== "string" || !platform.url.startsWith("https://github.com/OliverPistillo/Doflow-PaaS/releases/download/desktop-v")) {
    throw new Error("latest.json has no fixed GitHub Windows x64 updater URL");
  }
  if (typeof platform.signature !== "string" || platform.signature.length < 64) {
    throw new Error("latest.json has no valid-looking updater signature");
  }
  const updaterName = decodeURIComponent(new URL(platform.url).pathname.split("/").at(-1));
  if (!names.includes(updaterName)) throw new Error("latest.json references a missing updater artifact");
  if (!names.some((name) => /setup\.exe$/i.test(name))) throw new Error("NSIS installer is missing");
  if (!names.some((name) => /\.msi$/i.test(name))) throw new Error("MSI installer is missing");
  if (!names.some((name) => /\.sig$/i.test(name))) throw new Error("Updater signature file is missing");
  return { manifest, updaterName };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const [, , directory, expectedVersion] = process.argv;
  if (!directory || !expectedVersion) {
    throw new Error("Usage: validate-release-assets.mjs <directory> <version>");
  }
  validateReleaseAssets(resolve(directory), expectedVersion);
  process.stdout.write("Desktop release artifacts validated\n");
}
