"use client";

import { useState } from "react";
import {
  Plus, Search, Mail, Phone, Building2, MoreHorizontal,
  UserPlus, Download, Upload, Globe, TrendingUp,
  ArrowUpRight, ArrowDownRight, Eye, Edit2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type UserStatus = "active" | "inactive";
type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
type LeadSource = "website" | "referral" | "linkedin" | "ads" | "event" | "other";

interface User {
  id:       string;
  name:     string;
  email:    string;
  phone:    string;
  role:     string;
  status:   UserStatus;
  company:  string;
  avatar:   string;
  joinedAt: string;
}

interface Lead {
  id:       string;
  name:     string;
  email:    string;
  phone:    string;
  company:  string;
  source:   LeadSource;
  status:   LeadStatus;
  score:    number;
  value:    number;
  avatar:   string;
  notes:    string;
  createdAt: string;
}

// ─── Demo data ──────────────────────────────────────────────────────────────

const DEMO_USERS: User[] = [
  { id: "u1", name: "Marco Rossi", email: "marco@techco.it", phone: "+39 333 1234567", role: "Designer", status: "active", company: "TechCo", avatar: "MR", joinedAt: "2025-06-15" },
  { id: "u2", name: "Giulia Bianchi", email: "giulia@techco.it", phone: "+39 334 2345678", role: "Developer", status: "active", company: "TechCo", avatar: "GB", joinedAt: "2025-03-20" },
  { id: "u3", name: "Luca Pellegrini", email: "luca@techco.it", phone: "+39 335 3456789", role: "Content Writer", status: "active", company: "TechCo", avatar: "LP", joinedAt: "2025-08-10" },
  { id: "u4", name: "Sara Moretti", email: "sara@techco.it", phone: "+39 336 4567890", role: "Backend Engineer", status: "active", company: "TechCo", avatar: "SM", joinedAt: "2025-01-05" },
  { id: "u5", name: "Andrea Conti", email: "andrea@techco.it", phone: "+39 337 5678901", role: "Project Manager", status: "inactive", company: "TechCo", avatar: "AC", joinedAt: "2024-11-12" },
  { id: "u6", name: "Valentina Ricci", email: "valentina@techco.it", phone: "+39 338 6789012", role: "Sales Manager", status: "active", company: "TechCo", avatar: "VR", joinedAt: "2025-09-01" },
];

const DEMO_LEADS: Lead[] = [
  { id: "l1", name: "Francesca Romano", email: "francesca@startup.io", phone: "+39 338 6789012", company: "StartupIO", source: "website", status: "qualified", score: 85, value: 12000, avatar: "FR", notes: "Interessata al piano Enterprise", createdAt: "2026-02-10" },
  { id: "l2", name: "Alessandro Galli", email: "ale@bigcorp.com", phone: "+39 339 7890123", company: "BigCorp SpA", source: "referral", status: "contacted", score: 72, value: 8500, avatar: "AG", notes: "Referral da cliente esistente", createdAt: "2026-02-08" },
  { id: "l3", name: "Elena Ferri", email: "elena@design.studio", phone: "+39 340 8901234", company: "DesignStudio", source: "linkedin", status: "proposal", score: 91, value: 25000, avatar: "EF", notes: "Demo completata, molto entusiasta", createdAt: "2026-01-28" },
  { id: "l4", name: "Roberto Mazza", email: "rob@innovate.it", phone: "+39 341 9012345", company: "InnovateIT", source: "event", status: "new", score: 63, value: 5000, avatar: "RM", notes: "Incontrato a WebSummit 2026", createdAt: "2026-02-14" },
  { id: "l5", name: "Chiara Lombardi", email: "chiara@mediagroup.it", phone: "+39 342 0123456", company: "MediaGroup", source: "ads", status: "contacted", score: 78, value: 15000, avatar: "CL", notes: "Lead da campagna Google Ads", createdAt: "2026-02-05" },
  { id: "l6", name: "Paolo Santini", email: "paolo@fintech.io", phone: "+39 343 1234567", company: "FinTech Solutions", source: "website", status: "won", score: 95, value: 32000, avatar: "PS", notes: "Contratto firmato", createdAt: "2026-01-15" },
  { id: "l7", name: "Maria Greco", email: "maria@retail.it", phone: "+39 344 2345678", company: "RetailPlus", source: "referral", status: "lost", score: 45, value: 7000, avatar: "MG", notes: "Ha scelto un concorrente", createdAt: "2026-01-20" },
  { id: "l8", name: "Davide Neri", email: "davide@logistica.it", phone: "+39 345 3456789", company: "LogisticaPro", source: "linkedin", status: "new", score: 58, value: 9000, avatar: "DN", notes: "Primo contatto via LinkedIn", createdAt: "2026-02-16" },
];

// ─── Config ─────────────────────────────────────────────────────────────────

const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string }> = {
  new:       { label: "Nuovo",      color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-100 dark:bg-sky-900/30" },
  contacted: { label: "Contattato", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  qualified: { label: "Qualificato",color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  proposal:  { label: "Proposta",   color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  won:       { label: "Vinto",      color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  lost:      { label: "Perso",      color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  website:  "Sito Web",
  referral: "Referral",
  linkedin: "LinkedIn",
  ads:      "Advertising",
  event:    "Evento",
  other:    "Altro",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [tab, setTab]               = useState<"users" | "leads">("users");
  const [search, setSearch]         = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [users, setUsers]           = useState(DEMO_USERS);
  const [leads, setLeads]           = useState(DEMO_LEADS);
  const [leadFilter, setLeadFilter] = useState<"all" | LeadStatus>("all");
  const { toast } = useToast();

  // ── Filters ──
  const filteredUsers = users.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredLeads = leads.filter((l) => {
    if (leadFilter !== "all" && l.status !== leadFilter) return false;
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Lead stats ──
  const pipelineValue = leads.filter((l) => !["won", "lost"].includes(l.status)).reduce((sum, l) => sum + l.value, 0);
  const wonValue      = leads.filter((l) => l.status === "won").reduce((sum, l) => sum + l.value, 0);
  const avgScore      = leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + l.score, 0) / leads.length) : 0;

  const deleteUser = (id: string) => {
    setUsers((us) => us.filter((u) => u.id !== id));
    toast({ title: "Utente rimosso" });
  };

  const deleteLead = (id: string) => {
    setLeads((ls) => ls.filter((l) => l.id !== id));
    toast({ title: "Lead rimosso" });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">CRM & Clienti</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestisci il tuo team e i potenziali clienti
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-4 w-4" /> Esporta
          </Button>
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <UserPlus className="mr-1.5 h-4 w-4" />
            {tab === "users" ? "Nuovo Utente" : "Nuovo Lead"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setSearch(""); }}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <TabsList>
            <TabsTrigger value="users">Utenti ({users.length})</TabsTrigger>
            <TabsTrigger value="leads">Lead ({leads.length})</TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === "users" ? "Cerca utenti..." : "Cerca lead..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {tab === "leads" && (
            <Select value={leadFilter} onValueChange={(v) => setLeadFilter(v as typeof leadFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ━━━ USERS TAB ━━━ */}
        <TabsContent value="users" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold text-sm">
                          {user.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400">{user.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={user.status === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0"
                          : "bg-muted text-muted-foreground border-0"
                        }
                      >
                        {user.status === "active" ? "Attivo" : "Inattivo"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit2 className="mr-2 h-4 w-4" /> Modifica</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteUser(user.id)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" /> Rimuovi
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {user.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" /> {user.company}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredUsers.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                Nessun utente trovato
              </div>
            )}
          </div>
        </TabsContent>

        {/* ━━━ LEADS TAB ━━━ */}
        <TabsContent value="leads" className="mt-4 space-y-4">

          {/* Lead stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-2xl font-bold">{leads.length}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Lead totali</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  €{(pipelineValue / 1000).toFixed(1)}k
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Pipeline attiva</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-1.5">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    €{(wonValue / 1000).toFixed(1)}k
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Vinti</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-2xl font-bold">{avgScore}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Score medio</p>
              </CardContent>
            </Card>
          </div>

          {/* Lead table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Azienda</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Valore</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Nessun lead trovato
                    </TableCell>
                  </TableRow>
                )}
                {filteredLeads.map((lead) => {
                  const sc = LEAD_STATUS_CONFIG[lead.status];
                  return (
                    <TableRow key={lead.id} className="group cursor-pointer" onClick={() => setSelectedLead(lead)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 text-xs font-bold">
                              {lead.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{lead.name}</div>
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" /> {lead.company}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{SOURCE_LABELS[lead.source]}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${sc.color} ${sc.bgColor}`}>
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={lead.score}
                            className={`h-1.5 w-12 ${lead.score >= 80 ? "[&>div]:bg-emerald-500" : lead.score >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-400"}`}
                          />
                          <span className={`text-xs font-bold ${lead.score >= 80 ? "text-emerald-600 dark:text-emerald-400" : lead.score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            {lead.score}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">€{lead.value.toLocaleString("it-IT")}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}>
                              <Eye className="mr-2 h-4 w-4" /> Dettagli
                            </DropdownMenuItem>
                            <DropdownMenuItem><Mail className="mr-2 h-4 w-4" /> Invia email</DropdownMenuItem>
                            <DropdownMenuItem><Phone className="mr-2 h-4 w-4" /> Chiama</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); deleteLead(lead.id); }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Sheet */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3 mb-1">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 text-lg font-bold">
                      {selectedLead.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle>{selectedLead.name}</SheetTitle>
                    <SheetDescription>{selectedLead.company}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Status & Score */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Stato</p>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${LEAD_STATUS_CONFIG[selectedLead.status].color} ${LEAD_STATUS_CONFIG[selectedLead.status].bgColor}`}>
                      {LEAD_STATUS_CONFIG[selectedLead.status].label}
                    </span>
                  </div>
                  <div className="flex-1 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Score</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{selectedLead.score}</span>
                      <Progress value={selectedLead.score} className="h-2 flex-1 [&>div]:bg-indigo-500" />
                    </div>
                  </div>
                </div>

                {/* Value */}
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Valore stimato</p>
                  <p className="text-2xl font-bold">€{selectedLead.value.toLocaleString("it-IT")}</p>
                </div>

                <Separator />

                {/* Contact info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Contatto</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" /> {selectedLead.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" /> {selectedLead.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4 shrink-0" /> {selectedLead.company}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-4 w-4 shrink-0" /> {SOURCE_LABELS[selectedLead.source]}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Note</h4>
                  <p className="text-sm text-muted-foreground">{selectedLead.notes || "Nessuna nota"}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
                    <Mail className="mr-1.5 h-4 w-4" /> Invia Email
                  </Button>
                  <Button variant="outline" className="flex-1" size="sm">
                    <Phone className="mr-1.5 h-4 w-4" /> Chiama
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{tab === "users" ? "Nuovo Utente" : "Nuovo Lead"}</DialogTitle>
            <DialogDescription>
              {tab === "users" ? "Aggiungi un nuovo membro al team." : "Aggiungi un nuovo lead al CRM."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input placeholder="Nome completo" />
              </div>
              <div className="grid gap-2">
                <Label>Email *</Label>
                <Input placeholder="email@esempio.it" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Telefono</Label>
                <Input placeholder="+39 ..." />
              </div>
              <div className="grid gap-2">
                <Label>{tab === "users" ? "Ruolo" : "Azienda"}</Label>
                <Input placeholder={tab === "users" ? "Es. Developer" : "Es. AcmeCorp"} />
              </div>
            </div>
            {tab === "leads" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Origine</Label>
                  <Select defaultValue="website">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Valore stimato</Label>
                  <Input placeholder="€" type="number" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annulla</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => { setShowCreate(false); toast({ title: tab === "users" ? "Utente creato" : "Lead creato" }); }}>
              Crea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
