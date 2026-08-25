"use client";

import { useEffect,useRef,useState,type ReactNode,useEffectEvent } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import {
  CheckCircle2,ClipboardCheck,Edit3,Eye,FileText,Loader2,Plus,RefreshCw,
  Search,Send,Trash2,FolderKanban,Receipt
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { money,shortDate } from "@/components/tenant-crm/crm-core";
import { useToast } from "@/hooks/use-toast";
import { canUseFinanceFrontend } from "@/components/tenant-finance/finance-core";
import { contractsApi } from "@/lib/tenant-contracts-api";
import { paperworkApi } from "@/lib/tenant-paperwork-api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import type { CommercialQuote } from "@/lib/tenant-commercial-api";
import { CommercialPageHeader } from "@/components/tenant-commercial/commercial-ui";
import { QuotesKpis } from "@/components/tenant-commercial/quotes-kpis";
import { QuotesFollowUpPanel } from "@/components/tenant-commercial/quotes-follow-up-panel";
import { QuotesTable } from "@/components/tenant-commercial/quotes-table";
import { briefingTypeForProject,intakeText,parseIntakeFormData } from "@/lib/public-lead-intake";

type FieldValue = string | number | boolean | null | undefined;
type Row = {
  id: string; billing_type?: string; budget_estimate?: string | number; client_notes?: string; company_id?: string;
  company_name?: string; deadline?: string; default_unit_price?: string | number; description?: string;
  contact_id?: string; default_quantity?: string | number; due_at?: string; first_name?: string; intake_form_data?: unknown;
  internal_notes?: string; is_active?: boolean; items?: Row[]; last_name?: string; lead_interest?: string;
  name?: string; objective?: string; opportunity_title?: string; quote_number?: string; schema_json?: unknown;
  opportunity_id?: string; service_template_name?: string; service_type?: string; status?: string;
  subtotal?: string | number; target?: string; terms?: string;
  title?: string; total?: string | number; type?: string; valid_until?: string;
};
type FormState = Record<string, FieldValue> & {
  billing_type?: string; briefing_id?: string; budget_estimate?: string | number; category?: string;
  client_notes?: string; company_id?: string; contact_id?: string; currency?: string; deadline?: string;
  default_quantity?: string | number; default_unit_price?: string | number; description?: string; discount?: string | number;
  due_at?: string; internal_notes?: string; is_active?: boolean; name?: string; objective?: string;
  opportunity_id?: string; quantity?: string | number; schema_json?: string; service_template_id?: string;
  sort_order?: string | number; status?: string; target?: string; tax_rate?: string | number; template_id?: string;
  terms?: string; title?: string; type?: string; unit_price?: string | number; valid_until?: string;
};
const NEW_ROW: Row = { id: "" };
type ListResponse<T = Row> = { items: T[]; total: number; limit: number; offset: number };
type Option = { value: string; label: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRIEFING_STATUSES: Option[] = [
  { value: "draft", label: "Bozza" },
  { value: "sent", label: "Inviato" },
  { value: "partially_completed", label: "Parzialmente completato" },
  { value: "completed", label: "Completato" },
  { value: "internal_reviewed", label: "Revisionato internamente" },
  { value: "approved", label: "Approvato" },
  { value: "converted_to_project", label: "Convertito in progetto" },
];

const MATERIAL_STATUSES: Option[] = [
  { value: "missing", label: "Mancante" },
  { value: "requested", label: "Richiesto" },
  { value: "received", label: "Ricevuto" },
  { value: "approved", label: "Approvato" },
  { value: "rejected", label: "Da rifare" },
];

const QUOTE_STATUSES: Option[] = [
  { value: "draft", label: "Bozza" },
  { value: "sent", label: "Inviato" },
  { value: "viewed", label: "Visto" },
  { value: "accepted", label: "Accettato" },
  { value: "rejected", label: "Rifiutato" },
  { value: "expired", label: "Scaduto" },
];

const BILLING_TYPES: Option[] = [
  { value: "one_time", label: "Una tantum" },
  { value: "monthly", label: "Mensile" },
  { value: "yearly", label: "Annuale" },
];

const BRIEFING_TYPES: Option[] = [
  { value: "website", label: "Sito web" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "maintenance", label: "Manutenzione" },
  { value: "seo", label: "SEO" },
  { value: "other", label: "Altro" },
];

const MATERIAL_TYPES: Option[] = [
  { value: "logo", label: "Logo" },
  { value: "images", label: "Immagini" },
  { value: "texts", label: "Testi" },
  { value: "access", label: "Accessi" },
  { value: "hosting", label: "Hosting" },
  { value: "domain", label: "Dominio" },
  { value: "legal", label: "Legale" },
  { value: "other", label: "Altro" },
];

function labelFor(value: string | undefined, options: Option[]) {
  return options.find((o) => o.value === value)?.label || value || "-";
}

function canManageBriefingQuotes() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "manager", "superadmin", "super_admin"].includes(role);
}

function canSeeEconomicValues() {
  return canManageBriefingQuotes();
}

