// apps/frontend/src/app/superadmin/system/components/tab-audit.tsx
// Estratto da ex /superadmin/audit/page.tsx e adattato come componente tab.

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Search, ShieldAlert, Filter } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId: string;
  tenantId: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  CREATE:  "bg-emerald-100 text-emerald-700",
  UPDATE:  "bg-blue-100    text-blue-700",
  DELETE:  "bg-red-100     text-red-700",
  LOGIN:   "bg-violet-100  text-violet-700",
  LOGOUT:  "bg-slate-100   text-slate-600",
  EXPORT:  "bg-amber-100   text-amber-700",
};

function ActionBadge({ action }: { action: string }) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  const cls = key ? ACTION_COLORS[key] : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border-0 ${cls}`}>
      {action}
    </span>
  );
}

// ─── TabAudit ─────────────────────────────────────────────────────────────────

export function TabAudit() {
  const [data, setData]             = useState<AuditEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search)                  params.set("q",      search);
      if (actionFilter !== "all")  params.set("action", actionFilter);

      const res = await apiFetch<AuditResponse>(`/superadmin/audit?${params}`);
      setData(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => { load(); }, [load]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, actionFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per utente, entità, azione…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue placeholder="Tutte le azioni" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le azioni</SelectItem>
              <SelectItem value="CREATE">CREATE</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="LOGIN">LOGIN</SelectItem>
              <SelectItem value="LOGOUT">LOGOUT</SelectItem>
              <SelectItem value="EXPORT">EXPORT</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Aggiorna</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="glass-card border-none overflow-hidden">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Audit Log
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {total > 0 ? `${total} eventi totali` : "Nessun evento"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {loading && data.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <ShieldAlert className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nessun evento trovato</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Azione</TableHead>
                  <TableHead>Entità</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Tenant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(entry.createdAt), {
                        addSuffix: true,
                        locale: it,
                      })}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{entry.entityType}</span>
                      {entry.entityId && (
                        <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                          #{entry.entityId.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-xs truncate max-w-[140px]">
                      {entry.userId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {entry.tenantId}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {page} di {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Successiva
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
