"use client";

import { getDoFlowUser } from "@/lib/jwt";
import type { CredentialSecretPayload } from "@/lib/tenant-credentials-types";

export const KIND_LABELS: Record<string, string> = {
  hosting: "Hosting",
  wordpress: "WordPress",
  server: "Server",
  dns: "DNS",
  domain_registrar: "Registrar dominio",
  email: "Email",
  social: "Social",
  analytics: "Analytics",
  marketing: "Marketing",
  api_key: "API key",
  database: "Database",
  cloud: "Cloud",
  repository: "Repository",
  payment_provider: "Provider pagamenti",
  other: "Altro",
};

export const ENVIRONMENT_LABELS: Record<string, string> = {
  production: "Produzione",
  staging: "Staging",
  development: "Sviluppo",
  test: "Test",
  internal: "Interno",
  other: "Altro",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Attiva",
  expiring: "In scadenza",
  expired: "Scaduta",
  rotation_due: "Rotazione richiesta",
  revoked: "Revocata",
  archived: "Archiviata",
};

export const ACCESS_SCOPE_LABELS: Record<string, string> = {
  admin_only: "Solo amministratori",
  restricted: "Accesso limitato",
};

export const ENTITY_TYPES = ["company", "contact", "lead", "opportunity", "briefing", "quote", "contract", "paperwork_dossier", "project", "task", "document", "recurring_service", "renewal", "domain"];
export const RELATIONS = ["belongs_to", "grants_access_to", "manages", "related_to", "primary_for"];

export const SECRET_FIELD_LABELS: Record<keyof CredentialSecretPayload | "customFields", string> = {
  username: "Username",
  password: "Password",
  apiKey: "API key",
  secretKey: "Secret key",
  token: "Token",
  recoveryCodes: "Recovery codes",
  privateNotes: "Note private",
  customFields: "Campi custom",
};

export function label(map: Record<string, string>, value?: string | null) {
  if (!value) return "-";
  return map[value] || value;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function toDateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

export function badgeClass(value?: string | null) {
  if (value === "active" || value === "production") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (value === "expiring" || value === "rotation_due" || value === "staging") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  if (value === "expired" || value === "revoked") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (value === "archived") return "border-muted-foreground/20 bg-muted text-muted-foreground";
  return "";
}

export function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Errore sconosciuto");
  const lower = message.toLowerCase();
  if (lower.includes("429") || lower.includes("traffic control") || lower.includes("troppe richieste")) return "Troppi tentativi. Attendi un minuto e riprova.";
  if (lower.includes("403") || lower.includes("forbidden") || lower.includes("permess")) return "Operazione non consentita.";
  if (lower.includes("404")) return "La credenziale non è disponibile o non hai accesso.";
  if (lower.includes("decifr") || lower.includes("decrypt")) return "Non è stato possibile decifrare la credenziale. Contatta un amministratore.";
  return message;
}

export function canManageCredentials() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin", "manager"].includes(role);
}

export function canAdminCredentials() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin"].includes(role);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

const SECRET_REASON_RE = /(password\s*[:=]|token\s*[:=]|api[_-]?key\s*[:=]|secret[_-]?key\s*[:=]|authorization\s*:|bearer\s+[a-z0-9._-]+|-----BEGIN\s+.*PRIVATE\s+KEY-----|^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$)/i;

export function validateReason(reason: string) {
  const clean = reason.trim();
  if (clean.length < 5) return "Il motivo deve contenere almeno 5 caratteri.";
  if (clean.length > 500) return "Il motivo non può superare 500 caratteri.";
  if (clean.startsWith("{") || clean.startsWith("[")) return "Il motivo deve essere testo semplice.";
  if (SECRET_REASON_RE.test(clean)) return "Il motivo non deve contenere password, token o altri segreti.";
  return null;
}

export function sanitizeMetadataText(value: string) {
  return value.trim() ? value.trim() : undefined;
}

export function compactJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parseJsonObject(text: string, field = "JSON") {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${field} deve essere un oggetto JSON.`);
  return parsed as Record<string, unknown>;
}

export function hasUsableSecret(payload: CredentialSecretPayload) {
  return Boolean(
    payload.username?.trim() ||
    payload.password?.trim() ||
    payload.apiKey?.trim() ||
    payload.secretKey?.trim() ||
    payload.token?.trim() ||
    payload.privateNotes?.trim() ||
    (payload.recoveryCodes || []).some((item) => item.trim()) ||
    (payload.customFields || []).some((item) => item.label.trim() || item.value.trim()),
  );
}

export function cleanSecretPayload(payload: CredentialSecretPayload): CredentialSecretPayload {
  return {
    username: payload.username?.trim() || undefined,
    password: payload.password || undefined,
    apiKey: payload.apiKey || undefined,
    secretKey: payload.secretKey || undefined,
    token: payload.token || undefined,
    recoveryCodes: (payload.recoveryCodes || []).map((item) => item.trim()).filter(Boolean).slice(0, 50),
    privateNotes: payload.privateNotes || undefined,
    customFields: (payload.customFields || [])
      .filter((item) => item.label.trim() || item.value.trim())
      .slice(0, 50)
      .map((item) => ({ label: item.label.trim(), value: item.value, secret: Boolean(item.secret) })),
  };
}

export function assertMetadataOnlyExport(payload: Record<string, unknown>) {
  if (payload.secrets_included !== false) {
    throw new Error("Export bloccato: il backend non ha confermato secrets_included=false.");
  }
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  link.click();
  URL.revokeObjectURL(url);
}
