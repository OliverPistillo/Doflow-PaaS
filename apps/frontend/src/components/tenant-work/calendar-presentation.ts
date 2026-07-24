import type { CalendarEvent } from "@/lib/tenant-calendar-api";

export type CalendarTone = "violet" | "blue" | "orange" | "green";

export function calendarTone(event: Pick<CalendarEvent, "event_type" | "source_entity_type">): CalendarTone {
  const type = String(event.event_type || "");
  if (["meeting", "call", "internal", "focus_time"].includes(type)) return "violet";
  if (type === "task_due" || event.source_entity_type === "task") return "blue";
  if (type === "milestone_due" || type === "project_deadline" || event.source_entity_type === "milestone") return "orange";
  return "green";
}

export function calendarTypeLabel(event: Pick<CalendarEvent, "event_type" | "source_entity_type">) {
  const type = String(event.event_type || "");
  if (["meeting", "call", "internal", "focus_time"].includes(type)) return "Riunione";
  if (type === "task_due" || event.source_entity_type === "task") return "Attività";
  if (type === "milestone_due" || type === "project_deadline" || event.source_entity_type === "milestone") return "Milestone";
  return "Consegna";
}

export const calendarToneClasses: Record<CalendarTone, { surface: string; dot: string; text: string }> = {
  violet: { surface: "border-violet-200 bg-violet-50 text-violet-950", dot: "bg-violet-500", text: "text-violet-600" },
  blue: { surface: "border-blue-200 bg-blue-50 text-blue-950", dot: "bg-blue-500", text: "text-blue-600" },
  orange: { surface: "border-orange-200 bg-orange-50 text-orange-950", dot: "bg-orange-500", text: "text-orange-600" },
  green: { surface: "border-emerald-200 bg-emerald-50 text-emerald-950", dot: "bg-emerald-500", text: "text-emerald-600" },
};
