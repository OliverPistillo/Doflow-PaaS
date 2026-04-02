// apps/frontend/src/app/superadmin/sales/quote-requests/page.tsx
// Pagina CRM per la gestione delle richieste di preventivo
// ricevute dal sito web pubblico.
//
// REDESIGN v2: Pannello dettaglio con Tabs (Scheda Richiesta, Brief, Allegati, Note)
// ispirato alla scheda lead di Federica Nerone con layout a griglia,
// badge colorati, azioni rapide e sezioni organizzate.

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Download,
  Trash2,
  FileText,
  Search,
  Loader2,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Paperclip,
  Mail,
  Phone,
  Building2,
  Calendar,
  MessageSquare,
  X,
  HardDriveDownload,
  FolderX,
  Globe,
  MapPin,
  Clock,
  Hash,
  Server,
  ExternalLink,
  Copy,
  CheckCircle2,
  ArrowRight,
  Inbox,
  Send,
  Archive,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";

// ── Tipi ────────────────────────────────────────────────────────────────────

type QuoteRequestStatus = "nuova" | "in_lavorazione" | "preventivo_inviato" | "archiviata";

interface QuoteRequest {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  companyName: string | null;
  subject: string | null;
  message: string | null;
  minioPrefix: string | null;
  filesCount: number;
  status: QuoteRequestStatus;
  adminNotes: string | null;
  sourceIp: string | null;
  sourceOrigin: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Configurazione stati ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuoteRequestStatus, {
  label: string;
  badgeClass: string;
  dotColor: string;
  icon: React.ElementType;
}> = {
  nuova: {
    label: "Nuova",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    dotColor: "bg-blue-500",
    icon: Sparkles,
  },
  in_lavorazione: {
    label: "In lavorazione",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    dotColor: "bg-amber-500",
    icon: Clock,
  },
  preventivo_inviato: {
    label: "Preventivo inviato",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    dotColor: "bg-green-500",
    icon: Send,
  },
  archiviata: {
    label: "Archiviata",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
    dotColor: "bg-slate-400",
    icon: Archive,
  },
};

const ALL_STATUSES: QuoteRequestStatus[] = [
  "nuova", "in_lavorazione", "preventivo_inviato", "archiviata",
];

// ── Helper: Formattazione date ──────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + "min fa";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h fa";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "g fa";
  return formatDateShort(iso);
}

// ── Componente Campo Informativo ────────────────────────────────────────────

