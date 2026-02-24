"use client";

import { useState, useMemo } from "react";
import { Mail, Plus, Search, Send, Copy, Trash2, Edit2, Eye,
  BarChart2, Star, Tag, ChevronRight, Code, Braces, Variable } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
  id: number;
  name: string;
  category: string;
  subject: string;
  body: string;
  variables: string[];
  usageCount: number;
  lastUsed: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const EMAIL_TEMPLATES: Template[] = [
  { id: 1, name: "Benvenuto nuovo cliente",    category: "Onboarding",   subject: "Benvenuto in {company_name}! 🎉",                            variables: ["nome","company_name","mittente"],                                usageCount: 24, lastUsed: "2026-02-19",
    body: "Ciao {nome},\n\nSiamo felici di averti a bordo! Il tuo account è pronto e puoi iniziare subito.\n\nEcco i primi passi:\n1. Completa il tuo profilo\n2. Esplora la dashboard\n3. Invita il tuo team\n\nSe hai bisogno di aiuto, siamo qui per te.\n\nA presto,\n{mittente}" },
  { id: 2, name: "Invio preventivo",           category: "Vendite",      subject: "Preventivo {numero_prev} — {titolo_progetto}",               variables: ["nome","numero_prev","titolo_progetto","mittente"],               usageCount: 18, lastUsed: "2026-02-18",
    body: "Gentile {nome},\n\ncome da accordi, le invio in allegato il preventivo {numero_prev} relativo a {titolo_progetto}.\n\nIl preventivo ha validità 30 giorni dalla data di emissione.\n\nResto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\n{mittente}" },
  { id: 3, name: "Followup post-meeting",      category: "Vendite",      subject: "Riepilogo meeting — {oggetto}",                               variables: ["nome","oggetto","punti_discussi","prossimi_passi","mittente"],  usageCount: 31, lastUsed: "2026-02-20",
    body: "Ciao {nome},\n\ngrazie per il tempo dedicato durante il nostro meeting di oggi.\n\nRiepilogo punti discussi:\n{punti_discussi}\n\nProssimi passi:\n{prossimi_passi}\n\nSe hai domande, non esitare a contattarmi.\n\nA presto,\n{mittente}" },
  { id: 4, name: "Sollecito pagamento",        category: "Fatturazione", subject: "Sollecito fattura {numero_fattura} — scadenza {data_scadenza}",variables: ["nome","numero_fattura","importo","data_scadenza","mittente"],  usageCount: 8,  lastUsed: "2026-02-19",
    body: "Gentile {nome},\n\nle scriviamo per ricordarle che la fattura {numero_fattura} di importo {importo} risulta scaduta dal {data_scadenza}.\n\nLa preghiamo di provvedere al saldo entro 7 giorni.\n\nPer qualsiasi chiarimento restiamo a disposizione.\n\nDistinti saluti,\n{mittente}" },
  { id: 5, name: "Conferma ordine",            category: "Operazioni",   subject: "Conferma ordine {numero_ordine}",                            variables: ["nome","numero_ordine","dettagli_ordine","totale","data_consegna","mittente"], usageCount: 12, lastUsed: "2026-02-15",
    body: "Gentile {nome},\n\nconfermiamo la ricezione del suo ordine {numero_ordine}.\n\nDettagli:\n{dettagli_ordine}\n\nTotale: {totale}\nConsegna prevista: {data_consegna}\n\nLa terremo aggiornata sullo stato di avanzamento.\n\nCordiali saluti,\n{mittente}" },
  { id: 6, name: "Richiesta feedback",         category: "Post-vendita", subject: "Come è andata? Il tuo feedback è importante",                variables: ["nome","progetto","link_feedback","mittente"],                   usageCount: 6,  lastUsed: "2026-02-10",
    body: "Ciao {nome},\n\nè passato un po' di tempo da quando abbiamo completato {progetto} e ci piacerebbe sapere come stai trovando il risultato.\n\nSe hai 2 minuti, ci farebbe piacere ricevere il tuo feedback:\n{link_feedback}\n\nGrazie mille!\n{mittente}" },
  { id: 7, name: "Proposta collaborazione",    category: "Vendite",      subject: "Proposta di collaborazione — {titolo}",                      variables: ["nome","titolo","descrizione_proposta","mittente"],               usageCount: 15, lastUsed: "2026-02-17",
    body: "Gentile {nome},\n\nmi permetto di contattarla per presentare una proposta di collaborazione che riteniamo possa essere di reciproco interesse.\n\n{descrizione_proposta}\n\nSarebbe disponibile per una breve call conoscitiva?\n\nCordiali saluti,\n{mittente}" },
  { id: 8, name: "Auguri festività",           category: "Relazioni",    subject: "Auguri dal team {company_name}!",                            variables: ["nome","company_name","data_inizio","data_fine"],                usageCount: 3,  lastUsed: "2025-12-20",
    body: "Caro/a {nome},\n\nil team di {company_name} vi augura buone feste!\n\nÈ stato un piacere collaborare con voi quest'anno e non vediamo l'ora di continuare nel nuovo anno.\n\nI nostri uffici saranno chiusi dal {data_inizio} al {data_fine}.\n\nBuone feste!\nIl team {company_name}" },
];

