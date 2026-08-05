import type { ProposalTheme } from "@/lib/tenant-site-proposals-api";

export type ThemeRecommendation = { key: string; reason: string; score: number } | null;

function terms(theme: ProposalTheme): string[] {
  const manifest = theme.manifest && typeof theme.manifest === "object" ? theme.manifest : {};
  const tags = Array.isArray(manifest.recommendationTags) ? manifest.recommendationTags : [];
  return [...tags, ...(theme.categories || [])].filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function recommendProposalTheme(themes: ProposalTheme[], input: Record<string, string>): ThemeRecommendation {
  const haystack = normalize([input.category, input.descriptor, input.services].filter(Boolean).join(" "));
  if (!haystack.trim()) return null;
  const scored = themes.map((theme) => {
    const matches = terms(theme).filter((tag) => haystack.includes(normalize(tag)) || normalize(tag).split(/\s+/).filter((part) => part.length > 4).some((part) => haystack.includes(part)));
    return { key: `${theme.slug}@${theme.version}`, score: matches.length, matches };
  }).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  if (!scored[0]?.score || scored[0].score === scored[1]?.score) return null;
  return { key: scored[0].key, score: scored[0].score, reason: `Coerente con: ${scored[0].matches.slice(0, 3).join(", ")}` };
}
