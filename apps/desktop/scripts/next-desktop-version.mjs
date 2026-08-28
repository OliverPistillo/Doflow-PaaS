import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import process from "node:process";
import semver from "semver";

export function nextDesktopVersion(tags) {
  const versions = tags
    .map((tag) => /^desktop-v(.+)$/.exec(tag.trim()))
    .filter(Boolean)
    .map((match) => semver.valid(match[1]))
    .filter(Boolean)
    .sort(semver.rcompare);

  return versions.length === 0 ? "1.0.0" : semver.inc(versions[0], "patch");
}

export function localDesktopTags() {
  return execFileSync("git", ["tag", "--list", "desktop-v*"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const version = nextDesktopVersion(localDesktopTags());
  const tag = `desktop-v${version}`;
  process.stdout.write(`${version}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\n`);
  }
}
