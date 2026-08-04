"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Loader2, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CommercialEmptyState, CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import { fetchSiteProposalPreviewHtml } from "@/lib/tenant-site-proposals-api";
import { getErrorMessage } from "./site-proposal-utils";

type Viewport = "mobile" | "tablet" | "desktop";
const dimensions: Record<Viewport, { width: number; height: number; label: string }> = { mobile: { width: 390, height: 844, label: "Mobile 390 × 844" }, tablet: { width: 768, height: 1024, label: "Tablet 768 × 1024" }, desktop: { width: 1440, height: 900, label: "Desktop 1440 × 900" } };

function PreviewFrame({ html, viewport }: { html: string; viewport: Viewport }) {
  const frame = dimensions[viewport];
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateScale = () => setScale(Math.min(1, Math.max(0.1, (container.clientWidth - 24) / frame.width)));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [frame.width]);

  return <div ref={containerRef} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3"><p className="mb-2 text-xs font-medium text-slate-600">{frame.label}</p><div className="origin-top-left" style={{ width: frame.width, height: frame.height * scale, transform: `scale(${scale})`, transformOrigin: "top left" }}><iframe title={`Anteprima sito ${frame.label}`} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" loading="lazy" className="block border-0 bg-white" style={{ width: frame.width, height: frame.height }} /></div></div>;
}

export function SiteProposalPreview({ id, generationId, comparison = false, onGenerate }: { id: string; generationId?: string; comparison?: boolean; onGenerate?: () => void }) {
  const [html, setHtml] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [viewport, setViewport] = useState<Viewport>("mobile"); const [compare, setCompare] = useState(comparison);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setHtml(await fetchSiteProposalPreviewHtml(id, generationId)); } catch (value) { setError(getErrorMessage(value)); } finally { setLoading(false); } }, [generationId, id]);
  useEffect(() => { void load(); }, [load]);
  if (loading && !html) return <CommercialSectionCard title="Anteprima"><div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Caricamento anteprima…</div></CommercialSectionCard>;
  if (!html) return <CommercialSectionCard title="Anteprima"><CommercialEmptyState><div><p>{error || "Non esiste ancora una generazione disponibile."}</p><Button className="mt-3" onClick={() => onGenerate ? onGenerate() : void load()}><RefreshCw className="mr-2 h-4 w-4" />Genera anteprima</Button></div></CommercialEmptyState></CommercialSectionCard>;
  return <CommercialSectionCard title={compare ? "Confronto Mobile / Desktop" : "Anteprima sito"}><div className="mb-4 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Aggiorna</Button>{!compare ? <><Button size="sm" variant={viewport === "mobile" ? "default" : "outline"} onClick={() => setViewport("mobile")}><Smartphone className="mr-1 h-4 w-4" />Mobile</Button><Button size="sm" variant={viewport === "tablet" ? "default" : "outline"} onClick={() => setViewport("tablet")}><Tablet className="mr-1 h-4 w-4" />Tablet</Button><Button size="sm" variant={viewport === "desktop" ? "default" : "outline"} onClick={() => setViewport("desktop")}><Monitor className="mr-1 h-4 w-4" />Desktop</Button></> : null}<Button size="sm" variant={compare ? "default" : "outline"} onClick={() => setCompare((value) => !value)}><Columns2 className="mr-1 h-4 w-4" />Confronta Mobile/Desktop</Button><span className="ml-auto text-xs text-slate-500">Le modifiche saranno visibili dopo Salva e genera.</span></div>{compare ? <div className="grid gap-4 2xl:grid-cols-2"><PreviewFrame html={html} viewport="mobile" /><PreviewFrame html={html} viewport="desktop" /></div> : <PreviewFrame html={html} viewport={viewport} />}</CommercialSectionCard>;
}
