export type PublicLeadIntakeFormData = {
  formVersion: string | null;
  projectType: string | null;
  goals: string[];
  timeline: string | null;
  province: string | null;
};

export function intakeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function intakeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseIntakeFormData(value: unknown): PublicLeadIntakeFormData {
  const data = intakeRecord(value);
  return {
    formVersion: intakeText(data?.form_version),
    projectType: intakeText(data?.project_type),
    goals: Array.isArray(data?.goals)
      ? data.goals.map(intakeText).filter((goal): goal is string => Boolean(goal))
      : [],
    timeline: intakeText(data?.timeline),
    province: intakeText(data?.province),
  };
}

export function intakeAttributionLabel(value: unknown): string | null {
  const attribution = intakeRecord(value);
  const source = intakeText(attribution?.utm_source);
  const medium = intakeText(attribution?.utm_medium);
  if (source) return [source, medium].filter(Boolean).join(" / ");
  if (intakeText(attribution?.gclid)) return "Google Ads";
  if (intakeText(attribution?.fbclid)) return "Meta Ads";
  if (intakeText(attribution?.ttclid)) return "TikTok Ads";
  return null;
}

const COMPACT_GOALS: Record<string, string> = {
  "Ricevere più contatti": "Più contatti",
  "Vendere online": "Vendita online",
  "Rafforzare il brand": "Brand",
  "Lanciare un nuovo progetto": "Nuovo progetto",
};

export function compactIntakeGoal(goal: string): string {
  return COMPACT_GOALS[goal] || goal;
}

export function briefingTypeForProject(projectType: string | null | undefined): string {
  if (projectType === "E-commerce") return "ecommerce";
  if (projectType === "Sito vetrina" || projectType === "Landing page") return "website";
  return "other";
}