function AccessDenied({ title }: { title: string }) {
  return (
    <div className="flex-1 p-4 md:p-6">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Questa sezione e&apos; disponibile solo a owner, admin e project manager.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function StateBadge({ value, options }: { value?: string; options: Option[] }) {
  return <Badge variant="outline">{labelFor(value, options)}</Badge>;
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function SelectField({
  value,
  options,
  placeholder,
  onChange,
}: {
  value?: string;
  options: Option[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{placeholder}</SelectItem>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function RelationSelect({
  value,
  rows,
  placeholder,
  onChange,
}: {
  value?: string;
  rows: Row[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{placeholder}</SelectItem>
        {rows.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.name || row.title || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.quote_number || row.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function toBody(form: FormState) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "" && value !== undefined));
}

function rowValue(row: Row, key: string) {
  return (row as unknown as Record<string, unknown>)[key];
}

function projectFromConversionResult(result: Row | { project?: Row; existing?: boolean }) {
  if (result && typeof result === "object" && "project" in result) return result.project || null;
  return result as Row;
}

function entityFromConversionResult(result: unknown, key: string): Row | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  const entity = key in record ? record[key] : record;
  return entity && typeof entity === "object" && !Array.isArray(entity) ? entity as Row : null;
}

function conversionErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || "");
  const lower = message.toLowerCase();

  if (lower.includes("preventivo non accettato") || lower.includes("400")) {
    return "Il preventivo deve essere accettato prima di creare il progetto.";
  }
  if (lower.includes("già esistente") || lower.includes("gia esistente") || lower.includes("409")) {
    return "Il progetto esiste già. Apro il progetto collegato se il backend lo restituisce.";
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("forbidden") || lower.includes("unauthorized") || lower.includes("permess")) {
    return "Non hai i permessi per creare un progetto da questo preventivo.";
  }
  return message || "Errore durante la creazione del progetto.";
}

async function loadList(path: string, params?: URLSearchParams) {
  const query = params?.toString();
  return apiFetch<ListResponse>(`${path}${query ? `?${query}` : ""}`);
}

function useRelations(includeBriefings = false) {
  const { canView } = useTenantAccess();
  const [relations, setRelations] = useState<Record<string, Row[]>>({
    companies: [],
    contacts: [],
    opportunities: [],
    briefings: [],
    briefingTemplates: [],
    serviceTemplates: [],
  });
  const [relationsLoaded, setRelationsLoaded] = useState(false);

  const load = async () => {
    const canLoadCrm = canView("crm");
    const [companies, contacts, opportunities, briefings, briefingTemplates, serviceTemplates] = await Promise.all([
      canLoadCrm ? loadList("/tenant/crm/companies?limit=100").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      canLoadCrm ? loadList("/tenant/crm/contacts?limit=100").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      canLoadCrm ? loadList("/tenant/crm/opportunities?limit=100").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      includeBriefings ? loadList("/tenant/briefing?limit=100").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      loadList("/tenant/briefing/templates?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/quotes/service-templates?limit=100").catch(() => ({ items: [] })),
    ]);
    setRelations({
      companies: companies.items || [],
      contacts: contacts.items || [],
      opportunities: opportunities.items || [],
      briefings: briefings.items || [],
      briefingTemplates: briefingTemplates.items || [],
      serviceTemplates: serviceTemplates.items || [],
    });
    setRelationsLoaded(true);
  };

    const loadEffect = useEffectEvent(load);
useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadEffect();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { relations, relationsLoaded, reloadRelations: load };
}

export function BriefingListPage({
  initialStatuses,
  title = "Briefing",
  description = "Briefing reali collegati a aziende, contatti e opportunita.",
}: {
  initialStatuses?: string[];
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>([]);
  const [materials, setMaterials] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<FormState>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatuses?.[0] || "__all__");
  const [type, setType] = useState("__all__");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState<FormState>({ title: "", type: "other", status: "missing" });

  const statusOptions = initialStatuses
    ? BRIEFING_STATUSES.filter((s) => initialStatuses.includes(s.value))
    : BRIEFING_STATUSES;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "__all__") params.set("status", status);
      if (type !== "__all__") params.set("type", type);
      const data = await loadList("/tenant/briefing", params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento briefing");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async (briefing: Row) => {
    setSelected(briefing);
    setMaterialForm({ title: "", type: "other", status: "missing" });
    const data = await loadList(`/tenant/briefing/${briefing.id}/materials`, new URLSearchParams({ limit: "100" })).catch(() => ({ items: [] }));
    setMaterials(data.items || []);
  };

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, type]);

  const patchStatus = async (row: Row, next: string) => {
    await apiFetch(`/tenant/briefing/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    await load();
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setEditForm({
      title: row.title || "",
      type: row.type || "website",
      status: row.status || "draft",
      objective: row.objective || "",
      target: row.target || "",
      budget_estimate: row.budget_estimate || "",
      deadline: row.deadline ? String(row.deadline).slice(0, 10) : "",
      internal_notes: row.internal_notes || "",
      client_notes: row.client_notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await apiFetch(`/tenant/briefing/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(editForm)) });
    setEditing(null);
    await load();
  };

  const approve = async (row: Row) => {
    await apiFetch(`/tenant/briefing/${row.id}/approve`, { method: "PATCH" });
    await load();
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questo briefing?")) return;
    await apiFetch(`/tenant/briefing/${row.id}`, { method: "DELETE" });
    await load();
  };

  const createMaterial = async () => {
    if (!selected) return;
    await apiFetch(`/tenant/briefing/${selected.id}/materials`, { method: "POST", body: JSON.stringify(toBody(materialForm)) });
    await loadMaterials(selected);
  };

  const patchMaterial = async (material: Row, patch: FormState) => {
    await apiFetch(`/tenant/briefing/materials/${material.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (selected) await loadMaterials(selected);
  };

  const deleteMaterial = async (material: Row) => {
    if (!window.confirm("Eliminare questa richiesta materiale?")) return;
    await apiFetch(`/tenant/briefing/materials/${material.id}`, { method: "DELETE" });
    if (selected) await loadMaterials(selected);
  };

  if (!canManageBriefingQuotes()) return <AccessDenied title="Briefing" />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => router.push("/briefings/new")}>
          <Plus className="mr-2 h-4 w-4" /> Nuovo briefing
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Archivio briefing</CardTitle>
          <CardDescription>{items.length} briefing reali. Nessun dato dimostrativo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca briefing..." className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                {!initialStatuses ? <SelectItem value="__all__">Tutti gli stati</SelectItem> : null}
                {statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tutti i tipi</SelectItem>
                {BRIEFING_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ErrorBox error={error} />
          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              Nessun briefing reale trovato. Crea un briefing quando arriva una nuova richiesta cliente.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Titolo</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Opportunità</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Stato</th>
                    <th className="px-4 py-3">Deadline</th>
                    <th className="px-4 py-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3 font-semibold">{row.title}</td>
                      <td className="px-4 py-3">{row.company_name || "-"}</td>
                      <td className="px-4 py-3">{row.opportunity_title || "-"}</td>
                      <td className="px-4 py-3">{labelFor(row.type, BRIEFING_TYPES)}</td>
                      <td className="px-4 py-3"><StateBadge value={row.status} options={BRIEFING_STATUSES} /></td>
                      <td className="px-4 py-3">{shortDate(row.deadline)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => loadMaterials(row)}><Eye className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Edit3 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => approve(row)} disabled={row.status === "approved"}><CheckCircle2 className="h-4 w-4" /></Button>
                          <Select value={row.status || "draft"} onValueChange={(next) => patchStatus(row, next)}>
                            <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{BRIEFING_STATUSES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button size="sm" variant="outline" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Materiali richiesti</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>
          <div>
            <Button variant="outline" onClick={() => { if (selected?.id) router.push(`/quotes/new?briefing=${encodeURIComponent(selected.id)}`); }}>
              <Send className="mr-2 h-4 w-4" /> Crea preventivo
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Titolo materiale</Label>
              <Input value={materialForm.title || ""} onChange={(e) => setMaterialForm((p) => ({ ...p, title: e.target.value }))} placeholder="Logo in SVG, testi home..." />
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <SelectField value={materialForm.type} options={MATERIAL_TYPES} placeholder="Tipo materiale" onChange={(v) => setMaterialForm((p) => ({ ...p, type: v }))} />
            </div>
            <div className="grid gap-2">
              <Label>Stato</Label>
              <SelectField value={materialForm.status} options={MATERIAL_STATUSES} placeholder="Stato" onChange={(v) => setMaterialForm((p) => ({ ...p, status: v }))} />
            </div>
            <div className="grid gap-2">
              <Label>Scadenza</Label>
              <Input type="datetime-local" value={materialForm.due_at || ""} onChange={(e) => setMaterialForm((p) => ({ ...p, due_at: e.target.value }))} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Descrizione</Label>
              <Textarea value={materialForm.description || ""} onChange={(e) => setMaterialForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <Button onClick={createMaterial} disabled={!materialForm.title}><Plus className="mr-2 h-4 w-4" /> Aggiungi richiesta</Button>
          <div className="space-y-2">
            {materials.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">Nessun materiale richiesto per questo briefing.</div>
            ) : materials.map((material) => (
              <div key={material.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{material.title}</p>
                  <p className="text-xs text-muted-foreground">{labelFor(material.type, MATERIAL_TYPES)} · scadenza {shortDate(material.due_at)}</p>
                  {material.description ? <p className="mt-1 text-sm text-muted-foreground">{material.description}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={material.status || "missing"} onValueChange={(next) => patchMaterial(material, { status: next })}>
                    <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{MATERIAL_STATUSES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => deleteMaterial(material)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica briefing</DialogTitle>
            <DialogDescription>Aggiorna i dati base del briefing senza cambiare materiali o automazioni.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={editForm.title || ""} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Tipo</Label><SelectField value={editForm.type} options={BRIEFING_TYPES} placeholder="Tipo" onChange={(v) => setEditForm((p) => ({ ...p, type: v }))} /></div>
            <div className="grid gap-2"><Label>Stato</Label><SelectField value={editForm.status} options={BRIEFING_STATUSES} placeholder="Stato" onChange={(v) => setEditForm((p) => ({ ...p, status: v }))} /></div>
            <div className="grid gap-2"><Label>Budget stimato</Label><Input type="number" value={editForm.budget_estimate || ""} onChange={(e) => setEditForm((p) => ({ ...p, budget_estimate: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Deadline</Label><Input type="date" value={editForm.deadline || ""} onChange={(e) => setEditForm((p) => ({ ...p, deadline: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Obiettivo</Label><Textarea value={editForm.objective || ""} onChange={(e) => setEditForm((p) => ({ ...p, objective: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Target</Label><Textarea value={editForm.target || ""} onChange={(e) => setEditForm((p) => ({ ...p, target: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={editForm.internal_notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Note cliente</Label><Textarea value={editForm.client_notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, client_notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveEdit} disabled={!editForm.title}>Salva modifiche</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BriefingCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { relations, relationsLoaded } = useRelations();
  const prefillAttempted = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ title: "", type: "website", status: "draft" });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        if (!relationsLoaded || prefillAttempted.current) return;
        const opportunityId = searchParams.get("opportunity");
        if (!opportunityId || !UUID_RE.test(opportunityId)) {
          prefillAttempted.current = true;
          return;
        }
        const opportunity = relations.opportunities.find((row) => row.id === opportunityId);
        prefillAttempted.current = true;
        if (!opportunity) return;

        const intake = parseIntakeFormData(opportunity.intake_form_data);
        const company = relations.companies.find((row) => row.id === opportunity.company_id);
        const titleSubject = intakeText(company?.name) || intakeText(opportunity.company_name) || intakeText(opportunity.title) || "opportunità";
        const objective = intake.goals.length ? intake.goals.join(", ") : intakeText(opportunity.lead_interest) || "";
        setForm((current) => ({
          ...current,
          opportunity_id: opportunity.id,
          company_id: opportunity.company_id || "",
          contact_id: opportunity.contact_id || "",
          title: `Briefing - ${titleSubject}`,
          type: briefingTypeForProject(intake.projectType || intakeText(opportunity.service_type)),
          objective,
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [relations, relationsLoaded, searchParams]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/tenant/briefing", { method: "POST", body: JSON.stringify(toBody(form)) });
      router.push("/briefings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione briefing");
    } finally {
      setSaving(false);
    }
  };

  if (!canManageBriefingQuotes()) return <AccessDenied title="Nuovo briefing" />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuovo briefing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Crea un briefing reale nello schema tenant corrente.</p>
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <ErrorBox error={error} />
          <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
          <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.type} options={BRIEFING_TYPES} placeholder="Tipo" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /></div>
          <div className="grid gap-2"><Label>Template</Label><RelationSelect value={form.template_id} rows={relations.briefingTemplates} placeholder="Nessun template" onChange={(v) => setForm((p) => ({ ...p, template_id: v }))} /></div>
          <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
          <div className="grid gap-2"><Label>Contatto</Label><RelationSelect value={form.contact_id} rows={relations.contacts} placeholder="Nessun contatto" onChange={(v) => setForm((p) => ({ ...p, contact_id: v }))} /></div>
          <div className="grid gap-2"><Label>Opportunità</Label><RelationSelect value={form.opportunity_id} rows={relations.opportunities} placeholder="Nessuna opportunità" onChange={(v) => setForm((p) => ({ ...p, opportunity_id: v }))} /></div>
          <div className="grid gap-2"><Label>Budget stimato</Label><Input type="number" value={form.budget_estimate || ""} onChange={(e) => setForm((p) => ({ ...p, budget_estimate: e.target.value }))} /></div>
          <div className="grid gap-2"><Label>Deadline</Label><Input type="date" value={form.deadline || ""} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Obiettivo</Label><Textarea value={form.objective || ""} onChange={(e) => setForm((p) => ({ ...p, objective: e.target.value }))} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Target</Label><Textarea value={form.target || ""} onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Note cliente</Label><Textarea value={form.client_notes || ""} onChange={(e) => setForm((p) => ({ ...p, client_notes: e.target.value }))} /></div>
          <div className="flex gap-2 md:col-span-2">
            <Button onClick={save} disabled={saving || !form.title}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Crea briefing</Button>
            <Button variant="outline" onClick={() => router.push("/briefings")}>Annulla</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BriefingTemplatesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", type: "website", schema_json: "{}" });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data = await loadList("/tenant/briefing/templates", new URLSearchParams({ limit: "100" }));
    setItems(data.items || []);
  };

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (row?: Row) => {
    setEditing(row ?? NEW_ROW);
    setForm(row ? {
      name: row.name || "",
      type: row.type || "website",
      schema_json: JSON.stringify(row.schema_json || {}, null, 2),
      is_active: row.is_active !== false,
    } : { name: "", type: "website", schema_json: "{}", is_active: true });
    setError(null);
  };

  const save = async () => {
    try {
      const body = { ...form, schema_json: form.schema_json ? JSON.parse(form.schema_json) : {} };
      if (editing?.id) await apiFetch(`/tenant/briefing/templates/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(body)) });
      else await apiFetch("/tenant/briefing/templates", { method: "POST", body: JSON.stringify(toBody(body)) });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON non valido o errore salvataggio");
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questo template briefing?")) return;
    await apiFetch(`/tenant/briefing/templates/${row.id}`, { method: "DELETE" });
    await load();
  };

  if (!canManageBriefingQuotes()) return <AccessDenied title="Template briefing" />;

  return (
    <TemplatePageShell
      title="Template briefing"
      description="Template reali per raccogliere briefing cliente. Lo schema JSON e' modificabile in forma semplice."
      createLabel="Nuovo template"
      onCreate={() => open()}
    >
      <ErrorBox error={error} />
      <SimpleTable
        rows={items}
        columns={[
          ["name", "Nome"],
          ["type", "Tipo", (row) => labelFor(row.type, BRIEFING_TYPES)],
          ["description", "Descrizione"],
          ["is_active", "Attivo", (row) => row.is_active === false ? "No" : "Si"],
        ]}
        onEdit={open}
        onDelete={remove}
      />
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Modifica template" : "Nuovo template"}</DialogTitle></DialogHeader>
          <TemplateForm form={form} setForm={setForm} typeOptions={BRIEFING_TYPES} includeSchema />
          <DialogFooter><Button onClick={save}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </TemplatePageShell>
  );
}

