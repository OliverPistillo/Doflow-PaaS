"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Globe, Tag,
  Calendar, DollarSign, FileText, CheckSquare, MessageSquare,
  Pencil, Plus, ChevronRight, TrendingUp, Clock, Send,
  PhoneCall, StickyNote, Briefcase, Star, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Demo data ────────────────────────────────────────────────────────────────

const CONTACTS = [
  { id: "1", name: "Francesca Romano",  email: "francesca@startup.io",      phone: "+39 338 6789012", company: "StartupIO",           companyId: "1", role: "CEO",               initials: "FR", color: "bg-indigo-500",  type: "lead",    tags: ["Decision Maker","Tech"],       lastContact: "2026-02-18", city: "Milano" },
  { id: "2", name: "Alessandro Galli",  email: "ale@bigcorp.com",           phone: "+39 339 7890123", company: "BigCorp SpA",          companyId: "2", role: "CTO",               initials: "AG", color: "bg-violet-500",  type: "lead",    tags: ["Tecnico"],                     lastContact: "2026-02-15", city: "Roma" },
  { id: "3", name: "Elena Ferri",       email: "elena@design.studio",       phone: "+39 340 8901234", company: "DesignStudio Srl",     companyId: "3", role: "Creative Director",  initials: "EF", color: "bg-rose-500",    type: "cliente", tags: ["Decision Maker","Design"],     lastContact: "2026-02-19", city: "Torino" },
  { id: "4", name: "Roberto Mazza",     email: "rob@innovate.it",           phone: "+39 341 9012345", company: "InnovateIT",           companyId: "4", role: "Head of Product",    initials: "RM", color: "bg-amber-500",   type: "lead",    tags: ["Product"],                     lastContact: "2026-02-10", city: "Bologna" },
  { id: "5", name: "Chiara Lombardi",   email: "chiara@mediagroup.it",      phone: "+39 342 0123456", company: "MediaGroup Italia",    companyId: "5", role: "Marketing Manager",  initials: "CL", color: "bg-teal-500",    type: "lead",    tags: ["Marketing"],                   lastContact: "2026-02-17", city: "Napoli" },
  { id: "6", name: "Marco Ferretti",    email: "marco.f@digitalwave.it",    phone: "+39 343 1234567", company: "DigitalWave Srl",      companyId: "6", role: "Founder",            initials: "MF", color: "bg-emerald-500", type: "cliente", tags: ["Decision Maker","Startup"],    lastContact: "2026-02-20", city: "Firenze" },
  { id: "7", name: "Valentina Ricci",   email: "v.ricci@nexuslab.com",      phone: "+39 344 2345678", company: "NexusLab",             companyId: "7", role: "Operations Manager", initials: "VR", color: "bg-sky-500",     type: "lead",    tags: ["Operazioni"],                  lastContact: "2026-02-12", city: "Milano" },
  { id: "8", name: "Davide Colombo",    email: "d.colombo@smartfactory.it", phone: "+39 345 3456789", company: "SmartFactory",         companyId: "8", role: "CEO",               initials: "DC", color: "bg-orange-500",  type: "cliente", tags: ["Decision Maker","Manufacturing"],lastContact: "2026-02-14", city: "Brescia" },
];

const COMPANIES: Record<string, { name: string; sector: string; employees: string; revenue: string; website: string; vat: string }> = {
  "1": { name: "StartupIO",         sector: "Tech",          employees: "10-50",  revenue: "€500K", website: "startup.io",     vat: "IT12345678901" },
  "2": { name: "BigCorp SpA",       sector: "Enterprise",    employees: "500+",   revenue: "€50M",  website: "bigcorp.com",    vat: "IT23456789012" },
  "3": { name: "DesignStudio Srl",  sector: "Design",        employees: "10-50",  revenue: "€1.2M", website: "design.studio",  vat: "IT34567890123" },
  "4": { name: "InnovateIT",        sector: "Tech",          employees: "50-200", revenue: "€5M",   website: "innovate.it",    vat: "IT45678901234" },
  "5": { name: "MediaGroup Italia", sector: "Media",         employees: "200-500",revenue: "€20M",  website: "mediagroup.it",  vat: "IT56789012345" },
  "6": { name: "DigitalWave Srl",   sector: "Digital",       employees: "10-50",  revenue: "€800K", website: "digitalwave.it", vat: "IT67890123456" },
  "7": { name: "NexusLab",          sector: "Consulting",    employees: "50-200", revenue: "€3M",   website: "nexuslab.com",   vat: "IT78901234567" },
  "8": { name: "SmartFactory",      sector: "Manufacturing", employees: "200-500",revenue: "€15M",  website: "smartfactory.it",vat: "IT89012345678" },
};

