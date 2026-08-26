"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CommercialPageHeader, CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { createSiteProposal, fetchProposalThemePreview, listProposalThemes, previewImport, type ProposalTheme } from "@/lib/tenant-site-proposals-api";
import { downloadCsvTemplate, getErrorMessage } from "./site-proposal-utils";
import { recommendProposalTheme } from "./site-proposal-theme-recommendation";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const sourceFields = [
  ["business_name", "Nome attività", true], ["professional_title", "Qualifica"], ["descriptor", "Descrittore"],
  ["category", "Categoria"], ["city", "Città"], ["website_url", "Sito attuale"], ["email", "Email"],
  ["phone", "Telefono"], ["address", "Indirizzo"], ["services", "Servizi"], ["overview", "Panoramica"],
  ["target_audience", "Pubblico"], ["primary_goal", "Obiettivo"], ["tone_of_voice", "Tono di voce"], ["notes", "Note"],
] as const;

export function SiteProposalNew() {
  const router = useRouter();
  const { hasCapability } = useDoflowIdentity();
  const canUseBuilder = hasCapability("canUseBuilder");
  const [templates, setTemplates] = useState<ProposalTheme[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<Record<string, string>>({ business_name: "" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    listProposalThemes()
      .then((items) => {
        if (!active) return;
        const activeItems = items.filter((item) => item.is_active && item.status === "active");
        const selectable = activeItems.filter((item) => item.runtime_adapter_status === "ready");
        setTemplates(activeItems);
        const preferred = selectable.find((item) => item.default_version === item.version) || selectable.find((item) => item.slug === "colsova" && item.version === "2.4.1") || selectable[0];
        setTemplateKey(preferred ? `${preferred.slug}@${preferred.version}` : "");
      })
      .catch((error) => toast.error(getErrorMessage(error)));
    return () => { active = false; };
  }, []);

  const selected = templates.find((item) => `${item.slug}@${item.version}` === templateKey);
  const selectableTemplates = templates.filter((item) => item.is_active && item.status === "active" && item.runtime_adapter_status === "ready");
  const pendingTemplates = templates.filter((item) => item.runtime_adapter_status === "pending");
  const recommendation = useMemo(() => recommendProposalTheme(selectableTemplates, manual), [selectableTemplates, manual]);
  const pickFile = (next: File | null) => {
    setFileError(null);
    if (!next) { setFile(null); return; }
    if (!next.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setFileError("Sono ammessi soltanto file .csv.");
      return;
    }
    if (next.size > MAX_CSV_BYTES) {
      setFile(null);
      setFileError("Il CSV supera il limite di 2 MiB.");
      return;
    }
    setFile(next);
  };
  const submitCsv = async () => {
    if (!file || !selected) {
      setFileError("Seleziona un file CSV e un template.");
      return;
    }
    setBusy(true);
    try {
      const result = await previewImport(file, selected.slug, selected.version);
      toast.success("CSV analizzato.");
      router.push(`/commercial/site-proposals/imports/${result.batch.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const submitManual = async () => {
    if (!manual.business_name.trim()) {
      toast.error("Il nome attività è obbligatorio.");
      return;
    }
    setBusy(true);
    try {
      if (!selected) throw new Error("Seleziona un tema attivo.");
      const proposal = await createSiteProposal({ templateSlug: selected.slug, templateVersion: selected.version, displayName: manual.business_name.trim(), sourceData: manual });
      toast.success("Proposta creata e accodata.");
      router.push(`/commercial/site-proposals/${proposal.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <CommercialPageHeader title="Nuova proposta" description="Importa un elenco CSV oppure crea una proposta da dati essenziali." />
      <CommercialSectionCard title="Tema">
        <div className="grid gap-3 md:grid-cols-[260px_1fr]">
          <Select value={templateKey} onValueChange={setTemplateKey} disabled={busy}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Seleziona tema" /></SelectTrigger>
            <SelectContent>{selectableTemplates.map((item) => { const key = `${item.slug}@${item.version}`; return <SelectItem key={key} value={key}>{item.name} · {item.version}{item.default_version === item.version ? " · Predefinito" : ""}{recommendation?.key === key ? " · Consigliato" : ""}</SelectItem>; })}</SelectContent>
          </Select>
          {selected ? <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground"><strong className="text-foreground">{selected.name}</strong> · {(selected.categories || []).slice(0, 4).join(", ")} · {selected.content_profile} · Adattatore attivo · Versione immutabile {recommendation?.key === `${selected.slug}@${selected.version}` ? <span className="font-medium text-primary">· Consigliato per questa attività ({recommendation.reason})</span> : null} <Button size="sm" variant="outline" className="ml-3" onClick={() => void fetchProposalThemePreview(selected.slug, selected.version).then(setPreviewHtml).catch((error) => toast.error(getErrorMessage(error)))}>Anteprima</Button></div> : <p className="text-sm text-muted-foreground">Caricamento temi…</p>}
        </div>
        {pendingTemplates.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Altri temi in preparazione:</strong> {pendingTemplates.map((item) => `${item.name} ${item.version}`).join(", ")}. Saranno selezionabili dopo l&apos;integrazione del profilo di generazione.</div> : null}
        {previewHtml ? <div className="mt-4 overflow-hidden rounded-xl border bg-card"><div className="flex justify-end border-b p-2"><Button size="sm" variant="ghost" onClick={() => setPreviewHtml("")}>Chiudi</Button></div><iframe title="Anteprima tema selezionato" srcDoc={previewHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-[620px] w-full" /></div> : null}
      </CommercialSectionCard>
      <Tabs defaultValue="csv">
        <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="csv">Importa CSV</TabsTrigger><TabsTrigger value="manual">Crea manualmente</TabsTrigger></TabsList>
        <TabsContent value="csv" className="mt-5">
          <CommercialSectionCard title="Importa CSV">
            <p className="mb-4 text-sm text-muted-foreground"><strong>Tema per questo batch:</strong> {selected ? `${selected.name} ${selected.version}` : "seleziona un tema attivo"}</p>
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <button type="button" className="flex min-h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 px-5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); pickFile(event.dataTransfer.files[0] || null); }}>
                <Upload className="h-7 w-7 text-primary" /><span className="mt-3 font-medium text-foreground">Trascina qui il CSV</span><span className="mt-1 text-sm text-muted-foreground">oppure premi per selezionarlo, massimo 2 MiB</span>
                <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => pickFile(event.target.files?.[0] || null)} />
              </button>
              <div className="rounded-xl border border-border p-4">
                <h2 className="font-semibold text-foreground">Guida CSV</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Servizi separati da punto e virgola.</li><li>Immagini con URL HTTPS.</li><li>Campi JSON opzionali.</li><li><code>business_name</code> obbligatorio.</li>
                  <li>Sono accettate anche intestazioni italiane comuni come “Nome azienda / struttura”, “Ambito” e “Ruolo pubblico”.</li><li>Massimo 50 righe.</li>
                </ul>
                <Button variant="outline" className="mt-5 w-full" onClick={downloadCsvTemplate}><Download className="mr-2 h-4 w-4" />Scarica CSV modello</Button>
              </div>
            </div>
            {file ? <p className="mt-4 text-sm text-muted-foreground"><FileUp className="mr-2 inline h-4 w-4" />{file.name} · {(file.size / 1024).toFixed(1)} KiB</p> : null}
            {fileError ? <p className="mt-3 text-sm text-rose-600" role="alert">{fileError}</p> : null}
            <div className="mt-5 flex justify-end"><Button disabled={!canUseBuilder || busy || !file || !selected} onClick={() => void submitCsv()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Analizza CSV</Button></div>
          </CommercialSectionCard>
        </TabsContent>
        <TabsContent value="manual" className="mt-5">
          <CommercialSectionCard title="Dati della proposta">
            <div className="grid gap-4 md:grid-cols-2">
              {sourceFields.map(([key, label, required]) => <div key={key} className={["services", "overview", "target_audience", "primary_goal", "tone_of_voice", "notes"].includes(key) ? "md:col-span-2" : ""}><Label htmlFor={key}>{label}{required ? " *" : ""}</Label>{["services", "overview", "target_audience", "primary_goal", "tone_of_voice", "notes"].includes(key) ? <Textarea id={key} className="mt-1 min-h-24" value={manual[key] || ""} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} placeholder={key === "services" ? "Un servizio per riga oppure separati da punto e virgola" : undefined} /> : <Input id={key} className="mt-1 h-11" value={manual[key] || ""} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} />}</div>)}
            </div>
            <div className="mt-5 flex justify-end"><Button disabled={!canUseBuilder || busy || !selected} onClick={() => void submitManual()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Crea e prepara</Button></div>
          </CommercialSectionCard>
        </TabsContent>
      </Tabs>
    </main>
  );
}
