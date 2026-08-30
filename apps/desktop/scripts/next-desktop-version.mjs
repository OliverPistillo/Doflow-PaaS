import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";
import semver from "semver";

export function nextDesktopVersion(tags, sourceVersion = "1.0.0") {
  const source = semver.valid(sourceVersion);
  if (!source) throw new Error("Desktop source version is not valid SemVer");
  const versions = tags
    .map((tag) => /^desktop-v(.+)$/.exec(tag.trim()))
    .filter(Boolean)
    .map((match) => semver.valid(match[1]))
    .filter(Boolean)
    .sort(semver.rcompare);

  if (versions.length === 0) return source;
  const nextPublishedPatch = semver.inc(versions[0], "patch");
  if (!nextPublishedPatch) throw new Error("Unable to compute the next Desktop SemVer");
  return semver.gt(source, nextPublishedPatch) ? source : nextPublishedPatch;
}

export function sourceDesktopVersion() {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
  return String(manifest.version || "");
}

export function localDesktopTags() {
  return execFileSync("git", ["tag", "--list", "desktop-v*"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const version = nextDesktopVersion(localDesktopTags(), sourceDesktopVersion());
  const tag = `desktop-v${version}`;
  process.stdout.write(`${version}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\n`);
  }
}