const DEALS_BY_CONTACT: Record<string, Array<{ title: string; stage: string; value: number; probability: number; closeDate: string }>> = {
  "1": [
    { title: "Piattaforma e-commerce StartupIO", stage: "proposta",     value: 28000, probability: 60, closeDate: "2026-03-15" },
    { title: "Piano SEO StartupIO",              stage: "perso",         value: 6000,  probability: 0,  closeDate: "2026-02-01" },
  ],
  "2": [
    { title: "Migrazione cloud BigCorp",  stage: "negoziazione", value: 95000,  probability: 75, closeDate: "2026-04-01" },
    { title: "Consulenza AI BigCorp",     stage: "contatto",     value: 120000, probability: 20, closeDate: "2026-06-01" },
  ],
  "3": [{ title: "Redesign brand DesignStudio",  stage: "vinto",  value: 12000, probability: 100, closeDate: "2026-02-10" }],
  "4": [{ title: "App mobile InnovateIT",        stage: "contatto", value: 45000, probability: 30, closeDate: "2026-05-01" }],
  "5": [
    { title: "Campagna digital MediaGroup",  stage: "proposta", value: 18500, probability: 50, closeDate: "2026-03-20" },
    { title: "Portale dipendenti MediaGroup",stage: "nuovo",    value: 32000, probability: 10, closeDate: "2026-06-15" },
  ],
  "6": [{ title: "Sito web DigitalWave",  stage: "vinto", value: 8500,  probability: 100, closeDate: "2026-02-05" }],
  "7": [{ title: "Automazione NexusLab",  stage: "nuovo", value: 22000, probability: 15,  closeDate: "2026-05-20" }],
  "8": [{ title: "CRM integrato SmartFactory", stage: "negoziazione", value: 67000, probability: 80, closeDate: "2026-03-30" }],
};

