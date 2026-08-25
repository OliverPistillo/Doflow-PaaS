/**
 * Legacy import surface for the session-aware profile cache.
 *
 * This module intentionally contains no JWT parser, token storage or auth
 * authority. The canonical identity is loaded from `/auth/me`; the cache only
 * lets existing synchronous presentation helpers read that filtered profile.
 */

export type PlanTier = "STARTER" | "PRO" | "ENTERPRISE";

export interface DoFlowSessionProfile {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
  tenantId?: string;
  tenantSlug?: string;
  authStage?: string;
  planTier?: PlanTier;
}

let currentProfile: DoFlowSessionProfile | null = null;

export function setDoFlowUser(profile: DoFlowSessionProfile | null) {
  currentProfile = profile ? { ...profile, sub: profile.sub || profile.id } : null;
}

export function clearDoFlowUser() {
  currentProfile = null;
}

export function getDoFlowUser(): DoFlowSessionProfile | null {
  return currentProfile;
}

export function getInitials(email?: string, name?: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  if (email) {
    const local = email.split("@")[0];
    const parts = local.split(/[._-]/);
    return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? "")).toUpperCase();
  }
  return "DF";
}