function InfoField({ 
  label, value, icon: Icon, href, badge, badgeClass, copyable 
}: { 
  label: string;
  value: string | null | undefined;
  icon?: React.ElementType;
  href?: string;
  badge?: boolean;
  badgeClass?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!value) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <div className="flex items-center gap-2">
        {badge ? (
          <Badge variant="outline" className={"text-xs font-medium border-0 px-2.5 py-1 " + (badgeClass || "")}>
            {value}
          </Badge>
        ) : href ? (
          <a
            href={href}
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {value}
            {href.startsWith("http") && <ExternalLink className="h-3 w-3" />}
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground">{value}</p>
        )}
        {copyable && (
          <button
            onClick={handleCopy}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title="Copia"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Componente Timeline Stato ───────────────────────────────────────────────

function StatusTimeline({ current }: { current: QuoteRequestStatus }) {
  const steps: { key: QuoteRequestStatus; label: string }[] = [
    { key: "nuova", label: "Nuova" },
    { key: "in_lavorazione", label: "In lavorazione" },
    { key: "preventivo_inviato", label: "Inviato" },
    { key: "archiviata", label: "Archiviata" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, i) => {
        const isCompleted = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={"h-2.5 w-full rounded-full transition-colors " + (
                  isCompleted
                    ? isCurrent
                      ? "bg-primary"
                      : "bg-primary/40"
                    : "bg-muted"
                )}
              />
              <span className={"text-[10px] font-medium " + (isCurrent ? "text-primary" : "text-muted-foreground/60")}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className={"h-3 w-3 shrink-0 mt-[-14px] " + (i < currentIdx ? "text-primary/40" : "text-muted-foreground/20")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Componente Parser Brief ─────────────────────────────────────────────────

function BriefSection({ message }: { message: string | null }) {
  if (!message) {
    return (
      <p className="text-sm text-muted-foreground/60 italic py-8 text-center">
        Nessun brief fornito dal cliente
      </p>
    );
  }

  // Parsing delle sezioni del brief strutturato
  const sections: { title: string; content: string }[] = [];
  const lines = message.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "--- BRIEF PROGETTO ---") continue;

    if (/^[A-Z\u00C0-\u00DC\s\/()]+:$/.test(trimmed)) {
      if (currentTitle && currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = trimmed.replace(/:$/, "");
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  }
  if (currentTitle && currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message}</p>
      </div>
    );
  }

  const sectionIcons: Record<string, React.ElementType> = {
    "CHI SIETE E COSA FATE": Building2,
    "PUNTI DI FORZA": Sparkles,
    "OBIETTIVO PRINCIPALE": CheckCircle2,
    "PAGINE RICHIESTE": FileText,
    "SITI DI ISPIRAZIONE": Globe,
    "COLORI AZIENDALI": Sparkles,
    "RECENSIONI/TESTIMONIANZE": MessageSquare,
  };

  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const IconComp = sectionIcons[section.title] || FileText;
        return (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <IconComp className="h-3.5 w-3.5 text-primary" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h4>
            </div>
            <p className="text-sm leading-relaxed pl-9 whitespace-pre-wrap">
              {section.content}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PAGINA PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════

export default function QuoteRequestsPage() {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<QuoteRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const { ConfirmDialog, confirm } = useConfirm();

  // ── Caricamento dati ──────────────────────────────────────────────────

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      const qs = params.toString();
      const url = "/superadmin/quote-requests" + (qs ? "?" + qs : "");
      const res = await apiFetch<QuoteRequest[]>(url);
      setRequests(res);
    } catch (e) {
      console.error("Errore caricamento richieste:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch]);

  // ── Azioni ────────────────────────────────────────────────────────────

  const handleStatusChange = async (id: string, newStatus: QuoteRequestStatus) => {
    try {
      await apiFetch("/superadmin/quote-requests/" + id, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      if (selectedRequest?.id === id) {
        setSelectedRequest((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error("Errore cambio stato:", e);
      alert("Errore durante il cambio di stato");
    }
  };

  const handleDownload = async (id: string) => {
    setDownloading(id);
    try {
      const baseUrl = getApiBaseUrl();
      const token = window.localStorage.getItem("doflow_token");
      const res = await fetch(baseUrl + "/superadmin/quote-requests/" + id + "/download", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "HTTP " + res.status);
      }
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition ? disposition.match(/filename="(.+)"/) : null;
      const filename = match ? match[1] : "preventivo_" + id + ".zip";
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Errore download:", e);
      alert("Errore durante il download dei file");
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteFiles = async (id: string) => {
    const ok = await confirm({
      title: "Eliminare i file allegati?",
      description: "I file verranno rimossi dallo storage. I dati testuali rimarranno nel database.",
      confirmLabel: "Elimina file",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch("/superadmin/quote-requests/" + id + "/files", { method: "DELETE" });
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, filesCount: 0, minioPrefix: null } : r));
      if (selectedRequest?.id === id) {
        setSelectedRequest((prev) => prev ? { ...prev, filesCount: 0, minioPrefix: null } : null);
      }
    } catch (e) {
      console.error("Errore eliminazione file:", e);
      alert("Errore durante l'eliminazione dei file");
    }
  };

  const handleDeleteRequest = async (id: string) => {
    const ok = await confirm({
      title: "Eliminare questa richiesta?",
      description: "L'intera richiesta e i file verranno eliminati. Operazione irreversibile.",
      confirmLabel: "Elimina tutto",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch("/superadmin/quote-requests/" + id, { method: "DELETE" });
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (selectedRequest?.id === id) {
        setIsDetailOpen(false);
        setSelectedRequest(null);
      }
    } catch (e) {
      console.error("Errore eliminazione richiesta:", e);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    setSavingNotes(true);
    try {
      await apiFetch("/superadmin/quote-requests/" + selectedRequest.id, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes }),
      });
      setRequests((prev) => prev.map((r) => r.id === selectedRequest.id ? { ...r, adminNotes } : r));
      setSelectedRequest((prev) => prev ? { ...prev, adminNotes } : null);
    } catch (e) {
      console.error("Errore salvataggio note:", e);
    } finally {
      setSavingNotes(false);
    }
  };

  const openDetail = (request: QuoteRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.adminNotes || "");
    setIsDetailOpen(true);
  };

  const newCount = requests.filter((r) => r.status === "nuova").length;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="dashboard-content animate-fadeIn">
      <ConfirmDialog />

      {/* ── Barra filtri ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email, azienda..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery("")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <div className="flex items-center gap-2">
                  <div className={"h-2 w-2 rounded-full " + STATUS_CONFIG[s].dotColor} />
                  {STATUS_CONFIG[s].label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={loadRequests} disabled={loading} title="Aggiorna">
          <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
        </Button>
      </div>

      {/* ── Contatore nuove ──────────────────────────────────────────── */}
      {newCount > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-muted-foreground">
            <strong className="text-foreground">{newCount}</strong>{" "}
            {newCount === 1 ? "nuova richiesta" : "nuove richieste"} da visionare
          </span>
        </div>
      )}

      {/* ── Tabella ──────────────────────────────────────────────────── */}
      {loading && requests.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary h-6 w-6" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessuna richiesta trovata</p>
        </div>
      ) : (
        <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Oggetto</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium text-center">File</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 text-right w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status];
                return (
                  <tr key={req.id} className="hover:bg-muted/30 group transition-colors cursor-pointer" onClick={() => openDetail(req)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{req.clientName}</div>
                      <div className="text-xs text-muted-foreground">{req.clientEmail}</div>
                      {req.companyName && (
                        <div className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" /> {req.companyName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate">
                      {req.subject || <span className="italic text-muted-foreground/50">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={"text-xs font-medium border-0 " + statusCfg.badgeClass}>
                        <div className={"h-1.5 w-1.5 rounded-full mr-1.5 " + statusCfg.dotColor} />
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {req.filesCount > 0 ? (
                        <Badge variant="secondary" className="text-xs gap-1"><Paperclip className="h-3 w-3" />{req.filesCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{timeAgo(req.createdAt)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openDetail(req)}><Eye className="mr-2 h-4 w-4" /> Vedi dettagli</DropdownMenuItem>
                          {req.filesCount > 0 && (
                            <DropdownMenuItem onClick={() => handleDownload(req.id)}><Download className="mr-2 h-4 w-4" /> Scarica allegati (.zip)</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {ALL_STATUSES.filter((s) => s !== req.status).map((s) => (
                            <DropdownMenuItem key={s} onClick={() => handleStatusChange(req.id, s)}>
                              <div className={"h-2 w-2 rounded-full mr-2 " + STATUS_CONFIG[s].dotColor} /> Segna come: {STATUS_CONFIG[s].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          {req.filesCount > 0 && (
                            <DropdownMenuItem className="text-amber-600 focus:text-amber-600 focus:bg-amber-50" onClick={() => handleDeleteFiles(req.id)}>
                              <FolderX className="mr-2 h-4 w-4" /> Elimina solo file
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDeleteRequest(req.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Elimina richiesta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
            {requests.length} {requests.length === 1 ? "richiesta" : "richieste"} totali
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PANNELLO LATERALE DETTAGLIO — TABS STILE SCHEDA LEAD             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 overflow-y-auto">
          {selectedRequest && (() => {
            const req = selectedRequest;
            const statusCfg = STATUS_CONFIG[req.status];
            const StatusIcon = statusCfg.icon;

            return (
              <div className="flex flex-col h-full">

                {/* ── HEADER: Nome + Stato + Azioni ─────────────────────── */}
                <div className="p-6 pb-4 border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-foreground truncate">
                        {req.clientName}
                      </h2>
                      {req.companyName && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {req.companyName}
                        </p>
                      )}
                    </div>
                    <Button variant="destructive" size="sm" className="shrink-0" onClick={() => handleDeleteRequest(req.id)}>
                      Elimina Richiesta
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Select value={req.status} onValueChange={(v) => handleStatusChange(req.id, v as QuoteRequestStatus)}>
                      <SelectTrigger className="w-[200px] h-9">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((s) => {
                          const cfg = STATUS_CONFIG[s];
                          const SIcon = cfg.icon;
                          return (
                            <SelectItem key={s} value={s}>
                              <div className="flex items-center gap-2"><SIcon className="h-3.5 w-3.5" /> {cfg.label}</div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    <Badge variant="outline" className="text-xs border-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      <Globe className="h-3 w-3 mr-1" /> Sito Web
                    </Badge>

                    <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                      <Calendar className="h-3 w-3" /> {formatDate(req.createdAt)}
                    </span>
                  </div>

                  <StatusTimeline current={req.status} />
                </div>

                {/* ── TABS ───────────────────────────────────────────────── */}
                <Tabs defaultValue="scheda" className="flex-1">
                  <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-6">
                    <TabsTrigger value="scheda" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium">
                      Scheda Richiesta
                    </TabsTrigger>
                    <TabsTrigger value="brief" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium">
                      Brief Progetto
                    </TabsTrigger>
                    <TabsTrigger value="allegati" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium relative">
                      Allegati
                      {req.filesCount > 0 && (
                        <span className="ml-1.5 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {req.filesCount}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="note" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium">
                      Note Admin
                    </TabsTrigger>
                  </TabsList>

                  {/* ─── TAB 1: Scheda Richiesta ────────────────────────── */}
                  <TabsContent value="scheda" className="p-6 space-y-6 mt-0">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-4 flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" /> Contatti
                      </h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <InfoField label="Email" icon={Mail} value={req.clientEmail} href={"mailto:" + req.clientEmail} copyable />
                        <InfoField label="Telefono" icon={Phone} value={req.clientPhone} href={req.clientPhone ? "tel:" + req.clientPhone : undefined} copyable />
                        <InfoField label="Azienda" icon={Building2} value={req.companyName} />
                        <InfoField label="Oggetto" icon={FileText} value={req.subject} />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-4 flex items-center gap-2">
                        <Send className="h-3.5 w-3.5" /> Azioni Rapide
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {req.clientEmail && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={"mailto:" + req.clientEmail + "?subject=Re: " + (req.subject || "Richiesta preventivo")}>
                              <Mail className="h-3.5 w-3.5 mr-1.5" /> Rispondi via Email
                            </a>
                          </Button>
                        )}
                        {req.clientPhone && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={"https://wa.me/" + req.clientPhone.replace(/[^0-9+]/g, "")} target="_blank" rel="noopener noreferrer">
                              <Phone className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                            </a>
                          </Button>
                        )}
                        {req.filesCount > 0 && (
                          <Button variant="outline" size="sm" onClick={() => handleDownload(req.id)} disabled={downloading === req.id}>
                            {downloading === req.id
                              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              : <HardDriveDownload className="h-3.5 w-3.5 mr-1.5" />
                            }
                            Scarica Allegati .zip
                          </Button>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-4 flex items-center gap-2">
                        <Server className="h-3.5 w-3.5" /> Info Tecniche
                      </h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <InfoField label="ID Richiesta" icon={Hash} value={req.id.slice(0, 8) + "..."} copyable />
                        <InfoField label="Data Ricezione" icon={Calendar} value={formatDate(req.createdAt)} />
                        <InfoField label="Ultimo Aggiornamento" icon={Clock} value={formatDate(req.updatedAt)} />
                        <InfoField label="IP Sorgente" icon={MapPin} value={req.sourceIp} />
                        <InfoField label="Origine" icon={Globe} value={req.sourceOrigin} />
                        {req.minioPrefix && <InfoField label="Storage Path" icon={Server} value={req.minioPrefix} />}
                      </div>
                    </div>
                  </TabsContent>

                  {/* ─── TAB 2: Brief Progetto ──────────────────────────── */}
                  <TabsContent value="brief" className="p-6 mt-0">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-4 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" /> Brief del Cliente
                    </h3>
                    <BriefSection message={req.message} />
                  </TabsContent>

                  {/* ─── TAB 3: Allegati ─────────────────────────────────── */}
                  <TabsContent value="allegati" className="p-6 mt-0">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-4 flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5" /> File Allegati
                    </h3>

                    {req.filesCount > 0 ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-card p-5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Paperclip className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">
                                {req.filesCount} {req.filesCount === 1 ? "file allegato" : "file allegati"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Salvati su MinIO
                              </p>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleDownload(req.id)} disabled={downloading === req.id}>
                            {downloading === req.id
                              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                              : <HardDriveDownload className="h-4 w-4 mr-1.5" />
                            }
                            Scarica .zip
                          </Button>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Elimina file dallo storage</p>
                            <p className="text-xs text-amber-600/80 dark:text-amber-500/60">I dati testuali rimarranno nel database</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-400"
                            onClick={() => handleDeleteFiles(req.id)}
                          >
                            <FolderX className="h-3.5 w-3.5 mr-1.5" /> Elimina file
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Paperclip className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground/60">Nessun file allegato a questa richiesta</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* ─── TAB 4: Note Admin ────────────────────────────────── */}
                  <TabsContent value="note" className="p-6 mt-0">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-4 flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5" /> Note Interne (solo admin)
                    </h3>
                    <Textarea
                      className="min-h-[180px] text-sm"
                      placeholder="Aggiungi note, appunti o considerazioni su questa richiesta..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-muted-foreground/50">
                        Queste note sono visibili solo agli amministratori
                      </p>
                      <Button
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={savingNotes || adminNotes === (req.adminNotes || "")}
                      >
                        {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                        Salva note
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}