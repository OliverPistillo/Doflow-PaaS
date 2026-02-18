/**
 * jwt.ts — Utility condivisa per decodificare il JWT DoFlow dal localStorage.
 * Nessuna dipendenza esterna — usa solo atob nativo.
 */

export type PlanTier = "STARTER" | "PRO" | "ENTERPRISE";

export interface DoFlowJwtPayload {
  sub?:        string;
  email?:      string;
  role?:       string;
  tenantId?:   string;
  tenantSlug?: string;
  authStage?:  string;
  planTier?:   PlanTier;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseJwt(token: string): DoFlowJwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) return null;
    return {
      sub:        typeof parsed.sub        === "string" ? parsed.sub        : undefined,
      email:      typeof parsed.email      === "string" ? parsed.email      : undefined,
      role:       typeof parsed.role       === "string" ? parsed.role       : undefined,
      tenantId:   typeof parsed.tenantId   === "string" ? parsed.tenantId   : undefined,
      tenantSlug: typeof parsed.tenantSlug === "string" ? parsed.tenantSlug : undefined,
      authStage:  typeof parsed.authStage  === "string" ? parsed.authStage  : undefined,
      planTier:   (["STARTER","PRO","ENTERPRISE"].includes(parsed.planTier as string)
                    ? parsed.planTier as PlanTier : "STARTER"),
    };
  } catch {
    return null;
  }
}

/** Legge il token dal localStorage e lo decodifica. Restituisce null se assente o non valido. */
export function getDoFlowUser(): DoFlowJwtPayload | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("doflow_token");
  if (!token) return null;
  return parseJwt(token);
}

/** Iniziali avatar dall'email (es. "mario.rossi@..." → "MR") */
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
