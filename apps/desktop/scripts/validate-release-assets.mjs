import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import process from "node:process";
import semver from "semver";

const RELEASE_ASSET_PATH = /^\/repos\/OliverPistillo\/Doflow-PaaS\/releases\/assets\/([1-9]\d*)$/;

function withoutTerminalNewlines(value) {
  return value.replace(/(?:\r?\n)+$/, "");
}

export function parseReleaseAssetUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("latest.json updater URL is invalid");
  }
  const pathMatch = RELEASE_ASSET_PATH.exec(url.pathname);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "api.github.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !pathMatch
  ) {
    throw new Error("latest.json has no valid Doflow GitHub API release asset URL");
  }
  const assetId = Number(pathMatch[1]);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) {
    throw new Error("latest.json updater asset ID is invalid");
  }
  return { assetId, url };
}

export function validateReleaseAssets(directory, expectedVersion, releaseAssets) {
  if (!semver.valid(expectedVersion)) throw new Error("Expected version is not valid SemVer");
  if (!Array.isArray(releaseAssets)) throw new Error("GitHub release asset metadata is invalid");
  const names = readdirSync(directory);
  const manifestPath = resolve(directory, "latest.json");
  if (!existsSync(manifestPath)) throw new Error("latest.json is missing");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== expectedVersion) throw new Error("latest.json version mismatch");
  const platform = manifest.platforms?.["windows-x86_64"];
  if (!platform || typeof platform.url !== "string") {
    throw new Error("latest.json has no Windows x64 updater URL");
  }
  const { assetId } = parseReleaseAssetUrl(platform.url);
  const manifestSignature = typeof platform.signature === "string"
    ? withoutTerminalNewlines(platform.signature)
    : "";
  if (manifestSignature.length < 64) {
    throw new Error("latest.json has no valid-looking updater signature");
  }
  const matchingAssets = releaseAssets.filter(
    (asset) => asset?.url === platform.url && asset?.id === assetId,
  );
  if (matchingAssets.length !== 1) {
    throw new Error("latest.json updater URL does not match exactly one release asset");
  }
  const updaterName = matchingAssets[0].name;
  const escapedVersion = expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (typeof updaterName !== "string" || !new RegExp(`^Doflow_${escapedVersion}_x64-setup\\.exe$`, "i").test(updaterName)) {
    throw new Error("windows-x86_64 does not reference the expected NSIS updater asset");
  }
  if (!names.includes(updaterName)) throw new Error("latest.json references a missing updater artifact");
  const nsisName = names.find((name) => /setup\.exe$/i.test(name));
  const msiName = names.find((name) => /\.msi$/i.test(name));
  if (!nsisName) throw new Error("NSIS installer is missing");
  if (!msiName) throw new Error("MSI installer is missing");
  const updaterSignatureName = `${updaterName}.sig`;
  if (!names.includes(updaterSignatureName)) throw new Error("Updater signature file is missing");
  if (!names.includes(`${msiName}.sig`)) throw new Error("MSI updater signature file is missing");
  const localSignature = withoutTerminalNewlines(
    readFileSync(resolve(directory, updaterSignatureName), "utf8"),
  );
  if (localSignature !== manifestSignature) {
    throw new Error("latest.json updater signature does not match the downloaded signature asset");
  }

  const metadataNames = new Set();
  for (const asset of releaseAssets) {
    if (
      !asset ||
      !Number.isSafeInteger(asset.id) ||
      asset.id <= 0 ||
      typeof asset.name !== "string" ||
      asset.name.length === 0 ||
      basename(asset.name) !== asset.name ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      typeof asset.url !== "string"
    ) {
      throw new Error("GitHub release asset metadata contains an invalid asset");
    }
    if (parseReleaseAssetUrl(asset.url).assetId !== asset.id) {
      throw new Error("GitHub release asset metadata URL and ID do not match");
    }
    if (metadataNames.has(asset.name)) throw new Error("GitHub release asset metadata has duplicate names");
    metadataNames.add(asset.name);
    const localPath = resolve(directory, asset.name);
    if (!existsSync(localPath)) throw new Error(`Release asset was not downloaded: ${asset.name}`);
    const localSize = statSync(localPath).size;
    if (localSize <= 0 || localSize !== asset.size) {
      throw new Error(`Release asset size mismatch: ${asset.name}`);
    }
  }
  for (const name of names) {
    if (!metadataNames.has(name)) throw new Error(`Downloaded asset has no GitHub metadata: ${name}`);
  }
  return { assetId, manifest, updaterName };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const [, , directory, expectedVersion, releaseAssetsPath] = process.argv;
  if (!directory || !expectedVersion || !releaseAssetsPath) {
    throw new Error("Usage: validate-release-assets.mjs <directory> <version> <release-assets-metadata>");
  }
  const releaseAssets = JSON.parse(readFileSync(resolve(releaseAssetsPath), "utf8"));
  validateReleaseAssets(resolve(directory), expectedVersion, releaseAssets);
  process.stdout.write("Desktop release artifacts validated\n");
}
