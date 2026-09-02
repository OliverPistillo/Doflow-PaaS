import { describe, expect, it } from "vitest";
import { resolveDesktopSurface } from "./window-routing";

describe("Desktop Calls window routing", () => {
  it("routes authorized incoming and active labels to their local renderers", () => {
    expect(resolveDesktopSurface(true, "incoming-22222222-2222-4222-8222-222222222222")).toBe("incoming");
    expect(resolveDesktopSurface(true, "call-11111111-1111-4111-8111-111111111111")).toBe("call");
  });

  it("keeps non-native and unrelated labels on the bootstrap surface", () => {
    expect(resolveDesktopSurface(false, "incoming-22222222-2222-4222-8222-222222222222")).toBe("bootstrap");
    expect(resolveDesktopSurface(true, "remote-profile")).toBe("bootstrap");
  });
});
