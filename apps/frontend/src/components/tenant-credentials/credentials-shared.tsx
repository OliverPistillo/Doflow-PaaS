"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { badgeClass, label } from "./credentials-utils";

export function CredentialsHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
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

export function CredentialsLoading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento vault...</div>;
}

export function CredentialsError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</div>;
}

export function CredentialsEmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function CredentialBadge({ value, map }: { value?: string | null; map?: Record<string, string> }) {
  return <Badge variant="outline" className={badgeClass(value)}>{label(map || {}, value)}</Badge>;
}

export function SelectField({ value, options, placeholder, onChange }: { value?: string; options: Array<{ value: string; label: string }>; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || "__all__"} onValueChange={(next) => onChange(next === "__all__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}</SelectItem>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">{JSON.stringify(value ?? {}, null, 2)}</pre>;
}

export function MetricCard({ label, value, tone }: { label: string; value: string | number; tone?: "default" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-amber-700" : tone === "success" ? "text-emerald-700" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

