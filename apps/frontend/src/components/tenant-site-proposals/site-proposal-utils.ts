import type { JsonObject, SiteConfig } from "@/lib/tenant-site-proposals-api";
import { getDoFlowUser } from "@/lib/jwt";

export const proposalStatusLabel: Record<string, string> = { draft: "Bozza", ready: "Pronta", generated: "Generata", error: "Errore", archived: "Archiviata" };
export const importStatusLabel: Record<string, string> = { preview: "Anteprima", confirmed: "Confermato", generated: "Generato", partial: "Generato parzialmente", failed: "Errore" };
export const generationStatusLabel: Record<string, string> = { running: "In generazione", completed: "Completata", failed: "Errore" };

export function copyJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
export function formatBytes(value?: string | number | null) { const bytes = Number(value || 0); if (!bytes) return "—"; return `${(bytes / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 0)} ${bytes > 1024 * 1024 ? "MiB" : "KiB"}`; }
export function shortHash(value?: string | null) { return value ? `${value.slice(0, 10)}…` : "—"; }
export function getErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (/401/.test(raw)) return "Sessione scaduta. Accedi nuovamente.";
  if (/403|forbidden/i.test(raw)) return "Non hai i permessi per questa operazione.";
  if (/404|non trovata|non trovato/i.test(raw)) return "Proposta o risorsa non trovata.";
  if (/413/.test(raw)) return "Il CSV supera il limite consentito.";
  if (/422/.test(raw)) return "Controlla i dati evidenziati.";
  if (/429|troppe richieste/i.test(raw)) return "Troppe richieste. Riprova tra poco.";
  if (/sql|stack|s3|token/i.test(raw)) return "Operazione non completata. Riprova o contatta un amministratore.";
  return raw && raw.length < 280 ? raw : "Operazione non completata. Riprova tra poco.";
}
export function hasPermanentProposalDeleteRole() {
  const role = String(getDoFlowUser()?.role || "").trim().toLowerCase();
  return role === "admin" || role === "owner" || role === "superadmin";
}
export function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.style.display = "none"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); }
export function slugify(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
export function normalizePhone(value: string) { const digits = value.replace(/[^\d+]/g, ""); if (!digits) return ""; const normalized = !digits.startsWith("+") && digits.length >= 6 ? `+39${digits}` : digits; return /^\+\d{6,15}$/.test(normalized) ? normalized : ""; }
export function getPath(object: JsonObject, path: string): unknown { return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as JsonObject)[key] : undefined, object); }
export function setPath<T extends JsonObject>(object: T, path: string, value: unknown): T { const next = copyJson(object); const parts = path.split("."); let current: JsonObject = next; parts.slice(0, -1).forEach((part) => { const existing = current[part]; current[part] = existing && typeof existing === "object" && !Array.isArray(existing) ? existing as JsonObject : {}; current = current[part] as JsonObject; }); current[parts[parts.length - 1]] = value; return next; }
export function textLimit(config: SiteConfig, path: string) { return Number(config.textLimits?.[path] || 0); }
export function hasUnsafePrototype(value: unknown): boolean { if (!value || typeof value !== "object") return false; if (Array.isArray(value)) return value.some(hasUnsafePrototype); return Object.entries(value as JsonObject).some(([key, child]) => ["__proto__", "prototype", "constructor"].includes(key) || hasUnsafePrototype(child)); }
export function isSafeRoute(value: string) { return value.startsWith("#") || (!/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("/") && !value.includes("..") && !value.includes("\\") && !value.includes("?") && !/[{}]/.test(value.replaceAll("{citySlug}", ""))); }
export const csvHeaders = ["business_name", "professional_title", "descriptor", "category", "city", "website_url", "email", "phone", "address", "opening_hours", "services", "brands", "notes", "lead_priority", "overview", "target_audience", "primary_goal", "tone_of_voice", "primary_color", "secondary_color", "accent_color", "background_color", "logo_url", "hero_image_url", "consultation_image_url", "products_image_url", "palette_json", "images_json", "reviews_json", "faqs_json", "treatment_cards_json", "product_points_json", "routes_json"];
export function downloadCsvTemplate() { const example = ["Studio Esempio", "Dott.ssa", "Medicina estetica", "Wellness", "Roma", "https://example.it", "info@example.it", "+39 000 000 0000", "Via Esempio 1", "Su appuntamento", "Consulenza;Trattamento viso;Trattamento corpo", "", "Dati da verificare", "media", "Presentazione dello studio", "Persone interessate al benessere", "Richieste di consulenza", "Professionale e chiaro", "#AD8147", "#28241F", "#8D6536", "#FBF9F5", "", "", "", "", "", "", "", "", "", "", ""];
  downloadBlob(new Blob([`\uFEFF${csvHeaders.join(";")}\r\n${example.join(";")}\r\n`], { type: "text/csv;charset=utf-8" }), "modello-proposte-web-doflow.csv");
}
