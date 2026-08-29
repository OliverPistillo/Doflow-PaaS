import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));
const assetPath = fileURLToPath(new URL("./assets/doflow-logo.svg", import.meta.url));
const cssPath = fileURLToPath(new URL("./styles.css", import.meta.url));
const splashPath = fileURLToPath(new URL("./components/Splash.tsx", import.meta.url));

describe("official Doflow splash asset", () => {
  it("uses one stationary wordmark with a separately moving light band", () => {
    const asset = readFileSync(assetPath, "utf8");
    const css = readFileSync(cssPath, "utf8");
    const splash = readFileSync(splashPath, "utf8");

    expect(asset).toContain('viewBox="0 0 280.23 55.99"');
    expect(asset).toMatch(/<path\s+d="[^"]+"/);
    expect(css).toContain('url("./assets/doflow-logo.svg")');
    expect(css).toContain("aspect-ratio: 280.23 / 55.99");
    expect(splash).not.toMatch(/<text\b/i);
    expect(splash).not.toMatch(/>\s*doflow\s*</i);
    expect(splash).not.toContain("splash-logo-ghost");
    expect(css).not.toContain(".splash-logo-ghost");
    expect(splash.match(/className="splash-logo splash-logo-reveal"/g)).toHaveLength(1);
    expect(splash).toContain('className="splash-sweep-mask"');
    expect(splash).toContain('className="splash-sweep-band"');
    expect(splash).not.toContain('className="splash-logo splash-sweep"');
    expect(splash).toContain('.to(".splash-sweep-band", { xPercent: 500');
    expect(splash).not.toMatch(/\.(?:set|to|fromTo)\("\.splash-sweep-mask"/);

    const sweepMaskCss = css.match(/\.splash-sweep-mask\s*\{[^}]+\}/)?.[0] ?? "";
    const sweepBandCss = css.match(/\.splash-sweep-band\s*\{[^}]+\}/)?.[0] ?? "";
    expect(sweepMaskCss).toContain('mask: url("./assets/doflow-logo.svg")');
    expect(sweepBandCss).not.toContain("mask:");
    expect(sweepBandCss).toContain("width: 26%");
    expect(existsSync(`${sourceRoot}/../public/doflow-logo.svg`)).toBe(false);
  });
});
