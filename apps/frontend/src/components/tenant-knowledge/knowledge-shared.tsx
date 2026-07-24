"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDoFlowUser } from "@/lib/jwt";
import { knowledgeApi, type KnowledgeOptions } from "@/lib/tenant-knowledge-api";
import { badgeClass, canViewFinance, labelFor } from "./knowledge-utils";

export type Query = Record<string, string>;
export type ListPayload<T> = T[] | { items?: T[]; total?: number };

export const DEFAULT_OPTIONS: KnowledgeOptions = {
  article_types: ["article", "procedure", "checklist", "guide", "policy", "note", "faq", "troubleshooting", "playbook"],
  asset_types: ["document", "image", "video", "link", "brand_asset", "technical", "generic"],
  content_formats: ["markdown", "text"],
  entity_types: ["company", "contact", "lead", "opportunity", "project", "task", "quote", "contract", "paperwork_dossier", "document"],
  priorities: ["low", "medium", "high", "urgent"],
  relation_types: ["related", "source", "reference", "procedure", "asset"],
  statuses: ["draft", "published", "active", "archived"],
  template_types: ["generic", "checklist", "procedure", "brief", "handoff", "qa", "operations"],
  visibilities: ["private", "team", "admin"],
};

export function itemsOf<T>(payload?: ListPayload<T> | null): T[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : payload.items || [];
}

export function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Errore sconosciuto");
  if (message.includes("403")) return "Non hai permessi per questa operazione.";
  if (message.includes("404")) return "Elemento non trovato.";
  return message;
}

export function Header({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function StatusBadge({ value, map }: { value?: string | null; map?: Record<string, string> }) {
  return <Badge variant="outline" className={badgeClass(value)}>{labelFor(map || {}, value)}</Badge>;
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">{JSON.stringify(value ?? {}, null, 2)}</pre>;
}

export function useKnowledgeOptions() {
  const [options, setOptions] = useState<KnowledgeOptions>(DEFAULT_OPTIONS);
  useEffect(() => {
    knowledgeApi.getKnowledgeOptions().then((value) => setOptions({ ...DEFAULT_OPTIONS, ...value })).catch(() => undefined);
  }, []);
  return options;
}

export function useKnowledgeRole() {
  const user = getDoFlowUser();
  const role = String(user?.role || "user").toLowerCase();
  return {
    role,
    canViewFinance: canViewFinance(role),
    canManage: ["owner", "admin", "superadmin", "super_admin", "manager"].includes(role),
    isExecutive: ["owner", "admin", "superadmin", "super_admin"].includes(role),
  };
}

export function FiltersBar({ filters, onChange, children }: { filters: Query; onChange: (next: Query) => void; children?: ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
        <Input placeholder="Cerca" value={filters.search || ""} onChange={(event) => onChange({ ...filters, search: event.target.value })} />
        {children}
        <Button variant="outline" onClick={() => onChange({})}>Reset filtri</Button>
      </CardContent>
    </Card>
  );
}

export function SelectFilter({ value, onChange, placeholder, values }: { value?: string; onChange: (value: string) => void; placeholder: string; values?: string[] }) {
  return (
    <Select value={value || "__all__"} onValueChange={(next) => onChange(next === "__all__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Tutti</SelectItem>
        {(values || []).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