const ACTIVITIES = [
  { id: 1, type: "email",   text: "Email inviata: Proposta commerciale piattaforma e-commerce",   date: "2026-02-18 14:30", user: "Marco R." },
  { id: 2, type: "call",    text: "Chiamata: Discussione requisiti tecnici — 25 min",              date: "2026-02-16 10:00", user: "Giulia B." },
  { id: 3, type: "note",    text: "Budget confermato €28K. Preferisce React + Node.js.",           date: "2026-02-15 16:45", user: "Marco R." },
  { id: 4, type: "meeting", text: "Meeting online: Presentazione demo prototipo",                 date: "2026-02-12 11:00", user: "Marco R." },
  { id: 5, type: "deal",    text: "Deal creata: Piattaforma e-commerce — €28.000",               date: "2026-01-20 09:00", user: "Marco R." },
  { id: 6, type: "email",   text: "Email ricevuta: Richiesta informazioni servizi",               date: "2026-01-18 08:15", user: "Sistema" },
  { id: 7, type: "note",    text: "Primo contatto via form sito. Interessata a soluzioni e-commerce per lancio Q2.", date: "2026-01-15 12:00", user: "Sara M." },
];

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  nuovo:        { label: "Nuovo",         color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/40" },
  contatto:     { label: "Contatto",      color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-950/30" },
  proposta:     { label: "Proposta",      color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/30" },
  negoziazione: { label: "Negoziazione",  color: "text-violet-600",  bg: "bg-violet-100 dark:bg-violet-950/30" },
  vinto:        { label: "Vinto",         color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/30" },
  perso:        { label: "Perso",         color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/30" },
};

const ACTIVITY_CONFIG: Record<string, { icon: React.ComponentType<{className?: string}>; color: string; bg: string }> = {
  email:   { icon: Mail,      color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-950/40" },
  call:    { icon: PhoneCall, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  note:    { icon: StickyNote,color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40" },
  meeting: { icon: Calendar,  color: "text-violet-600",  bg: "bg-violet-100 dark:bg-violet-950/40" },
  deal:    { icon: Briefcase, color: "text-teal-600",    bg: "bg-teal-100 dark:bg-teal-950/40" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const params   = useParams();
  const router   = useRouter();
  const id       = String(params?.id ?? "1");
  const contact  = CONTACTS.find(c => c.id === id) ?? CONTACTS[0];
  const company  = COMPANIES[contact.companyId];
  const deals    = DEALS_BY_CONTACT[contact.id] ?? [];
  const totalDealValue = deals.reduce((s, d) => s + d.value, 0);
  const wonDeals = deals.filter(d => d.stage === "vinto");
  const wonValue = wonDeals.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {/* Back */}
      <Button variant="ghost" size="sm" className="text-muted-foreground -ml-1" onClick={() => router.back()}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Clienti
      </Button>

      {/* Hero card */}
      <Card className="border-border/60 overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-indigo-600/20 via-violet-600/10 to-transparent" />
        <CardContent className="px-6 pb-6 pt-0 -mt-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="h-16 w-16 border-4 border-background shadow-md">
                <AvatarFallback className={cn("text-xl font-bold text-white", contact.color)}>
                  {contact.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{contact.name}</h2>
                  <Badge variant={contact.type === "cliente" ? "default" : "secondary"} className={cn("text-xs", contact.type === "cliente" && "bg-indigo-600 hover:bg-indigo-600")}>
                    {contact.type === "cliente" ? "Cliente" : "Lead"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{contact.role} · {contact.company}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"><PhoneCall className="mr-1.5 h-4 w-4" /> Chiama</Button>
              <Button variant="outline" size="sm"><Mail className="mr-1.5 h-4 w-4" /> Email</Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"><Pencil className="mr-1.5 h-4 w-4" /> Modifica</Button>
            </div>
          </div>

          {/* Quick info row */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5" /> {contact.email}
            </a>
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {contact.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {contact.city}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Ultimo contatto: {new Date(contact.lastContact).toLocaleDateString("it-IT")}
            </span>
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {contact.tags.map(t => (
                <span key={t} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground flex items-center gap-1">
                  <Tag className="h-2.5 w-2.5" /> {t}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── Left: tabs ─────────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Deal KPI mini-strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pipeline totale",  value: `€ ${(totalDealValue / 1000).toFixed(0)}K`, icon: TrendingUp,  color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
              { label: "Deal vinte",       value: String(wonDeals.length),                    icon: DollarSign,  color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
              { label: "Valore acquisito", value: `€ ${(wonValue / 1000).toFixed(0)}K`,       icon: CheckSquare, color: "text-teal-600",    bg: "bg-teal-50 dark:bg-teal-950/30" },
            ].map(k => (
              <div key={k.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", k.bg)}>
                  <k.icon className={cn("h-4 w-4", k.color)} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  <p className="text-base font-bold tabular-nums">{k.value}</p>
                </div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="activity">
            <TabsList className="h-9">
              <TabsTrigger value="activity" className="text-xs">Attività ({ACTIVITIES.length})</TabsTrigger>
              <TabsTrigger value="deals" className="text-xs">Deal ({deals.length})</TabsTrigger>
              <TabsTrigger value="quotes" className="text-xs">Preventivi</TabsTrigger>
            </TabsList>

            {/* Activity timeline */}
            <TabsContent value="activity" className="mt-3">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Timeline attività</CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Aggiungi
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[52px] top-4 bottom-4 w-px bg-border/60" />
                    <div className="divide-y divide-border/30">
                      {ACTIVITIES.map(act => {
                        const cfg = ACTIVITY_CONFIG[act.type] ?? ACTIVITY_CONFIG.note;
                        return (
                          <div key={act.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-background", cfg.bg)}>
                              <cfg.icon className={cn("h-3.5 w-3.5", cfg.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{act.text}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{act.date} · {act.user}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deals */}
            <TabsContent value="deals" className="mt-3">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Deal associate</CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Nuova deal</Button>
                </CardHeader>
                <CardContent className="p-0">
                  {deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-5 pb-4">Nessuna deal associata.</p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {deals.map((d, i) => {
                        const sc = STAGE_CONFIG[d.stage] ?? STAGE_CONFIG.nuovo;
                        return (
                          <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{d.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sc.color, "border-current/30")}>{sc.label}</Badge>
                                <span className="text-xs text-muted-foreground">Chiusura: {new Date(d.closeDate).toLocaleDateString("it-IT")}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold tabular-nums text-sm">€ {d.value.toLocaleString("it-IT")}</p>
                              <p className="text-xs text-muted-foreground">{d.probability}% prob.</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Quotes placeholder */}
            <TabsContent value="quotes" className="mt-3">
              <Card>
                <CardContent className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  <FileText className="h-5 w-5 mr-2 opacity-50" /> Sezione preventivi disponibile da questa schermatura
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Right: company + details ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Company card */}
          {company && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Azienda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center font-bold text-indigo-600">
                    {contact.company.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.sector} · {company.employees} dipendenti</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Fatturato",  value: company.revenue },
                    { label: "Website",    value: company.website },
                    { label: "P.IVA",      value: company.vat },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-medium">{r.value}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Vai all'azienda <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StickyNote className="h-4 w-4" /> Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">Budget confermato a €28K. Preferisce stack React + Node.js. Seguire entro metà marzo per aggiornamento fase 2.</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-indigo-600 px-0">
                <Pencil className="h-3 w-3 mr-1" /> Modifica nota
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming reminders */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Promemoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { text: "Scadenza preventivo PRV-2026-001", date: "10/03/2026", color: "text-amber-600" },
                { text: "Followup fase 2 e-commerce",       date: "15/03/2026", color: "text-indigo-600" },
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Calendar className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", r.color)} />
                  <div>
                    <p>{r.text}</p>
                    <p className="text-muted-foreground">{r.date}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs mt-1">
                <Plus className="h-3 w-3 mr-1" /> Aggiungi promemoria
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
