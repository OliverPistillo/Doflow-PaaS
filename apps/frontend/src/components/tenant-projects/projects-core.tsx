"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays, CheckCircle2, Clock, Edit3, Eye, FileText, FolderKanban,
  FolderOpen, KanbanSquare, Loader2, MessageSquare, Plus, Search, Trash2,
  UserPlus, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { shortDate } from "@/components/tenant-crm/crm-core";
import { cn } from "@/lib/utils";

type Row = Record<string, any>;
type ListResponse<T = Row> = { items: T[]; total?: number; limit?: number; offset?: number };
type Option = { value: string; label: string };

const PROJECT_STATUSES: Option[] = [
  { value: "to_start", label: "Da avviare" },
  { value: "kickoff", label: "Kick-off" },
  { value: "materials_collection", label: "Raccolta materiali" },
  { value: "strategy", label: "Strategia" },
  { value: "ux_ui", label: "UX/UI" },
  { value: "copy_content", label: "Copy/contenuti" },
  { value: "development", label: "Sviluppo" },
  { value: "internal_review", label: "Revisione interna" },
  { value: "client_review", label: "Revisione cliente" },
  { value: "corrections", label: "Correzioni" },
  { value: "seo_performance", label: "SEO/Performance" },
  { value: "qa", label: "QA" },
  { value: "publishing", label: "Pubblicazione" },
  { value: "training", label: "Formazione" },
  { value: "delivered", label: "Consegnato" },
  { value: "maintenance", label: "Manutenzione" },
  { value: "closed", label: "Chiuso" },
  { value: "blocked", label: "Bloccato" },
];

const PROJECT_TYPES: Option[] = [
  { value: "website", label: "Sito web" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "maintenance", label: "Manutenzione" },
  { value: "seo", label: "SEO" },
  { value: "hosting", label: "Hosting" },
  { value: "app", label: "App" },
  { value: "custom", label: "Custom" },
];

const PRIORITIES: Option[] = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const MILESTONE_STATUSES: Option[] = [
  { value: "pending", label: "Da fare" },
  { value: "in_progress", label: "In corso" },
  { value: "completed", label: "Completata" },
  { value: "blocked", label: "Bloccata" },
  { value: "skipped", label: "Saltata" },
];

const TASK_STATUSES: Option[] = [
  { value: "backlog", label: "Backlog" },
  { value: "ready", label: "Pronto" },
  { value: "in_progress", label: "In corso" },
  { value: "internal_review", label: "Review interna" },
  { value: "client_review", label: "Review cliente" },
  { value: "blocked", label: "Bloccato" },
  { value: "done", label: "Completato" },
];

const TASK_COLUMNS = ["backlog", "ready", "in_progress", "internal_review", "client_review", "blocked", "done"];

const MEMBER_ROLES: Option[] = [
  { value: "project_manager", label: "Project Manager" },
  { value: "designer", label: "Designer" },
  { value: "developer", label: "Developer" },
  { value: "seo", label: "SEO" },
  { value: "copywriter", label: "Copywriter" },
  { value: "sales", label: "Sales" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Membro" },
  { value: "external", label: "Esterno" },
];

const COMMENT_VISIBILITIES: Option[] = [
  { value: "internal", label: "Interno" },
  { value: "client", label: "Cliente" },
  { value: "private", label: "Privato" },
];

const FILE_TYPES: Option[] = [
  { value: "logo", label: "Logo" },
  { value: "image", label: "Immagine" },
  { value: "video", label: "Video" },
  { value: "text", label: "Testo" },
  { value: "contract", label: "Contratto" },
  { value: "quote", label: "Preventivo" },
  { value: "screenshot", label: "Screenshot" },
  { value: "deliverable", label: "Consegna" },
  { value: "other", label: "Altro" },
];

function labelFor(value: string | undefined, options: Option[]) {
  return options.find((option) => option.value === value)?.label || value || "-";
}

function canReadProjects() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "manager", "editor", "user", "superadmin", "super_admin"].includes(role);
}

function canManageProjects() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "manager", "superadmin", "super_admin"].includes(role);
}

function canSeeSensitiveTeamData() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin"].includes(role);
}

function roleIsViewer() {
  return String(getDoFlowUser()?.role || "").toLowerCase() === "viewer";
}

function toBody(form: Record<string, any>) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "" && value !== undefined));
}

async function loadList(path: string, params?: URLSearchParams) {
  const query = params?.toString();
  return apiFetch<ListResponse>(`${path}${query ? `?${query}` : ""}`);
}

