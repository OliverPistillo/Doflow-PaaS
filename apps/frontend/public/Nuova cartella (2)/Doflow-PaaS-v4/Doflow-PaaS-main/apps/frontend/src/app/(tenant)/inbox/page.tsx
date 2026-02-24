"use client";

import { useState, useMemo } from "react";
import {
  Inbox, Search, Star, Paperclip, Tag, Edit2, Reply, ReplyAll,
  Forward, Archive, Trash2, MoreHorizontal, RefreshCw, Circle,
  CircleDot, ChevronLeft, Send, X, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  from: string;
  fromEmail: string;
  company: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  labels: string[];
  hasAttachment: boolean;
  thread: number;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const MESSAGES_DATA: Message[] = [
  {
    id: 1, from: "Francesca Romano", fromEmail: "francesca@startup.io", company: "StartupIO",
    subject: "Re: Aggiornamento piattaforma e-commerce",
    preview: "Ciao Marco, ho visto la demo e sono entusiasta del risultato! Avrei solo un paio di modifiche da richiedere sulla pagina checkout...",
    body: "Ciao Marco,\n\nho visto la demo e sono entusiasta del risultato! Avrei solo un paio di modifiche da richiedere sulla pagina checkout:\n\n1. Il campo \"Indirizzo di spedizione\" deve essere più visibile\n2. Aggiungere il campo \"Codice sconto\" prima del totale\n3. Il bottone di conferma acquisto deve essere più grande su mobile\n\nAl di là di questi dettagli minori, il lavoro è davvero ottimo. Complimenti al team!\n\nQuando possiamo fare una call per allinearci sui prossimi passi?\n\nCordialmente,\nFrancesca",
    date: "2026-02-20 09:15", read: false, starred: true, labels: ["Cliente", "Importante"], hasAttachment: false, thread: 3,
  },
  {
    id: 2, from: "Alessandro Galli", fromEmail: "ale@bigcorp.com", company: "BigCorp SpA",
    subject: "Migrazione cloud — accesso staging",
    preview: "Buongiorno, vi giro le credenziali per l'ambiente staging. Per favore confermate quando avete completato la verifica dei servizi migrati.",
    body: "Buongiorno,\n\nvi giro le credenziali per l'ambiente staging come concordato:\n\nHost: staging.bigcorp-cloud.internal\nUser: deploy_team\nPassword: [vedi allegato criptato]\n\nPer favore confermate via email quando avete completato la verifica dei servizi migrati. Abbiamo pianificato il go-live per il 28 febbraio e dobbiamo rispettare le finestre di manutenzione concordate.\n\nSe ci sono problemi di accesso, contattare il nostro IT al numero interno 440.\n\nGrazie,\nAlessandro Galli\nCTO — BigCorp SpA",
    date: "2026-02-20 08:42", read: false, starred: false, labels: ["Cliente"], hasAttachment: true, thread: 5,
  },
  {
    id: 3, from: "Davide Colombo", fromEmail: "d.colombo@smartfactory.it", company: "SmartFactory",
    subject: "Training CRM — conferma date",
    preview: "Confermo le date proposte per il training: 25 e 26 febbraio, ore 10-14. Saranno presenti 12 persone del team vendite e 5 dell'amministrazione.",
    body: "Buongiorno,\n\nconfermo le date proposte per il training CRM:\n\n📅 25 Febbraio 2026 — ore 10:00-14:00\n📅 26 Febbraio 2026 — ore 10:00-14:00\n\nPartecipanti:\n- 12 persone del team vendite (session 1: funzionalità CRM base)\n- 5 persone del team amministrazione (session 2: fatturazione e reportistica)\n\nVi chiedo di preparare:\n1. Manuale utente stampato (17 copie)\n2. Accesso al sistema di test configurato con i nostri dati demo\n3. Slide del corso\n\nPer domande sull'organizzazione della sala e catering, contattare la nostra assistente Laura al 030-4567890.\n\nA presto,\nDavide Colombo",
    date: "2026-02-19 17:30", read: true, starred: false, labels: ["Cliente"], hasAttachment: false, thread: 2,
  },
  {
    id: 4, from: "Elena Ferri", fromEmail: "elena@design.studio", company: "DesignStudio Srl",
    subject: "Feedback brand guidelines",
    preview: "Il team ha approvato le guidelines! Unica richiesta: potete aggiungere una sezione sulle icone custom? Vi allego il documento con le annotazioni.",
    body: "Ciao,\n\nil team ha approvato le brand guidelines! Siamo molto soddisfatti del lavoro svolto.\n\nUnica richiesta aggiuntiva: potete aggiungere una sezione dedicata alle icone custom? Abbiamo sviluppato un set di 40 icone specifiche per il nostro business che vorremmo documentare secondo lo stesso stile delle guidelines.\n\nVi allego il documento con le annotazioni del nostro creative team. In allegato trovate anche i file SVG delle icone da inserire.\n\nTempistiche: vorremo avere la versione finale entro il 5 marzo per la presentazione al management.\n\nGrazie mille!\nElena",
    date: "2026-02-19 14:22", read: true, starred: true, labels: ["Cliente", "Completato"], hasAttachment: true, thread: 1,
  },
  {
    id: 5, from: "Chiara Lombardi", fromEmail: "chiara@mediagroup.it", company: "MediaGroup Italia",
    subject: "Fattura FT-2026/006 — sollecito pagamento",
    preview: "Buongiorno, ho visto il sollecito ma c'è un problema con il nostro dipartimento contabilità. Vi chiedo qualche giorno in più...",
    body: "Buongiorno,\n\nho ricevuto il vostro sollecito relativo alla fattura FT-2026/006.\n\nSono consapevole del ritardo e mi scuso. Il problema è che il nostro nuovo responsabile amministrativo non ha ancora preso piena visione di tutti i pagamenti in sospeso e stiamo rifacendo il ciclo di approvazione interno.\n\nVi chiedo gentilmente di accordarmi altri 10 giorni lavorativi per procedere al pagamento, ovvero entro il 5 marzo 2026.\n\nPosso confermare che il pagamento avverrà con priorità non appena ottenuta l'approvazione interna.\n\nGrazie per la comprensione.\nChiara Lombardi\nMarketing Manager — MediaGroup Italia",
    date: "2026-02-19 11:05", read: true, starred: false, labels: ["Urgente", "Fatturazione"], hasAttachment: false, thread: 4,
  },
  {
    id: 6, from: "Roberto Mazza", fromEmail: "rob@innovate.it", company: "InnovateIT",
    subject: "App mobile — domande tecniche",
    preview: "Riguardo al preventivo ricevuto, il nostro CTO ha alcune domande sull'architettura proposta. Sarebbe possibile organizzare una call tecnica?",
    body: "Buongiorno,\n\ngrazie per il preventivo ricevuto per lo sviluppo dell'app mobile.\n\nIl nostro CTO, Andrea Russo, ha revisionato la proposta tecnica e ha alcune domande sull'architettura:\n\n1. Perché React Native invece di Flutter? Quali sono i vantaggi specifici per il nostro caso?\n2. Come gestite gli aggiornamenti OTA senza passare dagli store?\n3. Qual è la politica di supporto post-lancio per i bug critici?\n4. Prevedete test su dispositivi fisici oltre che su simulatori?\n\nSarebbe possibile organizzare una call tecnica con il vostro team di sviluppo? Possiamo a partire da mercoledì prossimo.\n\nGrazie,\nRoberto Mazza",
    date: "2026-02-18 16:48", read: true, starred: false, labels: ["Lead"], hasAttachment: false, thread: 1,
  },
  {
    id: 7, from: "Valentina Ricci", fromEmail: "v.ricci@nexuslab.com", company: "NexusLab",
    subject: "Richiesta informazioni servizi automazione",
    preview: "Buongiorno, siamo interessati ai vostri servizi di automazione workflow. Potete inviarci una presentazione con casi studio e pricing?",
    body: "Buongiorno,\n\nsiamo NexusLab, una società di consulenza con 80 collaboratori basata a Milano.\n\nAbbiamo letto del vostro servizio di automazione workflow e siamo molto interessati a capire come potrebbe integrarsi con i nostri processi aziendali.\n\nIn particolare ci interessa:\n- Automazione del ciclo vendite (lead → cliente)\n- Integrazione con il nostro ERP SAP\n- Reportistica automatica per il management\n\nPotreste inviarci una presentazione con casi studio simili al nostro settore e un'indicazione di pricing?\n\nSarebbe anche possibile organizzare una demo live?\n\nCordialmente,\nValentina Ricci\nOperations Manager — NexusLab",
    date: "2026-02-18 10:20", read: true, starred: false, labels: ["Lead", "Nuovo"], hasAttachment: false, thread: 1,
  },
  {
    id: 8, from: "Marco Ferretti", fromEmail: "marco.f@digitalwave.it", company: "DigitalWave Srl",
    subject: "Re: Manutenzione sito — rinnovo annuale",
    preview: "Confermo il rinnovo del piano di manutenzione annuale. Potete procedere con la fattura? Stessi termini dello scorso anno vanno bene.",
    body: "Ciao,\n\nconfermo il rinnovo del piano di manutenzione annuale per il sito web digitalwave.it.\n\nStessi termini dello scorso anno vanno benissimo:\n- Piano Silver: aggiornamenti mensili + monitoraggio uptime\n- Intervento rapido entro 4h per bug critici\n- Report mensile prestazioni\n\nPotete procedere con la fattura? Emettete a favore di DigitalWave Srl, P.IVA IT67890123456.\n\nPreferisco il pagamento tramite bonifico entro 30gg come al solito.\n\nGrazie!\nMarco",
    date: "2026-02-17 09:33", read: true, starred: false, labels: ["Cliente"], hasAttachment: false, thread: 2,
  },
  {
    id: 9, from: "Sistema DoFlow", fromEmail: "noreply@doflow.io", company: "DoFlow",
    subject: "Report settimanale vendite — W7 2026",
    preview: "Il tuo report settimanale è pronto. Pipeline: €340.500 (+12%), Deal chiuse: 2, Nuovi lead: 3. Clicca per i dettagli completi.",
    body: "Il report settimanale della settimana 7 è disponibile.\n\n📊 RIEPILOGO KPI\n\nPipeline totale: €340.500 (+12% vs W6)\nDeal chiuse (vinte): 2 — €20.500\nNuovi lead: 3\nTask completati: 18/22 (82%)\n\n🔝 TOP DEAL IN PIPELINE\n1. Migrazione cloud BigCorp — €95.000 (75%)\n2. CRM SmartFactory — €67.000 (80%)\n3. App mobile InnovateIT — €45.000 (30%)\n\n⚠️ ATTENZIONE\n- Fattura FT-2026/006 MediaGroup scaduta (+11 giorni)\n- Preventivo PRV-2026-001 StartupIO in scadenza il 10/03\n\nPer il report completo, accedi alla dashboard Analytics.",
    date: "2026-02-17 07:00", read: true, starred: false, labels: ["Sistema"], hasAttachment: true, thread: 1,
  },
];

const LABELS = ["Tutti", "Non letti", "Stellati", "Cliente", "Lead", "Urgente", "Fatturazione", "Completato", "Sistema", "Nuovo"];

const LABEL_COLORS: Record<string, string> = {
  Cliente:     "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  Lead:        "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  Urgente:     "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  Fatturazione:"bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Completato:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  Sistema:     "bg-slate-100 text-slate-600 dark:bg-slate-800/40",
  Importante:  "bg-amber-100 text-amber-700 dark:bg-amber-950/40",
  Nuovo:       "bg-sky-100 text-sky-700 dark:bg-sky-950/40",
};

const AVATAR_COLORS: Record<string, string> = {
  "Francesca Romano": "bg-indigo-500", "Alessandro Galli": "bg-violet-500",
  "Davide Colombo":   "bg-orange-500", "Elena Ferri":      "bg-rose-500",
  "Chiara Lombardi":  "bg-teal-500",   "Roberto Mazza":    "bg-amber-500",
  "Valentina Ricci":  "bg-sky-500",    "Marco Ferretti":   "bg-emerald-500",
  "Sistema DoFlow":   "bg-slate-500",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [messages, setMessages] = useState<Message[]>(MESSAGES_DATA);
  const [activeLabel, setLabel] = useState("Tutti");
  const [selected, setSelected] = useState<Message | null>(null);
  const [search, setSearch]     = useState("");
  const [reply, setReply]       = useState("");
  const [showReply, setShowReply] = useState(false);

  const filtered = useMemo(() => messages.filter(m => {
    if (activeLabel === "Non letti" && m.read) return false;
    if (activeLabel === "Stellati"  && !m.starred) return false;
    if (!["Tutti","Non letti","Stellati"].includes(activeLabel) && !m.labels.includes(activeLabel)) return false;
    if (search && !`${m.subject} ${m.from} ${m.company}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [messages, activeLabel, search]);

  const unread = messages.filter(m => !m.read).length;

  const toggleStar = (id: number) => setMessages(ms => ms.map(m => m.id === id ? { ...m, starred: !m.starred } : m));
  const markRead   = (id: number) => setMessages(ms => ms.map(m => m.id === id ? { ...m, read: true }        : m));

  const labelCount = (lbl: string) => {
    if (lbl === "Tutti")     return messages.length;
    if (lbl === "Non letti") return unread;
    if (lbl === "Stellati")  return messages.filter(m => m.starred).length;
    return messages.filter(m => m.labels.includes(lbl)).length;
  };

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("");

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden animate-in fade-in duration-500">

      {/* ── Sidebar labels ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-col w-48 border-r border-border/50 bg-muted/10 p-3 gap-0.5 shrink-0">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Casella</p>
          <Button variant="ghost" size="icon" className="h-6 w-6"><RefreshCw className="h-3 w-3" /></Button>
        </div>
        {LABELS.map(lbl => {
          const count = labelCount(lbl);
          return (
            <button
              key={lbl}
              onClick={() => { setLabel(lbl); setSelected(null); }}
              className={cn(
                "flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors",
                activeLabel === lbl
                  ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{lbl}</span>
              {count > 0 && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  lbl === "Non letti" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"
                )}>{count}</span>
              )}
            </button>
          );
        })}

        <Separator className="my-2" />
        <Button variant="outline" size="sm" className="w-full text-xs">
          <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Nuova Email
        </Button>
      </div>

      {/* ── Message list ────────────────────────────────────────────────────── */}
      <div className={cn(
        "flex flex-col border-r border-border/50 shrink-0 transition-all duration-200",
        selected ? "hidden md:flex md:w-80 lg:w-96" : "flex-1 md:w-80 lg:w-96",
      )}>
        {/* Search */}
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca messaggi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 px-0.5">
            {filtered.length} {filtered.length === 1 ? "messaggio" : "messaggi"}
            {unread > 0 && <span className="ml-2 text-indigo-600 font-semibold">{unread} non letti</span>}
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nessun messaggio trovato.</p>
            </div>
          ) : (
            filtered.map(m => (
              <div
                key={m.id}
                className={cn(
                  "flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors relative",
                  selected?.id === m.id
                    ? "bg-indigo-50 dark:bg-indigo-950/20"
                    : "hover:bg-muted/30",
                  !m.read && "border-l-2 border-l-indigo-500",
                )}
                onClick={() => { setSelected(m); markRead(m.id); setShowReply(false); }}
              >
                {/* Unread dot */}
                {!m.read && (
                  <div className="absolute right-3 top-3.5 h-2 w-2 rounded-full bg-indigo-500" />
                )}

                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarFallback className={cn("text-[10px] font-bold text-white", AVATAR_COLORS[m.from] ?? "bg-slate-500")}>
                    {initials(m.from)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={cn("text-sm truncate", !m.read ? "font-bold" : "font-medium")}>{m.from}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {m.date.split(" ")[1] ?? new Date(m.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  <p className={cn("text-xs truncate mb-1", !m.read ? "text-foreground font-medium" : "text-muted-foreground")}>{m.subject}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{m.preview}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {m.labels.slice(0, 2).map(lbl => (
                      <span key={lbl} className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", LABEL_COLORS[lbl] ?? "bg-muted text-muted-foreground")}>
                        {lbl}
                      </span>
                    ))}
                    {m.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground/60" />}
                    {m.thread > 1 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MessageSquare className="h-2.5 w-2.5" />{m.thread}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  className="shrink-0 self-start mt-0.5"
                  onClick={e => { e.stopPropagation(); toggleStar(m.id); }}
                >
                  <Star className={cn("h-3.5 w-3.5 transition-colors", m.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400")} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Message detail ──────────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-card/50">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSelected(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 ml-auto">
              {[
                { icon: Reply,   label: "Rispondi",  action: () => setShowReply(true) },
                { icon: Archive, label: "Archivia",  action: () => setSelected(null) },
                { icon: Trash2,  label: "Elimina",   action: () => setSelected(null) },
              ].map(btn => (
                <Button key={btn.label} variant="ghost" size="icon" className="h-8 w-8" title={btn.label} onClick={btn.action}>
                  <btn.icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Subject + labels */}
            <div>
              <h2 className="text-lg font-bold leading-snug mb-2">{selected.subject}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {selected.labels.map(lbl => (
                  <span key={lbl} className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", LABEL_COLORS[lbl] ?? "bg-muted text-muted-foreground")}>
                    {lbl}
                  </span>
                ))}
              </div>
            </div>

            {/* Sender card */}
            <div className="flex items-start gap-3 bg-muted/20 rounded-xl p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={cn("font-bold text-white", AVATAR_COLORS[selected.from] ?? "bg-slate-500")}>
                  {initials(selected.from)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{selected.from}</p>
                    <p className="text-xs text-muted-foreground">{selected.fromEmail} · {selected.company}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0 tabular-nums">{selected.date}</p>
                </div>
                {selected.hasAttachment && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-indigo-600">
                    <Paperclip className="h-3 w-3" /> Allegati presenti
                  </div>
                )}
                {selected.thread > 1 && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.thread} messaggi nel thread</p>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-[inherit]">
              {selected.body}
            </div>
          </div>

          {/* Reply box */}
          {showReply ? (
            <div className="border-t border-border/50 p-4 bg-card/50">
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <Reply className="h-3.5 w-3.5" />
                Risposta a <span className="font-medium text-foreground">{selected.from}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setShowReply(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                placeholder="Scrivi la tua risposta..."
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={4}
                className="text-sm resize-none mb-2"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">Formatta</Button>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"><Paperclip className="h-3.5 w-3.5" /></Button>
                </div>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!reply.trim()}>
                  <Send className="mr-1.5 h-4 w-4" /> Invia risposta
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-border/50 p-3 bg-card/30">
              <Button variant="outline" className="w-full text-sm" onClick={() => setShowReply(true)}>
                <Reply className="mr-2 h-4 w-4" /> Rispondi a {selected.from}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Inbox className="h-14 w-14 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Seleziona un messaggio per leggerlo</p>
          </div>
        </div>
      )}
    </div>
  );
}
