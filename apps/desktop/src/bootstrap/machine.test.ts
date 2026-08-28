import { describe, expect, it } from "vitest";
import { bootstrapReducer, initialBootstrapState, resolveStartupProfile } from "./machine";
import type { DesktopUpdateState, ProfileRegistry } from "../types";
import type { BootstrapState } from "./machine";

const noUpdate: DesktopUpdateState = {
  kind: "none",
  currentVersion: "1.0.0",
  policySource: "network",
  updateAvailable: false,
};
const registry: ProfileRegistry = { version: 1, profiles: [] };

describe("desktop bootstrap state machine", () => {
  it("attende sia animazione sia bootstrap reale", () => {
    let state = bootstrapReducer(initialBootstrapState, { type: "START" });
    state = bootstrapReducer(state, { type: "PROFILES_LOADED", registry });
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: noUpdate });
    state = bootstrapReducer(state, { type: "PROFILE_PREPARED", profileId: "p1" });
    state = bootstrapReducer(state, { type: "REMOTE_READY", remote: { profileId: "p1", state: "needs-auth" } });
    expect(state.phase).not.toBe("ready");
    state = bootstrapReducer(state, { type: "ANIMATION_FINISHED" });
    expect(state.phase).toBe("ready");
  });

  it("attende remote readiness quando l'animazione finisce per prima", () => {
    let state = bootstrapReducer(initialBootstrapState, { type: "START" });
    state = bootstrapReducer(state, { type: "ANIMATION_FINISHED" });
    state = bootstrapReducer(state, { type: "PROFILES_LOADED", registry });
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: noUpdate });
    state = bootstrapReducer(state, { type: "PROFILE_PREPARED", profileId: "p1" });
    expect(state.phase).toBe("preparing-profile");
    state = bootstrapReducer(state, { type: "REMOTE_READY", remote: { profileId: "p1", state: "authenticated" } });
    expect(state.phase).toBe("ready");
  });

  it.each(["optional", "none", "unavailable"] as const)("non blocca l'avvio per update %s", (kind) => {
    let state: BootstrapState = { ...initialBootstrapState, phase: "bootstrapping", animationFinished: true, registry, preparedProfileId: "p1", remote: { profileId: "p1", state: "authenticated" } };
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: { ...noUpdate, kind } });
    expect(state.phase).toBe("ready");
  });

  it("blocca una versione sotto la minimum supported", () => {
    let state: BootstrapState = { ...initialBootstrapState, phase: "bootstrapping", animationFinished: true, registry };
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: { ...noUpdate, kind: "mandatory", updateAvailable: true } });
    expect(state.phase).toBe("mandatory-update");
  });

  it("gestisce nessuno, uno e più profili con last used valido o mancante", () => {
    const profile = { id: "a", userId: "u", name: "A", email: "a@example.test", createdAt: "2026-01-01", lastUsedAt: "2026-01-01", webviewContextId: "a" };
    expect(resolveStartupProfile(registry)).toBeUndefined();
    expect(resolveStartupProfile({ version: 1, profiles: [profile], lastUsedProfileId: "a" })).toEqual(profile);
    expect(resolveStartupProfile({ version: 1, profiles: [profile], lastUsedProfileId: "missing" })).toBeUndefined();
  });

  it("mostra il re-login del profilo scaduto senza considerarlo autenticato", () => {
    const profile = { id: "a", userId: "u", name: "A", email: "a@example.test", createdAt: "2026-01-01", lastUsedAt: "2026-01-01", webviewContextId: "a" };
    let state: BootstrapState = { ...initialBootstrapState, phase: "preparing-profile", animationFinished: true, registry: { version: 1 as const, profiles: [profile] }, update: noUpdate, selectedProfile: profile, preparedProfileId: "a" };
    state = bootstrapReducer(state, { type: "REMOTE_READY", remote: { profileId: "a", state: "needs-auth" } });
    expect(state.phase).toBe("expired-profile");
  });
});
