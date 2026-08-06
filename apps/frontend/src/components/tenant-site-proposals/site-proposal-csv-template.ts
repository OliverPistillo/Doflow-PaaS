export const csvTemplateHeaders = [
  "business_name", "professional_title", "descriptor", "category", "city", "website_url", "email", "phone", "address", "opening_hours", "services", "brands", "notes", "lead_priority", "overview", "target_audience", "primary_goal", "tone_of_voice", "primary_color", "secondary_color", "accent_color", "background_color", "logo_url", "hero_image_url", "consultation_image_url", "products_image_url", "palette_json", "images_json", "reviews_json", "faqs_json", "treatment_cards_json", "product_points_json", "routes_json",
] as const;

export const csvTemplateExample = [
  "Studio Esempio", "Dott.ssa", "Medicina estetica", "Wellness", "Roma", "https://example.it", "info@example.it", "+39 000 000 0000", "Via Esempio 1", "Su appuntamento", "Consulenza;Trattamento viso;Trattamento corpo", "", "Dati da verificare", "media", "Presentazione dello studio", "Persone interessate al benessere", "Richieste di consulenza", "Professionale e chiaro", "#AD8147", "#28241F", "#8D6536", "#FBF9F5", "", "", "", "", "", "", "", "", "", "", "",
] as const;

export function escapeCsvCell(value: unknown, delimiter = ";"): string {
  const cell = String(value ?? "");
  const escaped = cell.replace(/"/g, '""');
  return cell.includes(delimiter) || /["\r\n]/.test(cell) ? `"${escaped}"` : escaped;
}

export function serializeCsvRows(rows: readonly (readonly unknown[])[], delimiter = ";", withBom = true): string {
  const width = rows[0]?.length ?? 0;
  if (rows.some((row) => row.length !== width)) throw new Error("Le righe CSV devono avere lo stesso numero di colonne.");
  const body = rows.map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter)).join("\r\n");
  return `${withBom ? "\uFEFF" : ""}${body}\r\n`;
}

export function buildSiteProposalCsvTemplate(): string {
  return serializeCsvRows([csvTemplateHeaders, csvTemplateExample]);
}