export function QuotesListPage({
  initialStatus,
  title = "Preventivi",
  description = "Preventivi reali tenant-scoped, con righe e totali calcolati dal backend.",
}: {
  initialStatus?: string;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | CommercialQuote | null>(null);
  const [editForm, setEditForm] = useState<FormState>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus || "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptedQuoteCta, setAcceptedQuoteCta] = useState<Row | CommercialQuote | null>(null);
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);
  const [creatingInvoiceId, setCreatingInvoiceId] = useState<string | null>(null);
  const [creatingContractId, setCreatingContractId] = useState<string | null>(null);
  const [creatingDossierId, setCreatingDossierId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<FormState>({ name: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, billing_type: "one_time" });
  const { relations } = useRelations(true);
  const showMoney = canSeeEconomicValues();
  const canCreateFinanceInvoice = canUseFinanceFrontend();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      const data = await loadList("/tenant/quotes", params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento preventivi");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadQuote = async (row: Row | CommercialQuote) => {
    const data = await apiFetch<Row>(`/tenant/quotes/${row.id}`);
    setSelected(data);
  };

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openEdit = (row: Row | CommercialQuote) => {
    setEditing(row);
    setEditForm({
      title: row.title || "",
      status: row.status || "draft",
      valid_until: row.valid_until ? String(row.valid_until).slice(0, 10) : "",
      client_notes: row.client_notes || "",
      internal_notes: row.internal_notes || "",
      terms: row.terms || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await apiFetch(`/tenant/quotes/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(editForm)) });
    setEditing(null);
    await load();
    if (selected?.id === editing.id) await loadQuote(editing);
  };

  const accept = async (row: Row | CommercialQuote) => {
    await apiFetch(`/tenant/quotes/${row.id}/accept`, { method: "PATCH", body: JSON.stringify({}) });
    await load();
    if (selected?.id === row.id) await loadQuote(row);
    setAcceptedQuoteCta({ ...row, status: "accepted" });
    toast({
      title: "Preventivo accettato",
      description: "Ora puoi creare il progetto operativo collegato.",
    });
  };

  const reject = async (row: Row | CommercialQuote) => {
    await apiFetch(`/tenant/quotes/${row.id}/reject`, { method: "PATCH" });
    await load();
    if (selected?.id === row.id) await loadQuote(row);
  };

  const recalculate = async (row: Row | CommercialQuote) => {
    await apiFetch(`/tenant/quotes/${row.id}/recalculate`, { method: "POST" });
    await load();
    if (selected?.id === row.id) await loadQuote(row);
  };

  const remove = async (row: Row | CommercialQuote) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await apiFetch(`/tenant/quotes/${row.id}`, { method: "DELETE" });
    await load();
  };

  const addItem = async () => {
    if (!selected) return;
    await apiFetch(`/tenant/quotes/${selected.id}/items`, { method: "POST", body: JSON.stringify(toBody(itemForm)) });
    setItemForm({ name: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, billing_type: "one_time" });
    await loadQuote(selected);
    await load();
  };

  const deleteItem = async (item: Row) => {
    if (!selected) return;
    await apiFetch(`/tenant/quotes/${selected.id}/items/${item.id}`, { method: "DELETE" });
    await loadQuote(selected);
    await load();
  };

  const createProjectFromQuote = async (row: Row | CommercialQuote) => {
    if (row.status !== "accepted") return;
    const endpoint = `/tenant/projects/from-quote/${row.id}`;
    setCreatingProjectId(row.id);
    setError(null);
    try {
      if (process.env.NODE_ENV === "development") {
        console.info(`[quotes] POST ${endpoint}`);
      }
      const result = await apiFetch<Row | { project?: Row; existing?: boolean }>(endpoint, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const project = projectFromConversionResult(result);
      toast({
        title: result && typeof result === "object" && "existing" in result && result.existing ? "Progetto già esistente" : "Progetto creato",
        description: "Apro la scheda progetto con milestone e task iniziali.",
      });
      router.push(project?.id ? `/projects/${project.id}` : "/projects");
    } catch (err) {
      const message = conversionErrorMessage(err);
      setError(message);
      toast({ title: "Conversione non riuscita", description: message, variant: "destructive" });
    } finally {
      setCreatingProjectId(null);
    }
  };

  const createInvoiceFromQuote = async (row: Row | CommercialQuote) => {
    const endpoint = `/tenant/finance/invoices/from-quote/${row.id}`;
    setCreatingInvoiceId(row.id);
    setError(null);
    try {
      if (process.env.NODE_ENV === "development") {
        console.info(`[quotes] POST ${endpoint}`);
      }
      const result = await apiFetch<Row | { invoice?: Row; existing?: boolean }>(endpoint, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const invoice = entityFromConversionResult(result, "invoice");
      toast({
        title: result && typeof result === "object" && "existing" in result && result.existing ? "Fattura gia esistente" : "Fattura creata",
        description: "Apro l'area fatture Finance V2.",
      });
      router.push(invoice?.id ? "/finance/invoices" : "/finance/invoices");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante la creazione della fattura.";
      setError(message);
      toast({ title: "Fattura non creata", description: message, variant: "destructive" });
    } finally {
      setCreatingInvoiceId(null);
    }
  };

  const createContractFromQuote = async (row: Row | CommercialQuote) => {
    if (row.status !== "accepted") return;
    setCreatingContractId(row.id);
    setError(null);
    try {
      const result = await contractsApi.fromQuote(row.id);
      const contract = entityFromConversionResult(result, "contract");
      toast({
        title: result && typeof result === "object" && "existing" in result && result.existing ? "Contratto già presente" : "Contratto creato",
        description: "Apro la scheda contratto collegata al preventivo.",
      });
      router.push(contract?.id ? `/contracts/${contract.id}` : "/contracts");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante la creazione del contratto.";
      setError(message);
      toast({ title: "Contratto non creato", description: message, variant: "destructive" });
    } finally {
      setCreatingContractId(null);
    }
  };

  const createDossierFromQuote = async (row: Row | CommercialQuote) => {
    setCreatingDossierId(row.id);
    setError(null);
    try {
      const result = await paperworkApi.fromQuote(row.id);
      const dossier = entityFromConversionResult(result, "dossier");
      toast({
        title: result && typeof result === "object" && "existing" in result && result.existing ? "Dossier già presente" : "Dossier creato",
        description: "Apro il dossier amministrativo collegato al preventivo.",
      });
      router.push(dossier?.id ? `/paperwork/dossiers/${dossier.id}` : "/paperwork/dossiers");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante la creazione del dossier.";
      setError(message);
      toast({ title: "Dossier non creato", description: message, variant: "destructive" });
    } finally {
      setCreatingDossierId(null);
    }
  };

  if (!canManageBriefingQuotes()) return <AccessDenied title="Preventivi" />;

  const commercialItems = items as CommercialQuote[];

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <CommercialPageHeader
        title={title}
        description={description === "Preventivi reali tenant-scoped, con righe e totali calcolati dal backend."
          ? "Crea, invia e controlla le proposte commerciali."
          : description}
        ctaLabel="Nuovo preventivo"
        ctaHref="/quotes/new"
      />

      <QuotesKpis items={commercialItems} showMoney={showMoney} />
      <ErrorBox error={error} />

      {acceptedQuoteCta ? (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-emerald-700">Preventivo accettato.</p>
            <p className="text-slate-600">Puoi creare il progetto o il contratto collegato a “{acceptedQuoteCta.title}”.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => createProjectFromQuote(acceptedQuoteCta)} disabled={creatingProjectId === acceptedQuoteCta.id}>
              {creatingProjectId === acceptedQuoteCta.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderKanban className="mr-2 h-4 w-4" />}
              Crea progetto
            </Button>
            <Button variant="outline" onClick={() => createContractFromQuote(acceptedQuoteCta)} disabled={creatingContractId === acceptedQuoteCta.id}>
              {creatingContractId === acceptedQuoteCta.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Crea contratto
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <QuotesTable
          items={commercialItems}
          loading={loading}
          search={search}
          onSearch={setSearch}
          status={status}
          onStatus={setStatus}
          showMoney={showMoney}
          canCreateInvoice={canCreateFinanceInvoice}
          actions={{
            open: loadQuote,
            edit: openEdit,
            accept,
            reject,
            recalculate,
            remove,
            createProject: createProjectFromQuote,
            createInvoice: createInvoiceFromQuote,
          }}
        />
        <QuotesFollowUpPanel items={commercialItems} onOpen={loadQuote} />
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>{selected?.quote_number || "Preventivo"} · {selected?.company_name || "Azienda non collegata"}</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <InfoBox label="Stato" value={labelFor(selected.status, QUOTE_STATUSES)} />
                <InfoBox label="Valido fino" value={shortDate(selected.valid_until)} />
                {showMoney ? <InfoBox label="Subtotale" value={money(selected.subtotal)} /> : null}
                {showMoney ? <InfoBox label="Totale" value={money(selected.total)} /> : null}
              </div>
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Righe preventivo</h3>
                  <div className="flex gap-2">
                    {selected.status === "accepted" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => createProjectFromQuote(selected)} disabled={creatingProjectId === selected.id}>
                          {creatingProjectId === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderKanban className="mr-2 h-4 w-4" />}
                          Crea progetto
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => createContractFromQuote(selected)} disabled={creatingContractId === selected.id}>
                          {creatingContractId === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                          Crea contratto
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => createDossierFromQuote(selected)} disabled={creatingDossierId === selected.id}>
                          {creatingDossierId === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                          Crea dossier
                        </Button>
                        {canCreateFinanceInvoice ? (
                          <Button size="sm" variant="outline" onClick={() => createInvoiceFromQuote(selected)} disabled={creatingInvoiceId === selected.id}>
                            {creatingInvoiceId === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                            Crea fattura da preventivo
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => recalculate(selected)}><RefreshCw className="mr-2 h-4 w-4" /> Ricalcola</Button>
                  </div>
                </div>
                {(selected.items || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">Nessuna riga ancora inserita.</div>
                ) : (
                  <div className="space-y-2">
                    {(selected.items || []).map((item: Row) => (
                      <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.description || item.service_template_name || labelFor(item.billing_type, BILLING_TYPES)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {showMoney ? <span className="text-sm font-semibold">{money(item.total)}</span> : null}
                          <Button size="sm" variant="outline" onClick={() => deleteItem(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
                <div className="grid gap-2 md:col-span-3"><Label>Servizio</Label><RelationSelect value={itemForm.service_template_id} rows={relations.serviceTemplates} placeholder="Nessun template servizio" onChange={(v) => {
                  const tpl = relations.serviceTemplates.find((t) => t.id === v);
                  setItemForm((p) => ({
                    ...p,
                    service_template_id: v,
                    name: tpl?.name || p.name,
                    description: tpl?.description || p.description,
                    unit_price: tpl?.default_unit_price ?? p.unit_price,
                    quantity: tpl?.default_quantity ?? p.quantity,
                    billing_type: tpl?.billing_type || p.billing_type,
                  }));
                }} /></div>
                <div className="grid gap-2 md:col-span-3"><Label>Nome riga *</Label><Input value={itemForm.name || ""} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} /></div>
                <div className="grid gap-2 md:col-span-3"><Label>Descrizione</Label><Textarea value={itemForm.description || ""} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} /></div>
                {showMoney ? (
                  <>
                    <div className="grid gap-2"><Label>Quantità</Label><Input type="number" value={itemForm.quantity || ""} onChange={(e) => setItemForm((p) => ({ ...p, quantity: e.target.value }))} /></div>
                    <div className="grid gap-2"><Label>Prezzo unitario</Label><Input type="number" value={itemForm.unit_price || ""} onChange={(e) => setItemForm((p) => ({ ...p, unit_price: e.target.value }))} /></div>
                    <div className="grid gap-2"><Label>Sconto</Label><Input type="number" value={itemForm.discount || ""} onChange={(e) => setItemForm((p) => ({ ...p, discount: e.target.value }))} /></div>
                    <div className="grid gap-2"><Label>IVA %</Label><Input type="number" value={itemForm.tax_rate || ""} onChange={(e) => setItemForm((p) => ({ ...p, tax_rate: e.target.value }))} /></div>
                  </>
                ) : null}
                <div className="grid gap-2"><Label>Billing</Label><SelectField value={itemForm.billing_type} options={BILLING_TYPES} placeholder="Billing" onChange={(v) => setItemForm((p) => ({ ...p, billing_type: v }))} /></div>
                <div className="grid gap-2"><Label>Ordine</Label><Input type="number" value={itemForm.sort_order || ""} onChange={(e) => setItemForm((p) => ({ ...p, sort_order: e.target.value }))} /></div>
                <div className="flex items-end"><Button onClick={addItem} disabled={!itemForm.name}><Plus className="mr-2 h-4 w-4" /> Aggiungi riga</Button></div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica preventivo</DialogTitle>
            <DialogDescription>Aggiorna i dati base. Le righe e i totali restano gestiti dal dettaglio preventivo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={editForm.title || ""} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Stato</Label><SelectField value={editForm.status} options={QUOTE_STATUSES} placeholder="Stato" onChange={(v) => setEditForm((p) => ({ ...p, status: v }))} /></div>
            <div className="grid gap-2"><Label>Valido fino</Label><Input type="date" value={editForm.valid_until || ""} onChange={(e) => setEditForm((p) => ({ ...p, valid_until: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Note cliente</Label><Textarea value={editForm.client_notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, client_notes: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={editForm.internal_notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Termini</Label><Textarea value={editForm.terms || ""} onChange={(e) => setEditForm((p) => ({ ...p, terms: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveEdit} disabled={!editForm.title}>Salva modifiche</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

export function QuoteCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { relations, relationsLoaded } = useRelations(true);
  const prefillAttempted = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ title: "", status: "draft", currency: "EUR" });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        if (!relationsLoaded || prefillAttempted.current) return;
        const briefingId = searchParams.get("briefing");
        const opportunityId = searchParams.get("opportunity");
        const briefing = briefingId && UUID_RE.test(briefingId)
          ? relations.briefings.find((row) => row.id === briefingId)
          : null;
        const opportunity = !briefing && opportunityId && UUID_RE.test(opportunityId)
          ? relations.opportunities.find((row) => row.id === opportunityId)
          : null;
        prefillAttempted.current = true;

        if (briefing) {
          const company = relations.companies.find((row) => row.id === briefing.company_id);
          const titleSubject = intakeText(company?.name) || intakeText(briefing.company_name) || intakeText(briefing.title) || "briefing";
          setForm((current) => ({
            ...current,
            briefing_id: briefing.id,
            opportunity_id: briefing.opportunity_id || "",
            company_id: briefing.company_id || "",
            contact_id: briefing.contact_id || "",
            title: `Preventivo - ${titleSubject}`,
          }));
          return;
        }

        if (opportunity) {
          const company = relations.companies.find((row) => row.id === opportunity.company_id);
          const titleSubject = intakeText(company?.name) || intakeText(opportunity.company_name) || intakeText(opportunity.title) || "opportunità";
          setForm((current) => ({
            ...current,
            opportunity_id: opportunity.id,
            company_id: opportunity.company_id || "",
            contact_id: opportunity.contact_id || "",
            title: `Preventivo - ${titleSubject}`,
          }));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [relations, relationsLoaded, searchParams]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/tenant/quotes", { method: "POST", body: JSON.stringify(toBody(form)) });
      router.push("/quotes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione preventivo");
    } finally {
      setSaving(false);
    }
  };

  if (!canManageBriefingQuotes()) return <AccessDenied title="Nuovo preventivo" />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Nuovo preventivo</h1><p className="mt-1 text-sm text-muted-foreground">Crea il preventivo; le righe si aggiungono dalla lista/dettaglio.</p></div>
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <ErrorBox error={error} />
          <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
          <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
          <div className="grid gap-2"><Label>Contatto</Label><RelationSelect value={form.contact_id} rows={relations.contacts} placeholder="Nessun contatto" onChange={(v) => setForm((p) => ({ ...p, contact_id: v }))} /></div>
          <div className="grid gap-2"><Label>Opportunità</Label><RelationSelect value={form.opportunity_id} rows={relations.opportunities} placeholder="Nessuna opportunità" onChange={(v) => setForm((p) => ({ ...p, opportunity_id: v }))} /></div>
          <div className="grid gap-2"><Label>Briefing</Label><RelationSelect value={form.briefing_id} rows={relations.briefings} placeholder="Nessun briefing" onChange={(v) => setForm((p) => ({ ...p, briefing_id: v }))} /></div>
          <div className="grid gap-2"><Label>Valido fino</Label><Input type="date" value={form.valid_until || ""} onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))} /></div>
          <div className="grid gap-2"><Label>Valuta</Label><Input value={form.currency || ""} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Note cliente</Label><Textarea value={form.client_notes || ""} onChange={(e) => setForm((p) => ({ ...p, client_notes: e.target.value }))} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Termini</Label><Textarea value={form.terms || ""} onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))} /></div>
          <div className="flex gap-2 md:col-span-2">
            <Button onClick={save} disabled={saving || !form.title}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Crea preventivo</Button>
            <Button variant="outline" onClick={() => router.push("/quotes")}>Annulla</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ServiceTemplatesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", billing_type: "one_time", default_unit_price: 0, default_quantity: 1, is_active: true });

  const load = async () => {
    const data = await loadList("/tenant/quotes/service-templates", new URLSearchParams({ limit: "100" }));
    setItems(data.items || []);
  };

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (row?: Row) => {
    setEditing(row ?? NEW_ROW);
    setForm(row ? {
      name: row.name || "",
      description: row.description || "",
      billing_type: row.billing_type || "one_time",
      default_unit_price: row.default_unit_price || 0,
      default_quantity: row.default_quantity || 1,
      is_active: row.is_active !== false,
    } : { name: "", billing_type: "one_time", default_unit_price: 0, default_quantity: 1, is_active: true });
  };

  const save = async () => {
    if (editing?.id) await apiFetch(`/tenant/quotes/service-templates/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    else await apiFetch("/tenant/quotes/service-templates", { method: "POST", body: JSON.stringify(toBody(form)) });
    setEditing(null);
    await load();
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questo template servizio?")) return;
    await apiFetch(`/tenant/quotes/service-templates/${row.id}`, { method: "DELETE" });
    await load();
  };

  if (!canManageBriefingQuotes()) return <AccessDenied title="Template servizi" />;

  return (
    <TemplatePageShell
      title="Template servizi"
      description="Listino modificabile, non definitivo. Prezzi a 0 sono validi finche' non viene definito il listino reale."
      createLabel="Nuovo servizio"
      onCreate={() => open()}
    >
      <SimpleTable
        rows={items}
        columns={[
          ["name", "Nome"],
          ["category", "Categoria"],
          ["billing_type", "Billing", (row) => labelFor(row.billing_type, BILLING_TYPES)],
          ["default_unit_price", "Prezzo", (row) => money(row.default_unit_price)],
          ["is_active", "Attivo", (row) => row.is_active === false ? "No" : "Si"],
        ]}
        onEdit={open}
        onDelete={remove}
      />
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Modifica servizio" : "Nuovo servizio"}</DialogTitle></DialogHeader>
          <ServiceTemplateForm form={form} setForm={setForm} />
          <DialogFooter><Button onClick={save}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </TemplatePageShell>
  );
}

function TemplatePageShell({
  title,
  description,
  createLabel,
  onCreate,
  children,
}: {
  title: string;
  description: string;
  createLabel: string;
  onCreate: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
        <Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" /> {createLabel}</Button>
      </div>
      <Card><CardContent className="pt-6">{children}</CardContent></Card>
    </div>
  );
}

function SimpleTable({
  rows,
  columns,
  onEdit,
  onDelete,
}: {
  rows: Row[];
  columns: Array<[string, string, ((row: Row) => ReactNode)?]>;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
}) {
  if (rows.length === 0) {
    return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">Nessun record presente.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">Azioni</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              {columns.map(([key, , format]) => <td key={key} className="px-4 py-3">{format ? format(row) : String(rowValue(row, key) ?? "-")}</td>)}
              <td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(row)}><Edit3 className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplateForm({
  form,
  setForm,
  typeOptions,
  includeSchema,
}: {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  typeOptions: Option[];
  includeSchema?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Nome *</Label><Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.type} options={typeOptions} placeholder="Tipo" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /></div>
      <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
      {includeSchema ? <div className="grid gap-2"><Label>Schema JSON</Label><Textarea className="font-mono text-xs" rows={8} value={form.schema_json || "{}"} onChange={(e) => setForm((p) => ({ ...p, schema_json: e.target.value }))} /></div> : null}
    </div>
  );
}

function ServiceTemplateForm({
  form,
  setForm,
}: {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Nome *</Label><Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Categoria</Label><Input value={form.category || ""} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Billing</Label><SelectField value={form.billing_type} options={BILLING_TYPES} placeholder="Billing" onChange={(v) => setForm((p) => ({ ...p, billing_type: v }))} /></div>
      <div className="grid gap-2"><Label>Prezzo default</Label><Input type="number" value={form.default_unit_price ?? ""} onChange={(e) => setForm((p) => ({ ...p, default_unit_price: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Quantità default</Label><Input type="number" value={form.default_quantity ?? ""} onChange={(e) => setForm((p) => ({ ...p, default_quantity: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Descrizione</Label><Textarea value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
    </div>
  );
}
