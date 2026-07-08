"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2, CheckCircle2, Edit3, Loader2, Plus, Search, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { cn } from "@/lib/utils";

type FieldType = "text" | "email" | "number" | "date" | "datetime-local" | "textarea" | "select" | "relation";

export type CrmField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  relation?: "companies" | "contacts" | "leads" | "opportunities";
  placeholder?: string;
};

export type CrmColumn = {
  key: string;
  label: string;
  format?: (value: unknown, row: CrmRow) => ReactNode;
  sensitive?: boolean;
};

export type CrmRow = Record<string, any>;

type ListResponse = {
  items: CrmRow[];
  total: number;
  limit: number;
  offset: number;
};

export const COMPANY_STATUS_OPTIONS = [
  { value: "prospect", label: "Prospect" },
  { value: "active_client", label: "Cliente attivo" },
  { value: "former_client", label: "Ex cliente" },
  { value: "partner", label: "Partner" },
  { value: "dormant", label: "Dormiente" },
];

export const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "Nuovo" },
  { value: "to_contact", label: "Da contattare" },
  { value: "contacted", label: "Contattato" },
  { value: "call_scheduled", label: "Call fissata" },
  { value: "briefing_sent", label: "Brief inviato" },
  { value: "briefing_received", label: "Brief ricevuto" },
  { value: "quote_preparation", label: "Preventivo in preparazione" },
  { value: "quote_sent", label: "Preventivo inviato" },
  { value: "follow_up", label: "Follow-up" },
  { value: "won", label: "Vinto" },
  { value: "lost", label: "Perso" },
  { value: "paused", label: "In pausa" },
];

export const OPPORTUNITY_STAGE_OPTIONS = [
  { value: "new_lead", label: "Nuovo lead" },
  { value: "to_contact", label: "Da contattare" },
  { value: "contacted", label: "Contattato" },
  { value: "call_scheduled", label: "Call fissata" },
  { value: "briefing_sent", label: "Brief inviato" },
  { value: "briefing_received", label: "Brief ricevuto" },
  { value: "quote_preparation", label: "Preventivo in preparazione" },
  { value: "quote_sent", label: "Preventivo inviato" },
  { value: "follow_up", label: "Follow-up" },
  { value: "accepted", label: "Accettata" },
  { value: "lost", label: "Persa" },
  { value: "paused", label: "In pausa" },
];

export const ACTIVITY_TYPE_OPTIONS = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow-up" },
  { value: "note", label: "Nota" },
  { value: "task", label: "Task" },
];

export function statusLabel(value?: string, options: Array<{ value: string; label: string }> = []) {
  return options.find((o) => o.value === value)?.label || value || "-";
}

export function money(value: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function shortDate(value: unknown) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(String(value)));
}

function canSeeEconomicValues() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "manager", "superadmin", "super_admin"].includes(role);
}

function emptyForm(fields: CrmField[]) {
  return fields.reduce<Record<string, any>>((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});
}

function toInputValue(value: unknown, type?: FieldType) {
  if (!value) return "";
  if (type === "date") return String(value).slice(0, 10);
  if (type === "datetime-local") return String(value).slice(0, 16);
  return String(value);
}

