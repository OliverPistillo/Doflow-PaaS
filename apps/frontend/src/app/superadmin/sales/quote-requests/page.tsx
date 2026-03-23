// apps/frontend/src/app/superadmin/sales/quote-requests/page.tsx
// Pagina CRM per la gestione delle richieste di preventivo
// ricevute dal sito web pubblico.
//
// Funzionalità:
// - Tabella con tutte le richieste ordinate per data
// - Filtri per stato e ricerca testuale
// - Cambio stato inline (Nuova → In lavorazione → Preventivo inviato → Archiviata)
// - Download zip degli allegati con un clic
// - Eliminazione file / eliminazione completa
// - Pannello laterale con dettagli e note admin

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
  ChevronDown,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
}> = {
  nuova: {
    label: "Nuova",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  in_lavorazione: {
    label: "In lavorazione",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  preventivo_inviato: {
    label: "Preventivo inviato",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    dotColor: "bg-green-500",
  },
  archiviata: {
    label: "Archiviata",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
    dotColor: "bg-slate-400",
  },
};

const ALL_STATUSES: QuoteRequestStatus[] = [
  "nuova", "in_lavorazione", "preventivo_inviato", "archiviata",
];

// ── Helper: Formatta data in italiano ───────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Componente Pagina ───────────────────────────────────────────────────────

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
      const url = `/superadmin/quote-requests${qs ? `?${qs}` : ""}`;
      const res = await apiFetch<QuoteRequest[]>(url);
      setRequests(res);
    } catch (e) {
      console.error("Errore caricamento richieste:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ── Debounce della ricerca ────────────────────────────────────────────
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

  /** Cambio stato rapido */
  const handleStatusChange = async (id: string, newStatus: QuoteRequestStatus) => {
    try {
      await apiFetch(`/superadmin/quote-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      // Aggiorniamo localmente senza ricaricare tutto
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      // Aggiorniamo anche il pannello laterale se aperto
      if (selectedRequest?.id === id) {
        setSelectedRequest((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error("Errore cambio stato:", e);
      alert("Errore durante il cambio di stato");
    }
  };

  /** Download zip degli allegati */
  const handleDownload = async (id: string) => {
    setDownloading(id);
    try {
      const baseUrl = getApiBaseUrl();
      const token = window.localStorage.getItem("doflow_token");
      const res = await fetch(`${baseUrl}/superadmin/quote-requests/${id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      // Estraiamo il nome file dall'header Content-Disposition
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? `preventivo_${id}.zip`;

      // Scarichiamo il blob e triggeriamo il download
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

  /** Elimina solo i file da MinIO */
  const handleDeleteFiles = async (id: string) => {
    const ok = await confirm({
      title: "Eliminare i file allegati?",
      description:
        "I file verranno rimossi definitivamente dallo storage. I dati testuali della richiesta rimarranno nel database.",
      confirmLabel: "Elimina file",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await apiFetch(`/superadmin/quote-requests/${id}/files`, {
        method: "DELETE",
      });
      // Aggiorna localmente
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, filesCount: 0, minioPrefix: null } : r
        )
      );
      if (selectedRequest?.id === id) {
        setSelectedRequest((prev) =>
          prev ? { ...prev, filesCount: 0, minioPrefix: null } : null
        );
      }
    } catch (e) {
      console.error("Errore eliminazione file:", e);
      alert("Errore durante l'eliminazione dei file");
    }
  };

  /** Elimina richiesta completa */
  const handleDeleteRequest = async (id: string) => {
    const ok = await confirm({
      title: "Eliminare questa richiesta?",
      description:
        "L'intera richiesta verrà eliminata dal database e i file allegati rimossi dallo storage. Operazione irreversibile.",
      confirmLabel: "Elimina tutto",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await apiFetch(`/superadmin/quote-requests/${id}`, {
        method: "DELETE",
      });
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (selectedRequest?.id === id) {
        setIsDetailOpen(false);
        setSelectedRequest(null);
      }
    } catch (e) {
      console.error("Errore eliminazione richiesta:", e);
      alert("Errore durante l'eliminazione");
    }
  };

  /** Salva note admin */
  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    setSavingNotes(true);
    try {
      await apiFetch(`/superadmin/quote-requests/${selectedRequest.id}`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes }),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id ? { ...r, adminNotes } : r
        )
      );
      setSelectedRequest((prev) => prev ? { ...prev, adminNotes } : null);
    } catch (e) {
      console.error("Errore salvataggio note:", e);
    } finally {
      setSavingNotes(false);
    }
  };

  /** Apri pannello dettaglio */
  const openDetail = (request: QuoteRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.adminNotes || "");
    setIsDetailOpen(true);
  };

  // ── Conteggi per badge filtri ──────────────────────────────────────────

  const countByStatus = (status: QuoteRequestStatus) =>
    requests.filter((r) => r.status === status).length;
  const newCount = countByStatus("nuova");

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content animate-fadeIn">
      <ConfirmDialog />

      {/* ── Barra filtri ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Ricerca */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email, azienda..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtro stato */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${STATUS_CONFIG[s].dotColor}`} />
                  {STATUS_CONFIG[s].label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Refresh */}
        <Button
          variant="outline"
          size="icon"
          onClick={loadRequests}
          disabled={loading}
          title="Aggiorna"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
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
                  <tr
                    key={req.id}
                    className="hover:bg-muted/30 group transition-colors cursor-pointer"
                    onClick={() => openDetail(req)}
                  >
                    {/* Cliente */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{req.clientName}</div>
                      <div className="text-xs text-muted-foreground">{req.clientEmail}</div>
                      {req.companyName && (
                        <div className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {req.companyName}
                        </div>
                      )}
                    </td>

                    {/* Oggetto */}
                    <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate">
                      {req.subject || <span className="italic text-muted-foreground/50">—</span>}
                    </td>

                    {/* Stato */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium border-0 ${statusCfg.badgeClass}`}
                      >
                        <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${statusCfg.dotColor}`} />
                        {statusCfg.label}
                      </Badge>
                    </td>

                    {/* File allegati */}
                    <td className="px-4 py-3 text-center">
                      {req.filesCount > 0 ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Paperclip className="h-3 w-3" />
                          {req.filesCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateShort(req.createdAt)}
                    </td>

                    {/* Azioni */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openDetail(req)}>
                            <Eye className="mr-2 h-4 w-4" /> Vedi dettagli
                          </DropdownMenuItem>

                          {req.filesCount > 0 && (
                            <DropdownMenuItem onClick={() => handleDownload(req.id)}>
                              <Download className="mr-2 h-4 w-4" /> Scarica allegati (.zip)
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          {/* Cambio stato rapido */}
                          {ALL_STATUSES.filter((s) => s !== req.status).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => handleStatusChange(req.id, s)}
                            >
                              <div className={`h-2 w-2 rounded-full mr-2 ${STATUS_CONFIG[s].dotColor}`} />
                              Segna come: {STATUS_CONFIG[s].label}
                            </DropdownMenuItem>
                          ))}

                          <DropdownMenuSeparator />

                          {req.filesCount > 0 && (
                            <DropdownMenuItem
                              className="text-amber-600 focus:text-amber-600 focus:bg-amber-50"
                              onClick={() => handleDeleteFiles(req.id)}
                            >
                              <FolderX className="mr-2 h-4 w-4" /> Elimina solo file
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleDeleteRequest(req.id)}
                          >
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

          {/* Footer con conteggio */}
          <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
            {requests.length} {requests.length === 1 ? "richiesta" : "richieste"} totali
          </div>
        </div>
      )}

      {/* ── Pannello Laterale Dettaglio ───────────────────────────────── */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedRequest && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-lg">
                  Richiesta di {selectedRequest.clientName}
                </SheetTitle>
                <SheetDescription>
                  Ricevuta il {formatDate(selectedRequest.createdAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                {/* Stato */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Stato
                  </label>
                  <Select
                    value={selectedRequest.status}
                    onValueChange={(v) =>
                      handleStatusChange(selectedRequest.id, v as QuoteRequestStatus)
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${STATUS_CONFIG[s].dotColor}`} />
                            {STATUS_CONFIG[s].label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Info cliente */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Dati cliente
                  </label>

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={`mailto:${selectedRequest.clientEmail}`}
                        className="text-primary hover:underline"
                      >
                        {selectedRequest.clientEmail}
                      </a>
                    </div>

                    {selectedRequest.clientPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a
                          href={`tel:${selectedRequest.clientPhone}`}
                          className="text-primary hover:underline"
                        >
                          {selectedRequest.clientPhone}
                        </a>
                      </div>
                    )}

                    {selectedRequest.companyName && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{selectedRequest.companyName}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {formatDate(selectedRequest.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Oggetto */}
                {selectedRequest.subject && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Oggetto
                    </label>
                    <p className="mt-1 text-sm font-medium">{selectedRequest.subject}</p>
                  </div>
                )}

                {/* Messaggio */}
                {selectedRequest.message && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Messaggio
                    </label>
                    <div className="mt-1.5 rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                      {selectedRequest.message}
                    </div>
                  </div>
                )}

                {/* File allegati */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    File allegati
                  </label>
                  <div className="mt-1.5">
                    {selectedRequest.filesCount > 0 ? (
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="gap-1.5 py-1">
                          <Paperclip className="h-3.5 w-3.5" />
                          {selectedRequest.filesCount}{" "}
                          {selectedRequest.filesCount === 1 ? "file" : "file"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => handleDownload(selectedRequest.id)}
                          disabled={downloading === selectedRequest.id}
                        >
                          {downloading === selectedRequest.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <HardDriveDownload className="h-3.5 w-3.5" />
                          )}
                          Scarica .zip
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => handleDeleteFiles(selectedRequest.id)}
                        >
                          <FolderX className="h-3.5 w-3.5" />
                          Elimina
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">
                        Nessun file allegato
                      </p>
                    )}
                  </div>
                </div>

                {/* Note Admin */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Note interne (solo admin)
                  </label>
                  <Textarea
                    className="mt-1.5 min-h-[100px]"
                    placeholder="Aggiungi note sulla richiesta..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || adminNotes === (selectedRequest.adminNotes || "")}
                  >
                    {savingNotes ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    Salva note
                  </Button>
                </div>

                {/* Metadati tecnici */}
                <div className="border-t pt-4">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Info tecniche
                  </label>
                  <div className="mt-1.5 text-xs text-muted-foreground/70 space-y-1 font-mono">
                    <p>ID: {selectedRequest.id}</p>
                    {selectedRequest.minioPrefix && (
                      <p>MinIO: {selectedRequest.minioPrefix}</p>
                    )}
                    {selectedRequest.sourceIp && (
                      <p>IP: {selectedRequest.sourceIp}</p>
                    )}
                    {selectedRequest.sourceOrigin && (
                      <p>Origin: {selectedRequest.sourceOrigin}</p>
                    )}
                  </div>
                </div>

                {/* Azioni distruttive */}
                <div className="border-t pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => handleDeleteRequest(selectedRequest.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Elimina richiesta completa
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}