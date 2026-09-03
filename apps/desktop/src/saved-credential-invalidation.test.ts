import { describe, expect, it } from "vitest";

import { ApiError } from "../../frontend/src/lib/api";
import {
  INVALID_DESKTOP_CREDENTIALS_CODE,
  shouldInvalidateSavedDesktopCredential,
} from "../../frontend/src/lib/desktop-saved-credential-policy";

describe("saved Desktop credential invalidation policy", () => {
  it("invalidates only a typed invalid-credentials response from the password login request", () => {
    expect(shouldInvalidateSavedDesktopCredential(new ApiError(
      "Credenziali non valide",
      401,
      INVALID_DESKTOP_CREDENTIALS_CODE,
      "/auth/login",
    ))).toBe(true);
  });

  it.each([
    ["expired /auth/me session", new ApiError("Sessione scaduta", 401, "SESSION_EXPIRED", "/auth/me")],
    ["generic login 401", new ApiError("Credenziali non valide", 401, undefined, "/auth/login")],
    ["handoff 401", new ApiError("Handoff non valido", 401, "HANDOFF_INVALID", "/auth/handoff/exchange")],
    ["application API 401", new ApiError("Non autenticato", 401, "SESSION_EXPIRED", "/tenant/projects")],
    ["request timeout", new ApiError("Timeout", 408, undefined, "/auth/login")],
    ["rate limit", new ApiError("Troppi tentativi", 429, undefined, "/auth/login")],
    ["server error", new ApiError("Servizio non disponibile", 503, undefined, "/auth/login")],
    ["network error", new TypeError("Failed to fetch")],
    ["MFA pending success payload", { mfa: { required: true, stage: "MFA_PENDING" } }],
    ["MFA setup success payload", { mfa: { required: true, stage: "MFA_SETUP_NEEDED" } }],
  ])("retains the credential for %s", (_case, error) => {
    expect(shouldInvalidateSavedDesktopCredential(error)).toBe(false);
  });
});
