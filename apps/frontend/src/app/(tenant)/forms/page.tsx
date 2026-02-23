"use client";

import { useState, useMemo } from "react";
import {
  FormInput, Plus, Search, Eye, Copy, Trash2, Edit2, BarChart2,
  ToggleLeft, Link2, ExternalLink, CheckSquare, AlignLeft, Hash,
  Mail, Calendar, Star, List, ChevronDown, ChevronRight, ArrowUpRight,
  MousePointerClick, Users, Clock, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "text" | "email" | "number" | "textarea" | "select" | "checkbox" | "date" | "rating";
type FormStatus = "attivo" | "bozza" | "archiviato";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormDef {
  id: string;
  name: string;
  description: string;
  status: FormStatus;
  category: string;
  fields: FormField[];
  submissions: number;
  views: number;
  conversionRate: number;
  lastSubmission: string;
  createdAt: string;
  embedUrl: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const FORMS: FormDef[] = [
  {
    id: "f01", name: "Richiesta di contatto", description: "Form principale del sito web per nuovi lead", status: "attivo", category: "Lead Generation",
    fields: [
      { id: "1", type: "text",     label: "Nome e cognome",      required: true,  placeholder: "Mario Rossi" },
      { id: "2", type: "email",    label: "Email aziendale",     required: true,  placeholder: "mario@azienda.it" },
      { id: "3", type: "text",     label: "Azienda",             required: true,  placeholder: "Nome azienda" },
      { id: "4", type: "select",   label: "Servizio d'interesse",required: true,  options: ["Sviluppo Web","App Mobile","Consulenza","CRM","Altro"] },
      { id: "5", type: "textarea", label: "Messaggio",           required: false, placeholder: "Descrivici il tuo progetto..." },
    ],
    submissions: 148, views: 1240, conversionRate: 11.9, lastSubmission: "2026-02-20", createdAt: "2025-10-01", embedUrl: "https://forms.doflow.io/f01",
  },
  {
    id: "f02", name: "Feedback post-progetto", description: "Raccolta feedback cliente al completamento del progetto", status: "attivo", category: "Post-vendita",
    fields: [
      { id: "1", type: "rating",   label: "Valutazione generale",   required: true },
      { id: "2", type: "rating",   label: "Qualità del lavoro",     required: true },
      { id: "3", type: "rating",   label: "Rispetto delle scadenze",required: true },
      { id: "4", type: "textarea", label: "Cosa hai apprezzato di più?",    required: false },
      { id: "5", type: "textarea", label: "Cosa possiamo migliorare?",required: false },
      { id: "6", type: "checkbox", label: "Consiglierei DoFlow",    required: false },
    ],
    submissions: 62, views: 280, conversionRate: 22.1, lastSubmission: "2026-02-19", createdAt: "2025-11-15", embedUrl: "https://forms.doflow.io/f02",
  },
  {
    id: "f03", name: "Iscrizione newsletter", description: "Iscrizione al digest mensile di aggiornamenti e news", status: "attivo", category: "Marketing",
    fields: [
      { id: "1", type: "text",  label: "Nome",  required: true,  placeholder: "Mario" },
      { id: "2", type: "email", label: "Email", required: true,  placeholder: "mario@azienda.it" },
      { id: "3", type: "select",label: "Argomenti d'interesse", required: false, options: ["Tech","Design","Business","Tutto"] },
    ],
    submissions: 310, views: 890, conversionRate: 34.8, lastSubmission: "2026-02-20", createdAt: "2025-09-01", embedUrl: "https://forms.doflow.io/f03",
  },
  {
    id: "f04", name: "Richiesta preventivo", description: "Form qualificazione lead avanzato per preventivi enterprise", status: "attivo", category: "Lead Generation",
    fields: [
      { id: "1", type: "text",     label: "Nome referente",       required: true },
      { id: "2", type: "email",    label: "Email",                required: true },
      { id: "3", type: "text",     label: "Azienda",              required: true },
      { id: "4", type: "number",   label: "Budget indicativo (€)",required: false },
      { id: "5", type: "date",     label: "Inizio progetto previsto", required: false },
      { id: "6", type: "textarea", label: "Descrizione progetto", required: true },
      { id: "7", type: "select",   label: "Tipologia progetto",   required: true, options: ["Web","Mobile","Cloud","Consulenza","CRM/ERP","Altro"] },
    ],
    submissions: 38, views: 415, conversionRate: 9.2, lastSubmission: "2026-02-18", createdAt: "2025-12-01", embedUrl: "https://forms.doflow.io/f04",
  },
  {
    id: "f05", name: "Segnalazione bug / supporto", description: "Form interno per segnalazione problemi tecnici", status: "attivo", category: "Supporto",
    fields: [
      { id: "1", type: "text",     label: "Titolo problema",      required: true },
      { id: "2", type: "select",   label: "Priorità",             required: true, options: ["Critica","Alta","Media","Bassa"] },
      { id: "3", type: "textarea", label: "Descrizione dettagliata", required: true },
      { id: "4", type: "text",     label: "Pagina / URL",          required: false },
    ],
    submissions: 24, views: 156, conversionRate: 15.4, lastSubmission: "2026-02-17", createdAt: "2026-01-10", embedUrl: "https://forms.doflow.io/f05",
  },
  {
    id: "f06", name: "Candidatura posizioni aperte", description: "Form di candidatura spontanea per il team", status: "bozza", category: "HR",
    fields: [
      { id: "1", type: "text",     label: "Nome completo",   required: true },
      { id: "2", type: "email",    label: "Email",           required: true },
      { id: "3", type: "select",   label: "Ruolo d'interesse", required: true, options: ["Frontend","Backend","Full-stack","Design","Sales","Marketing"] },
      { id: "4", type: "textarea", label: "Presentazione",   required: true },
      { id: "5", type: "text",     label: "LinkedIn URL",    required: false },
    ],
    submissions: 0, views: 0, conversionRate: 0, lastSubmission: "—", createdAt: "2026-02-15", embedUrl: "https://forms.doflow.io/f06",
  },
];

const FIELD_ICONS: Record<FieldType, React.ComponentType<{className?: string}>> = {
  text:     AlignLeft, email: Mail, number: Hash, textarea: AlignLeft,
  select:   List, checkbox: CheckSquare, date: Calendar, rating: Star,
};

const FIELD_COLORS: Record<FieldType, string> = {
  text:     "text-indigo-600",  email:    "text-violet-600", number: "text-amber-600",
  textarea: "text-slate-600",   select:   "text-teal-600",   checkbox:"text-emerald-600",
  date:     "text-rose-600",    rating:   "text-amber-500",
};

const STATUS_CFG: Record<FormStatus, { label: string; color: string; bg: string }> = {
  attivo:     { label: "Attivo",     color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  bozza:      { label: "Bozza",      color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/40" },
  archiviato: { label: "Archiviato", color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/40" },
};

const CAT_COLORS: Record<string, string> = {
  "Lead Generation": "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
  "Post-vendita":    "text-teal-600 bg-teal-50 dark:bg-teal-950/30",
  Marketing:         "text-violet-600 bg-violet-50 dark:bg-violet-950/30",
  Supporto:          "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  HR:                "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
};

// ─── Form Preview Dialog ──────────────────────────────────────────────────────

function FormPreview({ form, onClose }: { form: FormDef; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{form.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{form.description}</p>
        </DialogHeader>

        <Tabs defaultValue="preview">
          <TabsList className="h-8">
            <TabsTrigger value="preview" className="text-xs">Anteprima</TabsTrigger>
            <TabsTrigger value="stats"   className="text-xs">Statistiche</TabsTrigger>
            <TabsTrigger value="embed"   className="text-xs">Incorpora</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4 space-y-4">
            {form.fields.map(field => {
              const Icon = FIELD_ICONS[field.type];
              return (
                <div key={field.id}>
                  <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
                    <Icon className={cn("h-3.5 w-3.5", FIELD_COLORS[field.type])} />
                    {field.label}
                    {field.required && <span className="text-rose-500">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea rows={3} placeholder={field.placeholder} disabled className="w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm resize-none" />
                  ) : field.type === "select" ? (
                    <select disabled className="w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      <option>Seleziona...</option>
                      {field.options?.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" disabled className="rounded" />
                      <span className="text-sm text-muted-foreground">{field.placeholder ?? field.label}</span>
                    </label>
                  ) : field.type === "rating" ? (
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => <Star key={n} className="h-6 w-6 text-muted-foreground/40" />)}
                    </div>
                  ) : (
                    <input type={field.type} placeholder={field.placeholder} disabled className="w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm" />
                  )}
                </div>
              );
            })}
            <Button disabled className="w-full bg-indigo-600 text-white">Invia</Button>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Visualizzazioni", value: form.views.toLocaleString("it-IT"),      icon: Eye,            color: "text-indigo-600" },
                { label: "Invii",           value: form.submissions.toLocaleString("it-IT"), icon: MousePointerClick, color: "text-emerald-600" },
                { label: "Conversione",     value: `${form.conversionRate}%`,                icon: TrendingUp,     color: "text-amber-600" },
                { label: "Campi totali",    value: String(form.fields.length),               icon: FormInput,      color: "text-violet-600" },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                  <s.icon className={cn("h-5 w-5 mx-auto mb-1", s.color)} />
                  <p className="text-xl font-black tabular-nums">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Tasso di completamento</p>
              <Progress value={form.conversionRate * 2.5} className="h-2" />
              <p className="text-xs text-muted-foreground">Ultimo invio: {form.lastSubmission !== "—" ? new Date(form.lastSubmission).toLocaleDateString("it-IT") : "—"}</p>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Incorpora questo form nel tuo sito web o condividilo tramite link diretto.</p>
            <div>
              <p className="text-xs font-medium mb-1.5">Link diretto</p>
              <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 border border-border/50">
                <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{form.embedUrl}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">Codice iframe</p>
              <pre className="text-xs font-mono bg-muted/40 rounded-lg p-3 border border-border/50 overflow-x-auto whitespace-pre-wrap break-all">{`<iframe src="${form.embedUrl}" width="100%" height="600" frameborder="0"></iframe>`}</pre>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Chiudi</Button>
          <Button variant="outline" size="sm"><Edit2 className="mr-1.5 h-3.5 w-3.5" /> Modifica</Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Apri form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Form Card ────────────────────────────────────────────────────────────────

function FormCard({ form, onSelect }: { form: FormDef; onSelect: () => void }) {
  const sc = STATUS_CFG[form.status];
  return (
    <Card className="group hover:shadow-md transition-all border-border/60 cursor-pointer" onClick={onSelect}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
            <FormInput className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sc.color, "border-current/30")}>{sc.label}</Badge>
          </div>
        </div>

        <h3 className="font-semibold text-sm mb-1">{form.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{form.description}</p>

        {/* Category */}
        <Badge variant="secondary" className={cn("text-[10px] mb-3", CAT_COLORS[form.category] ?? "")}>{form.category}</Badge>

        {/* Fields preview */}
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {form.fields.slice(0, 4).map(f => {
            const Icon = FIELD_ICONS[f.type];
            return (
              <span key={f.id} className={cn("h-6 w-6 rounded-md flex items-center justify-center bg-muted/60", FIELD_COLORS[f.type])}>
                <Icon className="h-3 w-3" />
              </span>
            );
          })}
          {form.fields.length > 4 && (
            <span className="text-xs text-muted-foreground">+{form.fields.length - 4}</span>
          )}
          <span className="text-xs text-muted-foreground ml-1">{form.fields.length} campi</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
          {[
            { label: "Views",      value: form.views,             icon: Eye },
            { label: "Invii",      value: form.submissions,       icon: MousePointerClick },
            { label: "Conv.",      value: `${form.conversionRate}%`, icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-sm font-bold tabular-nums">{typeof s.value === "number" ? s.value.toLocaleString("it-IT") : s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<FormDef | null>(null);

  const totalViews       = FORMS.reduce((s, f) => s + f.views, 0);
  const totalSubmissions = FORMS.reduce((s, f) => s + f.submissions, 0);
  const avgConversion    = FORMS.filter(f => f.views > 0).reduce((s, f) => s + f.conversionRate, 0) / FORMS.filter(f => f.views > 0).length;

  const filtered = useMemo(() => FORMS.filter(f =>
    !search || `${f.name} ${f.description} ${f.category}`.toLowerCase().includes(search.toLowerCase())
  ), [search]);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {selected && <FormPreview form={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Form & Raccolta Dati</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {FORMS.length} form · {totalSubmissions} invii totali · {totalViews.toLocaleString("it-IT")} visualizzazioni
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0" size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nuovo Form
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Form attivi",       value: String(FORMS.filter(f => f.status === "attivo").length), icon: ToggleLeft,       color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Visualizzazioni",   value: totalViews.toLocaleString("it-IT"),                      icon: Eye,              color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
          { label: "Invii totali",      value: totalSubmissions.toLocaleString("it-IT"),                icon: MousePointerClick,color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/30" },
          { label: "Conversione media", value: `${avgConversion.toFixed(1)}%`,                          icon: TrendingUp,       color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca form..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(f => (
          <FormCard key={f.id} form={f} onSelect={() => setSelected(f)} />
        ))}

        {/* New form card */}
        <div
          className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border/50 rounded-xl p-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 transition-colors text-center"
        >
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <Plus className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Crea nuovo form</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Drag & drop builder</p>
          </div>
        </div>
      </div>
    </div>
  );
}