function AccessDenied({ title = "Progetti" }: { title?: string }) {
  return (
    <div className="flex-1 p-4 md:p-6">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Questa sezione contiene lavoro interno e non e' disponibile per il ruolo viewer.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function StateBadge({ value, options }: { value?: string; options: Option[] }) {
  const tone = value === "blocked" || value === "urgent"
    ? "border-destructive/30 text-destructive"
    : value === "done" || value === "completed" || value === "delivered" || value === "closed"
      ? "border-emerald-500/30 text-emerald-600"
      : "border-border text-muted-foreground";
  return <Badge variant="outline" className={tone}>{labelFor(value, options)}</Badge>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">{children}</div>;
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
            {row.name || row.title || row.quote_number || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || row.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function useProjectRelations(includeBriefings = true, includeQuotes = true) {
  const [relations, setRelations] = useState<Record<string, Row[]>>({
    companies: [],
    contacts: [],
    opportunities: [],
    briefings: [],
    quotes: [],
  });

  const load = async () => {
    const [companies, contacts, opportunities, briefings, quotes] = await Promise.all([
      loadList("/tenant/crm/companies?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/crm/contacts?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/crm/opportunities?limit=100").catch(() => ({ items: [] })),
      includeBriefings ? loadList("/tenant/briefing?limit=100").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      includeQuotes ? loadList("/tenant/quotes?limit=100").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
    ]);
    setRelations({
      companies: companies.items || [],
      contacts: contacts.items || [],
      opportunities: opportunities.items || [],
      briefings: briefings.items || [],
      quotes: quotes.items || [],
    });
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { relations, reloadRelations: load };
}

function ProjectForm({
  form,
  setForm,
  relations,
}: {
  form: Record<string, any>;
  setForm: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  relations: Record<string, Row[]>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Nome progetto *</Label><Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Descrizione</Label><Textarea value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.type} options={PROJECT_TYPES} placeholder="Tipo progetto" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /></div>
      <div className="grid gap-2"><Label>Stato</Label><SelectField value={form.status} options={PROJECT_STATUSES} placeholder="Stato" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Priorità</Label><SelectField value={form.priority} options={PRIORITIES} placeholder="Priorità" onChange={(v) => setForm((p) => ({ ...p, priority: v }))} /></div>
      <div className="grid gap-2"><Label>Fase corrente</Label><Input value={form.current_phase || ""} onChange={(e) => setForm((p) => ({ ...p, current_phase: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Contatto</Label><RelationSelect value={form.contact_id} rows={relations.contacts} placeholder="Nessun contatto" onChange={(v) => setForm((p) => ({ ...p, contact_id: v }))} /></div>
      <div className="grid gap-2"><Label>Opportunità</Label><RelationSelect value={form.opportunity_id} rows={relations.opportunities} placeholder="Nessuna opportunità" onChange={(v) => setForm((p) => ({ ...p, opportunity_id: v }))} /></div>
      <div className="grid gap-2"><Label>Briefing</Label><RelationSelect value={form.briefing_id} rows={relations.briefings} placeholder="Nessun briefing" onChange={(v) => setForm((p) => ({ ...p, briefing_id: v }))} /></div>
      <div className="grid gap-2"><Label>Preventivo</Label><RelationSelect value={form.quote_id} rows={relations.quotes} placeholder="Nessun preventivo" onChange={(v) => setForm((p) => ({ ...p, quote_id: v }))} /></div>
      <div className="grid gap-2"><Label>Project manager ID</Label><Input value={form.project_manager_id || ""} onChange={(e) => setForm((p) => ({ ...p, project_manager_id: e.target.value }))} placeholder="UUID opzionale" /></div>
      <div className="grid gap-2"><Label>Data inizio</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Scadenza</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note cliente</Label><Textarea value={form.client_notes || ""} onChange={(e) => setForm((p) => ({ ...p, client_notes: e.target.value }))} /></div>
    </div>
  );
}

export function ProjectsListPage() {
  const router = useRouter();
  const { relations } = useProjectRelations(false, false);
  const [items, setItems] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const [priority, setPriority] = useState("__all__");
  const [pm, setPm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "__all__") params.set("status", status);
      if (priority !== "__all__") params.set("priority", priority);
      if (pm.trim()) params.set("project_manager_id", pm.trim());
      const data = await loadList("/tenant/projects", params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento progetti");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, priority, pm]);

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      description: row.description || "",
      type: row.type || "",
      status: row.status || "to_start",
      priority: row.priority || "medium",
      current_phase: row.current_phase || "",
      company_id: row.company_id || "",
      contact_id: row.contact_id || "",
      opportunity_id: row.opportunity_id || "",
      briefing_id: row.briefing_id || "",
      quote_id: row.quote_id || "",
      project_manager_id: row.project_manager_id || "",
      start_date: row.start_date ? String(row.start_date).slice(0, 10) : "",
      due_date: row.due_date ? String(row.due_date).slice(0, 10) : "",
      internal_notes: row.internal_notes || "",
      client_notes: row.client_notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await apiFetch(`/tenant/projects/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    setEditing(null);
    await load();
  };

  const updateStatus = async (row: Row, next: string) => {
    await apiFetch(`/tenant/projects/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    await load();
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questo progetto?")) return;
    await apiFetch(`/tenant/projects/${row.id}`, { method: "DELETE" });
    await load();
  };

  if (!canReadProjects()) return <AccessDenied />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progetti</h1>
          <p className="mt-1 text-sm text-muted-foreground">Progetti reali tenant-scoped per la delivery doflow. Nessun dato dimostrativo.</p>
        </div>
        {canManageProjects() ? <Button onClick={() => router.push("/projects/new")}><Plus className="mr-2 h-4 w-4" /> Nuovo progetto</Button> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Archivio progetti</CardTitle>
          <CardDescription>{items.length} progetti trovati.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_260px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca progetti..." className="pl-9" /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti gli stati</SelectItem>{PROJECT_STATUSES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue placeholder="Priorità" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutte</SelectItem>{PRIORITIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <Input value={pm} onChange={(e) => setPm(e.target.value)} placeholder="Filtro project_manager_id opzionale" />
          </div>
          <ErrorBox error={error} />
          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>
          ) : items.length === 0 ? (
            <EmptyState>Nessun progetto reale trovato. Crea un progetto da un preventivo accettato o dal pulsante Nuovo progetto.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Progetto</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Stato</th>
                    <th className="px-4 py-3">Priorità</th>
                    <th className="px-4 py-3">Scadenza</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${row.id}`} className="font-semibold text-primary hover:underline">{row.name}</Link>
                        <p className="text-xs text-muted-foreground">{labelFor(row.type, PROJECT_TYPES)} · {row.project_manager_email || "PM non assegnato"}</p>
                      </td>
                      <td className="px-4 py-3">{row.company_name || "-"}</td>
                      <td className="px-4 py-3"><StateBadge value={row.status} options={PROJECT_STATUSES} /></td>
                      <td className="px-4 py-3"><StateBadge value={row.priority} options={PRIORITIES} /></td>
                      <td className="px-4 py-3">{shortDate(row.due_date)}</td>
                      <td className="px-4 py-3"><Progress value={Number(row.progress || 0)} className="h-2 w-28" /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => router.push(`/projects/${row.id}`)}><Eye className="h-4 w-4" /></Button>
                          {canManageProjects() ? <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Edit3 className="h-4 w-4" /></Button> : null}
                          {canManageProjects() ? (
                            <Select value={row.status || "to_start"} onValueChange={(next) => updateStatus(row, next)}>
                              <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{PROJECT_STATUSES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : null}
                          {canManageProjects() ? <Button size="sm" variant="outline" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}
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

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Modifica progetto</DialogTitle><DialogDescription>Aggiorna i dati base del progetto.</DialogDescription></DialogHeader>
          <ProjectForm form={form} setForm={setForm} relations={relations} />
          <DialogFooter><Button onClick={saveEdit} disabled={!form.name}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProjectCreatePage() {
  const router = useRouter();
  const { relations } = useProjectRelations(true, true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ name: "", status: "to_start", priority: "medium", type: "website" });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const project = await apiFetch<Row>("/tenant/projects", { method: "POST", body: JSON.stringify(toBody(form)) });
      router.push(project?.id ? `/projects/${project.id}` : "/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione progetto");
    } finally {
      setSaving(false);
    }
  };

  if (!canManageProjects()) return <AccessDenied title="Nuovo progetto" />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Nuovo progetto</h1><p className="mt-1 text-sm text-muted-foreground">Crea un progetto reale nello schema tenant corrente.</p></div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <ErrorBox error={error} />
          <ProjectForm form={form} setForm={setForm} relations={relations} />
          <div className="flex gap-2"><Button onClick={save} disabled={saving || !form.name}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Crea progetto</Button><Button variant="outline" onClick={() => router.push("/projects")}>Annulla</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { relations } = useProjectRelations(true, true);
  const [project, setProject] = useState<Row | null>(null);
  const [milestones, setMilestones] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [comments, setComments] = useState<Row[]>([]);
  const [files, setFiles] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [milestoneForm, setMilestoneForm] = useState<Record<string, any>>({ title: "", status: "pending" });
  const [taskForm, setTaskForm] = useState<Record<string, any>>({ title: "", status: "backlog", priority: "medium" });
  const [memberForm, setMemberForm] = useState<Record<string, any>>({ user_id: "", role: "member" });
  const [commentForm, setCommentForm] = useState<Record<string, any>>({ body: "", visibility: "internal" });
  const [fileForm, setFileForm] = useState<Record<string, any>>({ file_id: "", type: "other", visibility: "internal" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectData, milestonesData, tasksData, membersData, commentsData, filesData] = await Promise.all([
        apiFetch<Row>(`/tenant/projects/${projectId}`),
        loadList(`/tenant/projects/${projectId}/milestones`).catch(() => ({ items: [] })),
        loadList(`/tenant/projects/${projectId}/tasks`).catch(() => ({ items: [] })),
        loadList(`/tenant/projects/${projectId}/members`).catch(() => ({ items: [] })),
        loadList(`/tenant/projects/${projectId}/comments`).catch(() => ({ items: [] })),
        loadList(`/tenant/projects/${projectId}/files`).catch(() => ({ items: [] })),
      ]);
      setProject(projectData);
      setMilestones(milestonesData.items || []);
      setTasks(tasksData.items || []);
      setMembers(membersData.items || []);
      setComments(commentsData.items || []);
      setFiles(filesData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento progetto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openEdit = () => {
    if (!project) return;
    setForm({
      name: project.name || "",
      description: project.description || "",
      type: project.type || "",
      status: project.status || "to_start",
      priority: project.priority || "medium",
      current_phase: project.current_phase || "",
      progress: project.progress ?? 0,
      company_id: project.company_id || "",
      contact_id: project.contact_id || "",
      opportunity_id: project.opportunity_id || "",
      briefing_id: project.briefing_id || "",
      quote_id: project.quote_id || "",
      project_manager_id: project.project_manager_id || "",
      start_date: project.start_date ? String(project.start_date).slice(0, 10) : "",
      due_date: project.due_date ? String(project.due_date).slice(0, 10) : "",
      internal_notes: project.internal_notes || "",
      client_notes: project.client_notes || "",
    });
    setEditOpen(true);
  };

  const saveProject = async () => {
    await apiFetch(`/tenant/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    setEditOpen(false);
    await load();
  };

  const createMilestone = async () => {
    await apiFetch(`/tenant/projects/${projectId}/milestones`, { method: "POST", body: JSON.stringify(toBody(milestoneForm)) });
    setMilestoneForm({ title: "", status: "pending" });
    await load();
  };
  const updateMilestone = async (row: Row, patch: Record<string, any>) => {
    await apiFetch(`/tenant/projects/${projectId}/milestones/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  };
  const deleteMilestone = async (row: Row) => {
    if (!window.confirm("Eliminare questa milestone?")) return;
    await apiFetch(`/tenant/projects/${projectId}/milestones/${row.id}`, { method: "DELETE" });
    await load();
  };
  const completeMilestone = async (row: Row) => {
    await apiFetch(`/tenant/projects/${projectId}/milestones/${row.id}/complete`, { method: "PATCH" });
    await load();
  };

  const createTask = async () => {
    await apiFetch(`/tenant/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(toBody(taskForm)) });
    setTaskForm({ title: "", status: "backlog", priority: "medium" });
    await load();
  };
  const patchTask = async (row: Row, patch: Record<string, any>) => {
    await apiFetch(`/tenant/projects/${projectId}/tasks/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  };
  const completeTask = async (row: Row) => {
    await apiFetch(`/tenant/projects/${projectId}/tasks/${row.id}/complete`, { method: "PATCH" });
    await load();
  };
  const deleteTask = async (row: Row) => {
    if (!window.confirm("Eliminare questo task?")) return;
    await apiFetch(`/tenant/projects/${projectId}/tasks/${row.id}`, { method: "DELETE" });
    await load();
  };

  const addMember = async () => {
    await apiFetch(`/tenant/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(toBody(memberForm)) });
    setMemberForm({ user_id: "", role: "member" });
    await load();
  };
  const deleteMember = async (row: Row) => {
    await apiFetch(`/tenant/projects/${projectId}/members/${row.id}`, { method: "DELETE" });
    await load();
  };
  const addComment = async () => {
    await apiFetch(`/tenant/projects/${projectId}/comments`, { method: "POST", body: JSON.stringify(toBody(commentForm)) });
    setCommentForm({ body: "", visibility: "internal" });
    await load();
  };
  const deleteComment = async (row: Row) => {
    await apiFetch(`/tenant/projects/comments/${row.id}`, { method: "DELETE" });
    await load();
  };
  const addFile = async () => {
    await apiFetch(`/tenant/projects/${projectId}/files`, { method: "POST", body: JSON.stringify(toBody(fileForm)) });
    setFileForm({ file_id: "", type: "other", visibility: "internal" });
    await load();
  };
  const deleteFile = async (row: Row) => {
    await apiFetch(`/tenant/projects/files/${row.id}`, { method: "DELETE" });
    await load();
  };

  if (!canReadProjects()) return <AccessDenied />;
  if (loading) return <div className="flex flex-1 justify-center py-24 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento progetto...</div>;
  if (error || !project) return <div className="flex-1 p-4 md:p-6"><ErrorBox error={error || "Progetto non trovato"} /></div>;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button variant="outline" size="sm" onClick={() => router.push("/projects")} className="mb-3">Torna ai progetti</Button>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{project.company_name || "Cliente non collegato"} · {labelFor(project.type, PROJECT_TYPES)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StateBadge value={project.status} options={PROJECT_STATUSES} />
          <StateBadge value={project.priority} options={PRIORITIES} />
          {canManageProjects() ? <Button onClick={openEdit}><Edit3 className="mr-2 h-4 w-4" /> Modifica</Button> : null}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="milestones">Milestone</TabsTrigger>
          <TabsTrigger value="tasks">Task</TabsTrigger>
          <TabsTrigger value="members">Membri</TabsTrigger>
          <TabsTrigger value="comments">Commenti</TabsTrigger>
          <TabsTrigger value="files">File</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard label="Stato" value={labelFor(project.status, PROJECT_STATUSES)} />
            <InfoCard label="Priorità" value={labelFor(project.priority, PRIORITIES)} />
            <InfoCard label="Scadenza" value={shortDate(project.due_date)} />
            <InfoCard label="Fase corrente" value={project.current_phase || "-"} />
            <InfoCard label="Project manager" value={project.project_manager_email || project.project_manager_id || "-"} />
            <InfoCard label="Preventivo" value={project.quote_number || project.quote_title || "-"} />
          </div>
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-lg">Avanzamento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Progress value={Number(project.progress || 0)} />
              <p className="text-sm text-muted-foreground">{Number(project.progress || 0)}% completato</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-sm font-semibold">Note interne</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{project.internal_notes || "Nessuna nota interna."}</p></div>
                <div><p className="text-sm font-semibold">Note cliente</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{project.client_notes || "Nessuna nota cliente."}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="milestones">
          <MilestonesPanel items={milestones} form={milestoneForm} setForm={setMilestoneForm} onCreate={createMilestone} onPatch={updateMilestone} onComplete={completeMilestone} onDelete={deleteMilestone} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksPanel projectId={projectId} items={tasks} form={taskForm} setForm={setTaskForm} milestones={milestones} onCreate={createTask} onPatch={patchTask} onComplete={completeTask} onDelete={deleteTask} />
        </TabsContent>
        <TabsContent value="members">
          <MembersPanel items={members} form={memberForm} setForm={setMemberForm} onCreate={addMember} onDelete={deleteMember} />
        </TabsContent>
        <TabsContent value="comments">
          <CommentsPanel items={comments} form={commentForm} setForm={setCommentForm} onCreate={addComment} onDelete={deleteComment} />
        </TabsContent>
        <TabsContent value="files">
          <FilesPanel items={files} form={fileForm} setForm={setFileForm} onCreate={addFile} onDelete={deleteFile} />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Modifica progetto</DialogTitle></DialogHeader>
          <ProjectForm form={form} setForm={setForm} relations={relations} />
          <DialogFooter><Button onClick={saveProject} disabled={!form.name}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></CardContent></Card>;
}

function MilestonesPanel({
  items, form, setForm, onCreate, onPatch, onComplete, onDelete,
}: {
  items: Row[];
  form: Record<string, any>;
  setForm: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  onCreate: () => void;
  onPatch: (row: Row, patch: Record<string, any>) => void;
  onComplete: (row: Row) => void;
  onDelete: (row: Row) => void;
}) {
  return (
    <Card><CardHeader><CardTitle className="text-lg">Milestone</CardTitle><CardDescription>Punti di avanzamento reali del progetto.</CardDescription></CardHeader><CardContent className="space-y-4">
      {canManageProjects() ? <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]"><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titolo milestone" /><SelectField value={form.status} options={MILESTONE_STATUSES} placeholder="Stato" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} /><Button onClick={onCreate} disabled={!form.title}><Plus className="mr-2 h-4 w-4" /> Aggiungi</Button></div> : null}
      {items.length === 0 ? <EmptyState>Nessuna milestone reale collegata.</EmptyState> : <div className="space-y-2">{items.map((row) => <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{row.title}</p><p className="text-xs text-muted-foreground">Scadenza {shortDate(row.due_date)}</p></div><div className="flex flex-wrap gap-2"><StateBadge value={row.status} options={MILESTONE_STATUSES} />{canManageProjects() ? <Select value={row.status || "pending"} onValueChange={(v) => onPatch(row, { status: v })}><SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{MILESTONE_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select> : null}{canManageProjects() ? <Button size="sm" variant="outline" onClick={() => onComplete(row)}><CheckCircle2 className="h-4 w-4" /></Button> : null}{canManageProjects() ? <Button size="sm" variant="outline" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}</div></div>)}</div>}
    </CardContent></Card>
  );
}

function TasksPanel({
  projectId, items, form, setForm, milestones, onCreate, onPatch, onComplete, onDelete,
}: {
  projectId?: string;
  items: Row[];
  form?: Record<string, any>;
  setForm?: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  milestones?: Row[];
  onCreate?: () => void;
  onPatch: (row: Row, patch: Record<string, any>) => void;
  onComplete: (row: Row) => void;
  onDelete?: (row: Row) => void;
}) {
  const [checklistTask, setChecklistTask] = useState<Row | null>(null);
  const [checklist, setChecklist] = useState<Row[]>([]);
  const [checklistTitle, setChecklistTitle] = useState("");

  const loadChecklist = async (task: Row) => {
    setChecklistTask(task);
    const data = await loadList(`/tenant/projects/tasks/${task.id}/checklist`).catch(() => ({ items: [] }));
    setChecklist(data.items || []);
  };
  const addChecklist = async () => {
    if (!checklistTask || !checklistTitle.trim()) return;
    await apiFetch(`/tenant/projects/tasks/${checklistTask.id}/checklist`, { method: "POST", body: JSON.stringify({ title: checklistTitle }) });
    setChecklistTitle("");
    await loadChecklist(checklistTask);
  };
  const patchChecklist = async (item: Row, patch: Record<string, any>) => {
    if (!checklistTask) return;
    await apiFetch(`/tenant/projects/tasks/${checklistTask.id}/checklist/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await loadChecklist(checklistTask);
  };
  const deleteChecklist = async (item: Row) => {
    if (!checklistTask) return;
    await apiFetch(`/tenant/projects/tasks/${checklistTask.id}/checklist/${item.id}`, { method: "DELETE" });
    await loadChecklist(checklistTask);
  };

  return (
    <Card><CardHeader><CardTitle className="text-lg">Task</CardTitle><CardDescription>Task reali con status Projects V2.</CardDescription></CardHeader><CardContent className="space-y-4">
      {projectId && canManageProjects() && onCreate && form && setForm ? <div className="grid gap-3 lg:grid-cols-[1fr_150px_150px_180px_auto]"><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titolo task" /><SelectField value={form.status} options={TASK_STATUSES} placeholder="Stato" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /><SelectField value={form.priority} options={PRIORITIES} placeholder="Priorità" onChange={(v) => setForm((p) => ({ ...p, priority: v }))} /><RelationSelect value={form.milestone_id} rows={milestones || []} placeholder="Nessuna milestone" onChange={(v) => setForm((p) => ({ ...p, milestone_id: v }))} /><Button onClick={onCreate} disabled={!form.title}><Plus className="mr-2 h-4 w-4" /> Aggiungi</Button></div> : null}
      {items.length === 0 ? <EmptyState>Nessun task reale trovato.</EmptyState> : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[860px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Task</th><th className="px-4 py-3">Progetto</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3">Priorità</th><th className="px-4 py-3">Scadenza</th><th className="px-4 py-3 text-right">Azioni</th></tr></thead><tbody>{items.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3 font-semibold">{row.title}<p className="text-xs font-normal text-muted-foreground">{row.assignee_email || row.assignee_id || "Non assegnato"}</p></td><td className="px-4 py-3">{row.project_name || "-"}</td><td className="px-4 py-3"><StateBadge value={row.status} options={TASK_STATUSES} /></td><td className="px-4 py-3"><StateBadge value={row.priority} options={PRIORITIES} /></td><td className={cn("px-4 py-3", row.due_at && new Date(row.due_at) < new Date() && row.status !== "done" && "text-destructive font-semibold")}>{shortDate(row.due_at)}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => loadChecklist(row)}><CheckCircle2 className="h-4 w-4" /></Button><Select value={row.status || "backlog"} onValueChange={(v) => onPatch(row, { status: v, completed_at: v === "done" ? new Date().toISOString() : null })}><SelectTrigger className="h-8 w-[145px]"><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={() => onComplete(row)}><CheckCircle2 className="h-4 w-4" /></Button>{canManageProjects() && onDelete ? <Button size="sm" variant="outline" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}</div></td></tr>)}</tbody></table></div>}
      <Dialog open={!!checklistTask} onOpenChange={(open) => { if (!open) setChecklistTask(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Checklist task</DialogTitle><DialogDescription>{checklistTask?.title}</DialogDescription></DialogHeader><div className="flex gap-2"><Input value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} placeholder="Nuovo punto checklist" /><Button onClick={addChecklist} disabled={!checklistTitle.trim()}>Aggiungi</Button></div>{checklist.length === 0 ? <EmptyState>Nessun punto checklist.</EmptyState> : <div className="space-y-2">{checklist.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3"><button className={cn("text-left text-sm", item.is_done && "line-through text-muted-foreground")} onClick={() => patchChecklist(item, { is_done: !item.is_done })}>{item.title}</button><Button size="sm" variant="outline" onClick={() => deleteChecklist(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}</DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}

function MembersPanel({ items, form, setForm, onCreate, onDelete }: { items: Row[]; form: Record<string, any>; setForm: (updater: (prev: Record<string, any>) => Record<string, any>) => void; onCreate: () => void; onDelete: (row: Row) => void }) {
  return <Card><CardHeader><CardTitle className="text-lg">Membri</CardTitle><CardDescription>Team assegnato al progetto.</CardDescription></CardHeader><CardContent className="space-y-4">{canManageProjects() ? <div className="grid gap-3 md:grid-cols-[1fr_200px_160px_auto]"><Input value={form.user_id || ""} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))} placeholder="UUID utente" /><SelectField value={form.role} options={MEMBER_ROLES} placeholder="Ruolo" onChange={(v) => setForm((p) => ({ ...p, role: v }))} />{canSeeSensitiveTeamData() ? <Input type="number" value={form.allocation_percent || ""} onChange={(e) => setForm((p) => ({ ...p, allocation_percent: e.target.value }))} placeholder="Allocation %" /> : <div className="hidden md:block" />}<Button onClick={onCreate} disabled={!form.user_id}><UserPlus className="mr-2 h-4 w-4" /> Aggiungi</Button></div> : null}{items.length === 0 ? <EmptyState>Nessun membro assegnato.</EmptyState> : <div className="space-y-2">{items.map((row) => <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{row.full_name || row.email || row.user_id}</p><p className="text-xs text-muted-foreground">{labelFor(row.role, MEMBER_ROLES)}{canSeeSensitiveTeamData() && row.allocation_percent ? ` · ${row.allocation_percent}%` : ""}</p></div>{canManageProjects() ? <Button size="sm" variant="outline" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}</div>)}</div>}</CardContent></Card>;
}

function CommentsPanel({ items, form, setForm, onCreate, onDelete }: { items: Row[]; form: Record<string, any>; setForm: (updater: (prev: Record<string, any>) => Record<string, any>) => void; onCreate: () => void; onDelete: (row: Row) => void }) {
  const visibleItems = roleIsViewer() ? [] : items.filter((row) => row.visibility !== "private" || canSeeSensitiveTeamData());
  return <Card><CardHeader><CardTitle className="text-lg">Commenti</CardTitle><CardDescription>Note operative interne e commenti cliente.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-[1fr_180px_auto]"><Textarea value={form.body || ""} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} placeholder="Scrivi un commento operativo..." /><SelectField value={form.visibility} options={COMMENT_VISIBILITIES.filter((o) => canSeeSensitiveTeamData() || o.value !== "private")} placeholder="Visibilità" onChange={(v) => setForm((p) => ({ ...p, visibility: v }))} /><Button onClick={onCreate} disabled={!form.body}><MessageSquare className="mr-2 h-4 w-4" /> Commenta</Button></div>{visibleItems.length === 0 ? <EmptyState>Nessun commento reale.</EmptyState> : <div className="space-y-2">{visibleItems.map((row) => <div key={row.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="whitespace-pre-wrap text-sm">{row.body}</p><p className="mt-2 text-xs text-muted-foreground">{row.created_by_email || row.created_by || "Utente"} · {labelFor(row.visibility, COMMENT_VISIBILITIES)} · {shortDate(row.created_at)}</p></div><Button size="sm" variant="outline" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}</CardContent></Card>;
}

function FilesPanel({ items, form, setForm, onCreate, onDelete }: { items: Row[]; form: Record<string, any>; setForm: (updater: (prev: Record<string, any>) => Record<string, any>) => void; onCreate: () => void; onDelete: (row: Row) => void }) {
  return <Card><CardHeader><CardTitle className="text-lg">File progetto</CardTitle><CardDescription>Collegamento file esistenti via file_id. Upload completo non incluso in questa fase.</CardDescription></CardHeader><CardContent className="space-y-4">{canManageProjects() ? <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]"><Input value={form.file_id || ""} onChange={(e) => setForm((p) => ({ ...p, file_id: e.target.value }))} placeholder="UUID file_id" /><SelectField value={form.type} options={FILE_TYPES} placeholder="Tipo file" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /><SelectField value={form.visibility} options={COMMENT_VISIBILITIES} placeholder="Visibilità" onChange={(v) => setForm((p) => ({ ...p, visibility: v }))} /><Button onClick={onCreate} disabled={!form.file_id}><FolderOpen className="mr-2 h-4 w-4" /> Collega</Button></div> : null}{items.length === 0 ? <EmptyState>Nessun file collegato. Il collegamento file resta reale, ma l'upload non viene simulato.</EmptyState> : <div className="space-y-2">{items.map((row) => <div key={row.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-mono text-sm">{row.file_id}</p><p className="text-xs text-muted-foreground">{labelFor(row.type, FILE_TYPES)} · {labelFor(row.visibility, FILE_VISIBILITIES)}</p></div>{canManageProjects() ? <Button size="sm" variant="outline" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}</div>)}</div>}</CardContent></Card>;
}

const FILE_VISIBILITIES = COMMENT_VISIBILITIES;

export function ProjectsKanbanPage() {
  const [tasks, setTasks] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Row[]>([]);
  const [projectId, setProjectId] = useState("__all__");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (projectId !== "__all__") params.set("project_id", projectId);
      const [tasksData, projectsData] = await Promise.all([
        loadList("/tenant/projects/tasks", params),
        loadList("/tenant/projects?limit=100").catch(() => ({ items: [] })),
      ]);
      setTasks(tasksData.items || []);
      setProjects(projectsData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento kanban");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const move = async (task: Row, status: string) => {
    if (!task.project_id) return;
    await apiFetch(`/tenant/projects/${task.project_id}/tasks/${task.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  };

  if (!canReadProjects()) return <AccessDenied title="Kanban progetti" />;

  return <div className="flex-1 space-y-5 p-4 md:p-6"><div><h1 className="text-2xl font-bold tracking-tight">Kanban task</h1><p className="mt-1 text-sm text-muted-foreground">Task reali raggruppati per status. Spostamento tramite controlli, senza drag&drop finto.</p></div><div className="max-w-sm"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue placeholder="Filtro progetto" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti i progetti</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><ErrorBox error={error} />{loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : <div className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-7">{TASK_COLUMNS.map((status) => { const columnTasks = tasks.filter((task) => task.status === status); return <Card key={status} className="min-h-[260px]"><CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-base">{labelFor(status, TASK_STATUSES)}<Badge variant="outline">{columnTasks.length}</Badge></CardTitle></CardHeader><CardContent className="space-y-3">{columnTasks.length === 0 ? <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-8 text-center text-xs text-muted-foreground">Nessun task</div> : columnTasks.map((task) => <div key={task.id} className="rounded-lg border bg-background p-3 shadow-sm"><p className="font-semibold">{task.title}</p><p className="text-xs text-muted-foreground">{task.project_name || "Progetto non collegato"} · {shortDate(task.due_at)}</p><StateBadge value={task.priority} options={PRIORITIES} /><Select value={task.status || "backlog"} onValueChange={(next) => move(task, next)}><SelectTrigger className="mt-3 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUSES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>)}</CardContent></Card>; })}</div>}</div>;
}

export function ProjectsTasksPage() {
  const [tasks, setTasks] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const [projectId, setProjectId] = useState("__all__");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "__all__") params.set("status", status);
      if (projectId !== "__all__") params.set("project_id", projectId);
      const [tasksData, projectsData] = await Promise.all([
        loadList("/tenant/projects/tasks", params),
        loadList("/tenant/projects?limit=100").catch(() => ({ items: [] })),
      ]);
      setTasks(tasksData.items || []);
      setProjects(projectsData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento task");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, projectId]);

  const patchTask = async (task: Row, patch: Record<string, any>) => {
    await apiFetch(`/tenant/projects/${task.project_id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  };
  const completeTask = async (task: Row) => {
    await apiFetch(`/tenant/projects/${task.project_id}/tasks/${task.id}/complete`, { method: "PATCH" });
    await load();
  };

  if (!canReadProjects()) return <AccessDenied title="Task progetti" />;

  return <div className="flex-1 space-y-5 p-4 md:p-6"><div><h1 className="text-2xl font-bold tracking-tight">Task progetti</h1><p className="mt-1 text-sm text-muted-foreground">Vista globale task Projects V2.</p></div><Card><CardContent className="space-y-4 pt-6"><div className="grid gap-3 md:grid-cols-[1fr_180px_240px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca task..." className="pl-9" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{TASK_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue placeholder="Progetto" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti i progetti</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div><ErrorBox error={error} />{loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : <TasksPanel items={tasks} onPatch={patchTask} onComplete={completeTask} />}</CardContent></Card></div>;
}

export function ProjectsTimelinePage() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [milestones, setMilestones] = useState<Array<Row & { project_name?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const projectsData = await loadList("/tenant/projects?limit=100").catch(() => ({ items: [] }));
      const projectItems = projectsData.items || [];
      const milestoneLists = await Promise.all(projectItems.map(async (project) => {
        const data = await loadList(`/tenant/projects/${project.id}/milestones`).catch(() => ({ items: [] }));
        return (data.items || []).map((m) => ({ ...m, project_name: project.name }));
      }));
      setProjects(projectItems);
      setMilestones(milestoneLists.flat());
      setLoading(false);
    };
    void run();
  }, []);

  if (!canReadProjects()) return <AccessDenied title="Timeline progetti" />;
  const datedProjects = projects.filter((p) => p.start_date || p.due_date);
  const datedMilestones = milestones.filter((m) => m.due_date);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><div><h1 className="text-2xl font-bold tracking-tight">Timeline</h1><p className="mt-1 text-sm text-muted-foreground">Timeline semplice basata su date reali di progetti e milestone.</p></div>{loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Progetti con date</CardTitle></CardHeader><CardContent className="space-y-2">{datedProjects.length === 0 ? <EmptyState>Nessun progetto con date.</EmptyState> : datedProjects.map((p) => <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-lg border p-3 hover:bg-muted/40"><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{shortDate(p.start_date)} → {shortDate(p.due_date)}</p></Link>)}</CardContent></Card><Card><CardHeader><CardTitle>Milestone prossime</CardTitle></CardHeader><CardContent className="space-y-2">{datedMilestones.length === 0 ? <EmptyState>Nessuna milestone con scadenza.</EmptyState> : datedMilestones.map((m) => <div key={m.id} className="rounded-lg border p-3"><p className="font-semibold">{m.title}</p><p className="text-xs text-muted-foreground">{m.project_name} · {shortDate(m.due_date)}</p></div>)}</CardContent></Card></div>}</div>;
}

export function ProjectsMilestonesPage() {
  const [items, setItems] = useState<Array<Row & { project_id?: string; project_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("__all__");
  const load = async () => {
    setLoading(true);
    const projectsData = await loadList("/tenant/projects?limit=100").catch(() => ({ items: [] }));
    const lists = await Promise.all((projectsData.items || []).map(async (project) => {
      const data = await loadList(`/tenant/projects/${project.id}/milestones`).catch(() => ({ items: [] }));
      return (data.items || []).map((m) => ({ ...m, project_id: project.id, project_name: project.name }));
    }));
    setItems(lists.flat());
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const visible = status === "__all__" ? items : items.filter((m) => m.status === status);
  const complete = async (m: Row) => {
    await apiFetch(`/tenant/projects/${m.project_id}/milestones/${m.id}/complete`, { method: "PATCH" });
    await load();
  };
  if (!canReadProjects()) return <AccessDenied title="Milestone progetti" />;
  return <div className="flex-1 space-y-5 p-4 md:p-6"><div><h1 className="text-2xl font-bold tracking-tight">Milestone</h1><p className="mt-1 text-sm text-muted-foreground">Vista globale caricata dai progetti, finché non esiste un endpoint milestone globale.</p></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="max-w-xs"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutte</SelectItem>{MILESTONE_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>{loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : visible.length === 0 ? <EmptyState>Nessuna milestone reale trovata.</EmptyState> : <div className="space-y-2">{visible.map((m) => <div key={m.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{m.title}</p><p className="text-xs text-muted-foreground">{m.project_name} · {shortDate(m.due_date)}</p></div><div className="flex gap-2"><StateBadge value={m.status} options={MILESTONE_STATUSES} />{canManageProjects() ? <Button size="sm" variant="outline" onClick={() => complete(m)}>Completa</Button> : null}</div></div>)}</div>}</div>;
}

export function ProjectsFilesPage() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [projectId, setProjectId] = useState("");
  const [files, setFiles] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, any>>({ file_id: "", type: "other", visibility: "internal" });
  const loadProjects = async () => {
    const data = await loadList("/tenant/projects?limit=100").catch(() => ({ items: [] }));
    setProjects(data.items || []);
  };
  const loadFiles = async (id = projectId) => {
    if (!id) return;
    const data = await loadList(`/tenant/projects/${id}/files`).catch(() => ({ items: [] }));
    setFiles(data.items || []);
  };
  useEffect(() => { void loadProjects(); }, []);
  useEffect(() => { void loadFiles(projectId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);
  const add = async () => {
    if (!projectId) return;
    await apiFetch(`/tenant/projects/${projectId}/files`, { method: "POST", body: JSON.stringify(toBody(form)) });
    setForm({ file_id: "", type: "other", visibility: "internal" });
    await loadFiles();
  };
  const remove = async (row: Row) => {
    await apiFetch(`/tenant/projects/files/${row.id}`, { method: "DELETE" });
    await loadFiles();
  };
  if (!canReadProjects()) return <AccessDenied title="File progetto" />;
  return <div className="flex-1 space-y-5 p-4 md:p-6"><div><h1 className="text-2xl font-bold tracking-tight">File progetto</h1><p className="mt-1 text-sm text-muted-foreground">Seleziona un progetto e visualizza link file reali. Upload non simulato.</p></div><Card><CardContent className="space-y-4 pt-6"><Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? "" : v)}><SelectTrigger className="max-w-md"><SelectValue placeholder="Seleziona progetto" /></SelectTrigger><SelectContent><SelectItem value="__none__">Seleziona progetto</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>{projectId ? <FilesPanel items={files} form={form} setForm={setForm} onCreate={add} onDelete={remove} /> : <EmptyState>Seleziona un progetto per vedere i file collegati.</EmptyState>}</CardContent></Card></div>;
}