const CATEGORIES = ["Tutti", "Onboarding", "Vendite", "Fatturazione", "Operazioni", "Post-vendita", "Relazioni"];

const CATEGORY_COLORS: Record<string, string> = {
  Onboarding:   "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200",
  Vendite:      "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200",
  Fatturazione: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200",
  Operazioni:   "text-violet-600 bg-violet-50 dark:bg-violet-950/30 border-violet-200",
  "Post-vendita":"text-teal-600 bg-teal-50 dark:bg-teal-950/30 border-teal-200",
  Relazioni:    "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200",
};

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({ t, onSelect }: { t: Template; onSelect: (t: Template) => void }) {
  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow border-border/60"
      onClick={() => onSelect(t)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
            <Mail className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[t.category] ?? "")}>
            {t.category}
          </Badge>
        </div>

        <h3 className="font-semibold text-sm mb-1">{t.name}</h3>
        <p className="text-xs text-muted-foreground truncate mb-3">{t.subject}</p>

        {/* Variables */}
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {t.variables.slice(0, 3).map(v => (
            <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
              {`{${v}}`}
            </span>
          ))}
          {t.variables.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{t.variables.length - 3}</span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2.5">
          <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {t.usageCount} invii</span>
          <span>Usato: {new Date(t.lastUsed).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function TemplateSheet({ t, onClose }: { t: Template; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "source">("preview");

  // Highlight {variables} in body
  const renderedBody = t.body.replace(
    /\{([a-zA-Z_]+)\}/g,
    '<span class="text-indigo-600 font-mono bg-indigo-50 dark:bg-indigo-950/30 rounded px-0.5">{$1}</span>'
  );

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-[560px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base">{t.name}</SheetTitle>
              <Badge variant="outline" className={cn("text-[10px] mt-1", CATEGORY_COLORS[t.category] ?? "")}>{t.category}</Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* Subject */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1">Oggetto email</p>
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm font-medium">{t.subject}</div>
          </div>

          {/* Variables */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-2">
              Variabili dinamiche ({t.variables.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {t.variables.map(v => (
                <span key={v} className="text-xs px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 font-mono border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Variable className="h-3 w-3" /> {`{${v}}`}
                </span>
              ))}
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Corpo email</p>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                {(["preview", "source"] as const).map(t2 => (
                  <button key={t2} onClick={() => setTab(t2)} className={cn("text-[10px] px-2 py-1 rounded-md font-medium transition-colors", tab === t2 ? "bg-background shadow-sm" : "text-muted-foreground")}>
                    {t2 === "preview" ? <><Eye className="h-3 w-3 inline mr-1" />Preview</> : <><Code className="h-3 w-3 inline mr-1" />Sorgente</>}
                  </button>
                ))}
              </div>
            </div>
            {tab === "preview" ? (
              <div
                className="bg-muted/30 rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border border-border/40"
                dangerouslySetInnerHTML={{ __html: renderedBody }}
              />
            ) : (
              <pre className="bg-muted/30 rounded-lg px-4 py-3 text-xs font-mono leading-relaxed whitespace-pre-wrap border border-border/40 overflow-x-auto">
                {t.body}
              </pre>
            )}
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xl font-black tabular-nums text-indigo-600">{t.usageCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Invii totali</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-sm font-bold">{new Date(t.lastUsed).toLocaleDateString("it-IT")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ultimo utilizzo</p>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Copy className="mr-1.5 h-4 w-4" /> Duplica
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Edit2 className="mr-1.5 h-4 w-4" /> Modifica
          </Button>
          <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Send className="mr-1.5 h-4 w-4" /> Usa template
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("Tutti");
  const [selected, setSelected] = useState<Template | null>(null);

  const filtered = useMemo(() => EMAIL_TEMPLATES.filter(t => {
    if (category !== "Tutti" && t.category !== category) return false;
    if (search && !`${t.name} ${t.subject} ${t.category}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, category]);

  const totalUsage = EMAIL_TEMPLATES.reduce((s, t) => s + t.usageCount, 0);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {selected && <TemplateSheet t={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Template Email</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {EMAIL_TEMPLATES.length} template · {totalUsage} invii totali
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0" size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nuovo Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca template..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition-colors font-medium",
              category === c
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground",
            )}
          >
            {c === "Tutti" ? `Tutti (${EMAIL_TEMPLATES.length})` : `${c} (${EMAIL_TEMPLATES.filter(t => t.category === c).length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nessun template trovato.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => <TemplateCard key={t.id} t={t} onSelect={setSelected} />)}
        </div>
      )}
    </div>
  );
}
