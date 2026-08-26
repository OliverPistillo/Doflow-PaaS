"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import type { JsonObject, SiteConfig, ThemeImageMode } from "@/lib/tenant-site-proposals-api";

const modes: Array<{ value: ThemeImageMode; label: string }> = [{ value: "theme", label: "Usa immagini del tema" }, { value: "website", label: "Usa immagini del sito" }, { value: "hybrid", label: "Modalità ibrida" }, { value: "manual", label: "Solo immagini manuali" }];
const sourceLabels: Record<string, string> = { "theme-package": "Tema", manual: "Manuale", website: "Sito", catalog: "Catalogo", catalog_fallback: "Catalogo", stock_local: "Tema" };

export function SiteProposalImages({ config, imageMode, disabled, onConfigChange, onModeChange, onReset }: { config: SiteConfig; imageMode: ThemeImageMode; disabled?: boolean; onConfigChange: (value: SiteConfig) => void; onModeChange: (mode: ThemeImageMode) => void; onReset: (slot?: "hero" | "consultation" | "feature") => void }) {
  const images = (config.images || {}) as Record<string, JsonObject>; const [values, setValues] = useState<Record<string, string>>({});
  const replace = (slot: string) => { const src = (values[slot] || "").trim(); if (!/^https:\/\/[^\s]+$/i.test(src)) return; onConfigChange({ ...config, images: { ...images, [slot]: { ...(images[slot] || {}), src, sourceMethod: "manual" } } }); };
  return <CommercialSectionCard title="Immagini della proposta">
    <div className="mb-4 flex flex-wrap items-center gap-3"><Select value={imageMode} disabled={disabled} onValueChange={(value) => onModeChange(value as ThemeImageMode)}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{modes.map((mode) => <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" disabled={disabled} onClick={() => onReset()}>Applica immagini del tema a tutti gli slot</Button></div>
    <p className="mb-4 text-xs text-muted-foreground">Il cambio modalità invalida la readiness. Le immagini verranno rivalutate soltanto dopo la conferma di “Rigenera proposta completa”.</p>
    <div className="grid gap-3 lg:grid-cols-3">{(["hero","consultation","feature"] as const).map((slot) => { const image = images[slot] || {}; const method = String(image.sourceMethod || ""); return <div key={slot} className="rounded-xl border border-border p-3"><div className="mb-2 flex items-center justify-between"><strong className="capitalize text-foreground">{slot}</strong><Badge variant="outline">{sourceLabels[method] || method || "Tema"}</Badge></div>{typeof image.src === "string" && image.src ? <div className="mb-3 h-24 overflow-hidden rounded bg-muted"><Image unoptimized width={640} height={96} src={image.src} alt={String(image.alt || slot)} className="h-full w-full object-cover" referrerPolicy="no-referrer" /></div> : null}<div className="flex gap-2"><Input value={values[slot] || ""} onChange={(event) => setValues((current) => ({ ...current, [slot]: event.target.value }))} placeholder="https://…" disabled={disabled} /><Button type="button" size="sm" disabled={disabled} onClick={() => replace(slot)}>Sostituisci</Button></div><Button type="button" className="mt-2" size="sm" variant="ghost" disabled={disabled} onClick={() => onReset(slot)}>Ripristina immagine del tema</Button></div>; })}</div>
  </CommercialSectionCard>;
}