export function CrmResourcePage({
  title,
  description,
  resource,
  createLabel,
  fields,
  columns,
  filterKey,
  filterOptions,
  emptyText,
  headerActions,
}: {
  title: string;
  description: string;
  resource: "companies" | "contacts" | "leads" | "opportunities" | "activities";
  createLabel: string;
  fields: CrmField[];
  columns: CrmColumn[];
  filterKey?: string;
  filterOptions?: Array<{ value: string; label: string }>;
  emptyText: string;
  headerActions?: ReactNode;
}) {
  const [items, setItems] = useState<CrmRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("__all__");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CrmRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(() => emptyForm(fields));
  const [relations, setRelations] = useState<Record<string, CrmRow[]>>({});
  const showEconomic = canSeeEconomicValues();

  const relationResources = useMemo(
    () => Array.from(new Set(fields.map((f) => f.relation).filter(Boolean))) as Array<NonNullable<CrmField["relation"]>>,
    [fields],
  );

  const loadRelations = async () => {
    const next: Record<string, CrmRow[]> = {};
    await Promise.all(relationResources.map(async (rel) => {
      const data = await apiFetch<ListResponse>(`/tenant/crm/${rel}?limit=100`).catch(() => null);
      next[rel] = data?.items || [];
    }));
    setRelations(next);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (filterKey && filter !== "__all__") params.set(filterKey, filter);
      params.set("limit", "100");
      const data = await apiFetch<ListResponse>(`/tenant/crm/${resource}?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento CRM");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRelations();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(fields));
    setDialogOpen(true);
  };

  const openEdit = (row: CrmRow) => {
    setEditing(row);
    setForm(fields.reduce<Record<string, any>>((acc, field) => {
      acc[field.key] = toInputValue(row[field.key], field.type);
      return acc;
    }, {}));
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = fields.reduce<Record<string, any>>((acc, field) => {
        const value = form[field.key];
        if (value === "" || value === undefined) return acc;
        acc[field.key] = value;
        return acc;
      }, {});
      if (editing?.id) {
        await apiFetch(`/tenant/crm/${resource}/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/tenant/crm/${resource}`, { method: "POST", body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      await load();
      await loadRelations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: CrmRow) => {
    if (!window.confirm("Spostare questo record nel cestino?")) return;
    await apiFetch(`/tenant/crm/${resource}/${row.id}`, { method: "DELETE" });
    await load();
  };

  const completeActivity = async (row: CrmRow) => {
    await apiFetch(`/tenant/crm/activities/${row.id}/complete`, { method: "PATCH" });
    await load();
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {headerActions}
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {createLabel}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Archivio reale tenant</CardTitle>
          <CardDescription>{total} record trovati. Nessun dato dimostrativo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..." className="pl-9" />
            </div>
            {filterKey && filterOptions ? (
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {filterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {columns.filter((c) => !c.sensitive || showEconomic).map((column) => (
                      <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>
                    ))}
                    <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t">
                      {columns.filter((c) => !c.sensitive || showEconomic).map((column) => (
                        <td key={column.key} className="px-4 py-3 align-top">
                          {column.format ? column.format(row[column.key], row) : String(row[column.key] ?? "-")}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {resource === "activities" && !row.completed_at ? (
                            <Button size="sm" variant="outline" onClick={() => completeActivity(row)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => remove(row)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica record" : createLabel}</DialogTitle>
            <DialogDescription>I campi vengono salvati nello schema tenant corrente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className={cn("grid gap-2", field.type === "textarea" && "sm:col-span-2")}>
                <Label>{field.label}{field.required ? " *" : ""}</Label>
                <FieldInput field={field} value={form[field.key]} relations={relations} onChange={(value) => setForm((prev) => ({ ...prev, [field.key]: value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldInput({
  field,
  value,
  relations,
  onChange,
}: {
  field: CrmField;
  value: any;
  relations: Record<string, CrmRow[]>;
  onChange: (value: any) => void;
}) {
  if (field.type === "textarea") {
    return <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  }

  if (field.type === "select" && field.options) {
    return (
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={field.placeholder || "Seleziona"} /></SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "relation" && field.relation) {
    const items = relations[field.relation] || [];
    return (
      <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
        <SelectTrigger><SelectValue placeholder={field.placeholder || "Nessun collegamento"} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Nessun collegamento</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name || item.title || [item.first_name, item.last_name].filter(Boolean).join(" ") || item.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={field.type || "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export function StatusBadge({ value, options }: { value?: string; options: Array<{ value: string; label: string }> }) {
  return <Badge variant="outline">{statusLabel(value, options)}</Badge>;
}

export function PipelinePage() {
  const [data, setData] = useState<{ stages: Array<{ stage: string; label: string; count: number; totalValue: number; items: CrmRow[] }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const showEconomic = canSeeEconomicValues();

  const load = async () => {
    setLoading(true);
    try {
      setData(await apiFetch("/tenant/crm/pipeline"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const move = async (id: string, stage: string) => {
    await apiFetch(`/tenant/crm/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) });
    await load();
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">Opportunità reali raggruppate per stage. Nessun dato mock.</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {(data?.stages || []).map((stage) => (
            <Card key={stage.stage} className="min-h-[220px]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  {stage.label}
                  <Badge variant="outline">{stage.count}</Badge>
                </CardTitle>
                {showEconomic ? <CardDescription>{money(stage.totalValue)}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {stage.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-8 text-center text-xs text-muted-foreground">Nessuna opportunità</div>
                ) : stage.items.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-background p-3 shadow-sm">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.company_name || "Azienda non collegata"}</p>
                    {showEconomic ? <p className="mt-2 text-sm font-semibold">{money(item.value_estimate)}</p> : null}
                    <Select value={item.stage} onValueChange={(next) => move(item.id, next)}>
                      <SelectTrigger className="mt-3 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPPORTUNITY_STAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
