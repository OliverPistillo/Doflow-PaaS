import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));
const assetPath = fileURLToPath(new URL("./assets/doflow-logo.svg", import.meta.url));
const cssPath = fileURLToPath(new URL("./styles.css", import.meta.url));
const splashPath = fileURLToPath(new URL("./components/Splash.tsx", import.meta.url));

describe("official Doflow splash asset", () => {
  it("uses the canonical vector geometry as the only wordmark mask", () => {
    const asset = readFileSync(assetPath, "utf8");
    const css = readFileSync(cssPath, "utf8");
    const splash = readFileSync(splashPath, "utf8");

    expect(asset).toContain('viewBox="0 0 280.23 55.99"');
    expect(asset).toMatch(/<path\s+d="[^"]+"/);
    expect(css).toContain('url("./assets/doflow-logo.svg")');
    expect(css).toContain("aspect-ratio: 280.23 / 55.99");
    expect(splash).not.toMatch(/<text\b/i);
    expect(splash).not.toMatch(/>\s*doflow\s*</i);
    expect(existsSync(`${sourceRoot}/../public/doflow-logo.svg`)).toBe(false);
  });
});
