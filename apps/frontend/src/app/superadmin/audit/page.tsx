"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity, Search, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications"; // <--- 1. Import Hook
import { Badge } from "@/components/ui/badge";

type AuditRow = {
  id: string;
  action: string;
  actor_email?: string | null;
  actor_role?: string | null;
  target_email?: string | null;
  ip?: string | null;
  metadata?: any; // JSONB
  created_at: string; // ISO
};

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function severityOf(action: string): "ok" | "warn" | "danger" | "info" {
  const a = (action || "").toUpperCase();

  // Danger
  if (a.includes("FAILED") || a.includes("DENIED") || a.includes("BLOCK") || a.includes("ERROR")) return "danger";
  if (a.includes("RESET_PASSWORD") || a.includes("IMPERSONATE") || a.includes("DELETE")) return "danger";

  // Warn
  if (a.includes("SUSPEND") || a.includes("DISABLE") || a.includes("REVOKE")) return "warn";

  // OK
  if (a.includes("SUCCESS") || a.includes("CREATED") || a.includes("UPDATED") || a.includes("UPLOAD")) return "ok";

  return "info";
}

function ActionBadge({ action }: { action: string }) {
  const s = severityOf(action);
  const cls =
    s === "danger"
      ? "bg-red-50 border-red-200 text-red-700"
      : s === "warn"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : s === "ok"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : "bg-slate-100 border-slate-200 text-slate-700";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black border ${cls}`}>
      {action}
    </span>
  );
}

function DegradedBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-4 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-black text-slate-900">Degraded</div>
          <div className="text-sm text-slate-700 mt-1">{message}</div>
          <div className="mt-3">
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> Riprova
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openMeta, setOpenMeta] = useState<Record<string, boolean>>({});

  // 2. Hook WebSocket
  const { events, connected } = useNotifications();

  const load = async () => {
    setLoading(true);
    setDegraded(null);

    try {
      const data = await apiFetch<{ logs: AuditRow[] }>("/superadmin/audit", { method: "GET" });
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e: any) {
      setLogs([]);
      setDegraded(e?.message || "Audit API non disponibile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 3. Ascolto Eventi Real-time e aggiornamento tabella
  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (lastEvent?.type === 'tenant_notification' && (lastEvent.payload as any).type === 'activity_feed_update') {
        const newLog = (lastEvent.payload as any).payload as AuditRow;
        
        // Aggiungi in cima alla lista (senza duplicati)
        setLogs((prev) => {
            if (prev.find(l => l.id === newLog.id)) return prev;
            return [newLog, ...prev];
        });
    }
  }, [events]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return logs;

    return logs.filter((r) => {
      const hay = [
        r.action,
        r.actor_email ?? "",
        r.actor_role ?? "",
        r.target_email ?? "",
        r.ip ?? "",
        typeof r.metadata === "string" ? r.metadata : JSON.stringify(r.metadata ?? {}),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [logs, q]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Audit Log Globale
             {/* Indicatore Live */}
             {connected && (
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1 animate-pulse">
                    <Zap className="h-3 w-3 fill-current" /> Live
                </Badge>
             )}
          </h1>
          <p className="text-slate-500 font-medium">Sicurezza, operazioni critiche e mutazioni di sistema.</p>
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      {degraded && <DegradedBanner message={degraded} onRetry={load} />}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca azione, email, ruolo, IP, meta..."
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>

          <div className="text-xs text-slate-400 font-medium">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Activity className="h-4 w-4 animate-spin" /> Caricamento...
              </span>
            ) : (
              `${filtered.length} record`
            )}
          </div>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Azione</th>
              <th className="px-6 py-4">Actor</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Target</th>
              <th className="px-6 py-4">IP</th>
              <th className="px-6 py-4">Meta</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Activity className="h-4 w-4 animate-spin" /> Caricamento log...
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-400">
                  Nessun log trovato.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isOpen = !!openMeta[r.id];
                const metaStr = JSON.stringify(r.metadata ?? {}, null, 2);

                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {formatTs(r.created_at)}
                    </td>

                    <td className="px-6 py-4">
                      <ActionBadge action={r.action} />
                    </td>

                    <td className="px-6 py-4 font-medium text-indigo-700">
                      {r.actor_email || "—"}
                    </td>

                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {r.actor_role || "—"}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {r.target_email || "—"}
                    </td>

                    <td className="px-6 py-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                      {r.ip || "—"}
                    </td>

                    <td className="px-6 py-4">
                      <button
                        className="text-xs font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-2 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        onClick={() => setOpenMeta((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        title="Visualizza metadata"
                      >
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {isOpen ? "Hide" : "View"}
                      </button>

                      {isOpen && (
                        <pre className="mt-2 text-xs font-mono whitespace-pre-wrap bg-slate-950 text-slate-100 p-3 rounded-xl border border-slate-800 overflow-auto max-h-64">
                          {metaStr}
                        </pre>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}