export type DesktopSurface = "incoming" | "call" | "bootstrap";

export function resolveDesktopSurface(native: boolean, label: string): DesktopSurface {
  if (native && label.startsWith("incoming-")) return "incoming";
  if (native && label.startsWith("call-")) return "call";
  return "bootstrap";
}
