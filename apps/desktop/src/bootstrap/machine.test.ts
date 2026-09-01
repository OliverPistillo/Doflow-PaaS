import { describe, expect, it } from "vitest";
import { bootstrapReducer, initialBootstrapState, resolveStartupProfile } from "./machine";
import type { DesktopUpdateState, ProfileRegistry } from "../types";
import type { BootstrapState } from "./machine";

const noUpdate: DesktopUpdateState = {
  kind: "none",
  currentVersion: "1.0.0",
  policySource: "network",
  updateAvailable: false,
  canContinueWithoutUpdate: true,
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

  it("non blocca l'avvio quando non esiste un update", () => {
    let state: BootstrapState = { ...initialBootstrapState, phase: "bootstrapping", animationFinished: true, registry, preparedProfileId: "p1", remote: { profileId: "p1", state: "authenticated" } };
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: noUpdate });
    expect(state.phase).toBe("ready");
  });

  it.each(["optional", "mandatory"] as const)("blocca e installa prima del profilo un update %s", (kind) => {
    let state: BootstrapState = { ...initialBootstrapState, phase: "bootstrapping", animationFinished: true, registry };
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: { ...noUpdate, kind, updateAvailable: true } });
    expect(state.phase).toBe("updating");
  });

  it("consente il fallback solo quando la policy conferma che la versione è supportata", () => {
    let state: BootstrapState = { ...initialBootstrapState, phase: "bootstrapping", animationFinished: true };
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: { ...noUpdate, kind: "unavailable" } });
    expect(state.phase).toBe("update-blocked");
    state = bootstrapReducer(state, { type: "CONTINUE_WITHOUT_UPDATE" });
    expect(state.phase).toBe("bootstrapping");

    state = bootstrapReducer(initialBootstrapState, { type: "ANIMATION_FINISHED" });
    state = bootstrapReducer(state, { type: "UPDATE_RESOLVED", update: { ...noUpdate, kind: "mandatory", updateAvailable: false, canContinueWithoutUpdate: false } });
    expect(state.phase).toBe("update-blocked");
    expect(bootstrapReducer(state, { type: "CONTINUE_WITHOUT_UPDATE" })).toEqual(state);
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
