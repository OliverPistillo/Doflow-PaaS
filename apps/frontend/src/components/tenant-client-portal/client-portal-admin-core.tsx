"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CheckCircle2, ClipboardCheck, Copy, Edit3, Eye, FileQuestion, FolderKanban,
  Loader2, MessageSquare, Plus, Search, Settings, ShieldCheck, Trash2, UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { buildClientInviteLink } from "@/lib/client-portal-api";
import { shortDate } from "@/components/tenant-crm/crm-core";
import { useToast } from "@/hooks/use-toast";

type Row = Record<string, any>;
type ListResponse<T = Row> = { items: T[]; total?: number; limit?: number; offset?: number };
type Option = { value: string; label: string };
type AdminView = "dashboard" | "accounts" | "invites" | "approvals" | "materials" | "comments" | "projects" | "settings";

const ACCOUNT_STATUSES: Option[] = [
  { value: "invited", label: "Invitato" },
  { value: "active", label: "Attivo" },
  { value: "suspended", label: "Sospeso" },
  { value: "disabled", label: "Disabilitato" },
];

const APPROVAL_TYPES: Option[] = [
  { value: "quote_approval", label: "Approvazione preventivo" },
  { value: "briefing_approval", label: "Approvazione briefing" },
  { value: "design_approval", label: "Approvazione design" },
  { value: "content_approval", label: "Approvazione contenuti" },
  { value: "milestone_approval", label: "Approvazione milestone" },
  { value: "go_live_approval", label: "Go live" },
  { value: "file_approval", label: "Approvazione file" },
  { value: "general", label: "Generale" },
];

const APPROVAL_STATUSES: Option[] = [
  { value: "pending", label: "In attesa" },
  { value: "approved", label: "Approvata" },
  { value: "rejected", label: "Rifiutata" },
  { value: "changes_requested", label: "Modifiche richieste" },
  { value: "cancelled", label: "Annullata" },
  { value: "expired", label: "Scaduta" },
];

const MATERIAL_TYPES: Option[] = [
  { value: "logo", label: "Logo" },
  { value: "images", label: "Immagini" },
  { value: "texts", label: "Testi" },
  { value: "credentials", label: "Credenziali" },
  { value: "domain", label: "Dominio" },
  { value: "hosting", label: "Hosting" },
  { value: "brand_assets", label: "Asset brand" },
  { value: "legal_docs", label: "Documenti legali" },
  { value: "generic", label: "Generico" },
];

const MATERIAL_STATUSES: Option[] = [
  { value: "requested", label: "Richiesto" },
  { value: "submitted", label: "Inviato" },
  { value: "approved", label: "Approvato" },
  { value: "rejected", label: "Rifiutato" },
  { value: "cancelled", label: "Annullato" },
];

const ACCESS_LEVELS: Option[] = [
  { value: "viewer", label: "Viewer" },
  { value: "commenter", label: "Commentatore" },
  { value: "approver", label: "Approvatore" },
];

const COMMENT_VISIBILITIES: Option[] = [
  { value: "client", label: "Visibile al cliente" },
  { value: "internal_response", label: "Risposta interna portale" },
];

function canManageClientPortal() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "manager", "superadmin", "super_admin"].includes(role);
}

function labelFor(value: string | undefined, options: Option[]) {
  return options.find((option) => option.value === value)?.label || value || "-";
}

function toBody(form: Record<string, any>) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "" && value !== undefined));
}

async function loadList(path: string, params?: URLSearchParams) {
  const query = params?.toString();
  return apiFetch<ListResponse>(`${path}${query ? `?${query}` : ""}`);
}

function AccessDenied() {
  return (
    <div className="flex-1 p-4 md:p-6">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Portale cliente riservato</CardTitle>
          <CardDescription>Gestione account, inviti, accessi e approvazioni disponibile solo a CEO/Admin/PM.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">{children}</div>;
}

function StateBadge({ value, options }: { value?: string; options: Option[] }) {
  const tone = value === "approved" || value === "active" || value === "submitted"
    ? "border-emerald-500/30 text-emerald-600"
    : value === "rejected" || value === "expired" || value === "disabled"
      ? "border-destructive/30 text-destructive"
      : value === "changes_requested" || value === "pending" || value === "requested"
        ? "border-chart-5/30 text-chart-5"
        : "border-border text-muted-foreground";
  return <Badge variant="outline" className={tone}>{labelFor(value, options)}</Badge>;
}

function SelectField({ value, options, placeholder, onChange }: { value?: string; options: Option[]; placeholder: string; onChange: (value: string) => void }) {
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

function RelationSelect({ value, rows, placeholder, onChange }: { value?: string; rows: Row[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{placeholder}</SelectItem>
        {rows.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.name || row.title || row.email || row.quote_number || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Header({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function useRelations() {
  const [relations, setRelations] = useState<Record<string, Row[]>>({
    companies: [],
    contacts: [],
    projects: [],
    quotes: [],
    briefings: [],
    accounts: [],
  });

  const load = async () => {
    const [companies, contacts, projects, quotes, briefings, accounts] = await Promise.all([
      loadList("/tenant/crm/companies?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/crm/contacts?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/projects?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/quotes?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/briefing?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/client-portal/admin/accounts?limit=100").catch(() => ({ items: [] })),
    ]);
    setRelations({
      companies: companies.items || [],
      contacts: contacts.items || [],
      projects: projects.items || [],
      quotes: quotes.items || [],
      briefings: briefings.items || [],
      accounts: accounts.items || [],
    });
  };

  useEffect(() => {
    if (canManageClientPortal()) void load();
  }, []);

  return { relations, reloadRelations: load };
}

function InviteLinkDialog({ link, onClose }: { link: string; onClose: () => void }) {
  const { toast } = useToast();
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copiato", description: "Invialo manualmente al cliente. Non viene spedita alcuna email." });
  };
  return (
    <Dialog open={Boolean(link)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link invito generato</DialogTitle>
          <DialogDescription>Il link viene mostrato solo ora. Copialo e invialo manualmente al cliente.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs break-all">{link}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
          <Button onClick={copy}><Copy className="mr-2 h-4 w-4" /> Copia link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientPortalAdminPage({ view }: { view: AdminView }) {
  if (!canManageClientPortal()) return <AccessDenied />;
  if (view === "dashboard") return <ClientPortalDashboard />;
  if (view === "accounts") return <AccountsPage />;
  if (view === "invites") return <InvitesPage />;
  if (view === "approvals") return <ApprovalsPage />;
  if (view === "materials") return <MaterialsPage />;
  if (view === "comments") return <CommentsPage />;
  if (view === "projects") return <ProjectAccessPage />;
  return <SettingsPage />;
}

function ClientPortalDashboard() {
  const [summary, setSummary] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await apiFetch<Row>("/tenant/client-portal/admin/summary"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento portale cliente");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Portale cliente" description="Gestione account cliente, inviti, accessi progetto, approvazioni e materiali. Nessuna email viene inviata automaticamente.">
        <Button asChild><Link href="/client-portal/accounts"><UserPlus className="mr-2 h-4 w-4" /> Nuovo account cliente</Link></Button>
        <Button asChild variant="outline"><Link href="/client-portal/approvals">Nuova approvazione</Link></Button>
        <Button asChild variant="outline"><Link href="/client-portal/material-requests">Nuova richiesta materiale</Link></Button>
        <Button asChild variant="outline"><Link href="/client-portal/projects">Gestisci accessi progetto</Link></Button>
      </Header>
      <ErrorBox error={error} />
      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Account clienti" value={summary.accounts_total || 0} icon={Users} />
          <SummaryCard label="Account attivi" value={summary.accounts_active || 0} icon={CheckCircle2} />
          <SummaryCard label="Inviti pending" value={summary.invites_pending || 0} icon={UserPlus} />
          <SummaryCard label="Approvazioni pendenti" value={summary.approvals_pending || 0} icon={ClipboardCheck} />
          <SummaryCard label="Richieste modifiche" value={summary.approvals_changes_requested || 0} icon={FileQuestion} />
          <SummaryCard label="Materiali richiesti" value={summary.materials_requested || 0} icon={FolderKanban} />
          <SummaryCard label="Materiali inviati" value={summary.materials_submitted || 0} icon={CheckCircle2} />
          <SummaryCard label="Commenti recenti" value={summary.comments_recent_count || 0} icon={MessageSquare} />
          <SummaryCard label="Progetti condivisi" value={summary.projects_shared_count || 0} icon={ShieldCheck} />
        </div>
      ) : (
        <EmptyState>Summary portale cliente non disponibile. Nessun dato viene simulato.</EmptyState>
      )}
    </div>
  );
}

function AccountsPage() {
  const { relations, reloadRelations } = useRelations();
  const [items, setItems] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({ status: "invited" });
  const [inviteLink, setInviteLink] = useState("");
  const [accessAccount, setAccessAccount] = useState<Row | null>(null);
  const [projectAccess, setProjectAccess] = useState<Row[]>([]);
  const [accessForm, setAccessForm] = useState<Row>({ access_level: "viewer", can_view_milestones: true, can_comment: true, can_approve: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "__all__") params.set("status", status);
      const data = await loadList("/tenant/client-portal/admin/accounts", params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento account cliente");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const open = (row?: Row) => {
    setEditing(row || {});
    setForm(row ? { ...row } : { status: "invited", magic_login_enabled: true });
  };

  const save = async () => {
    if (editing?.id) await apiFetch(`/tenant/client-portal/admin/accounts/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    else await apiFetch("/tenant/client-portal/admin/accounts", { method: "POST", body: JSON.stringify(toBody(form)) });
    setEditing(null);
    await Promise.all([load(), reloadRelations()]);
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questo account cliente?")) return;
    await apiFetch(`/tenant/client-portal/admin/accounts/${row.id}`, { method: "DELETE" });
    await load();
  };

  const generateInvite = async (row: Row) => {
    const result = await apiFetch<{ token: string }>(`/tenant/client-portal/admin/accounts/${row.id}/invites`, { method: "POST", body: JSON.stringify({}) });
    setInviteLink(buildClientInviteLink(result.token));
  };

  const openAccess = async (row: Row) => {
    setAccessAccount(row);
    setAccessForm({ access_level: "viewer", can_view_milestones: true, can_view_tasks: false, can_comment: true, can_upload_files: false, can_approve: true });
    const data = await loadList(`/tenant/client-portal/admin/accounts/${row.id}/projects`).catch(() => ({ items: [] }));
    setProjectAccess(data.items || []);
  };

  const saveAccess = async () => {
    if (!accessAccount) return;
    await apiFetch(`/tenant/client-portal/admin/accounts/${accessAccount.id}/projects`, { method: "POST", body: JSON.stringify(toBody(accessForm)) });
    toast({ title: "Accesso progetto salvato" });
    await openAccess(accessAccount);
  };

  const deleteAccess = async (row: Row) => {
    await apiFetch(`/tenant/client-portal/admin/project-access/${row.id}`, { method: "DELETE" });
    if (accessAccount) await openAccess(accessAccount);
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Account clienti" description="Account separati dagli utenti interni. Nessuna email viene inviata automaticamente.">
        <Button onClick={() => open()}><Plus className="mr-2 h-4 w-4" /> Nuovo account</Button>
      </Header>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca nome, email, telefono..." className="pl-9" /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{ACCOUNT_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <ErrorBox error={error} />
          {loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : items.length === 0 ? <EmptyState>Nessun account cliente reale.</EmptyState> : (
            <AdminTable
              rows={items}
              columns={[
                ["name", "Nome", (row) => row.name || "-"],
                ["email", "Email"],
                ["company_name", "Azienda", (row) => row.company_name || "-"],
                ["status", "Status", (row) => <StateBadge value={row.status} options={ACCOUNT_STATUSES} />],
                ["last_login_at", "Ultimo login", (row) => shortDate(row.last_login_at)],
                ["created_at", "Creato", (row) => shortDate(row.created_at)],
              ]}
              actions={(row) => (
                <>
                  <Button size="sm" variant="outline" onClick={() => generateInvite(row)}>Invito</Button>
                  <Button size="sm" variant="outline" onClick={() => openAccess(row)}><FolderKanban className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => open(row)}><Edit3 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </>
              )}
            />
          )}
        </CardContent>
      </Card>
      <Dialog open={editing !== null} onOpenChange={(openDialog) => { if (!openDialog) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Modifica account cliente" : "Nuovo account cliente"}</DialogTitle></DialogHeader>
          <AccountForm form={form} setForm={setForm} relations={relations} />
          <DialogFooter><Button onClick={save} disabled={!form.email}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!accessAccount} onOpenChange={(openDialog) => { if (!openDialog) setAccessAccount(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Accessi progetto</DialogTitle><DialogDescription>{accessAccount?.email}</DialogDescription></DialogHeader>
          <ProjectAccessForm form={accessForm} setForm={setAccessForm} projects={relations.projects} />
          <Button onClick={saveAccess} disabled={!accessForm.project_id}>Salva accesso</Button>
          {projectAccess.length === 0 ? <EmptyState>Nessun progetto condiviso con questo account.</EmptyState> : (
            <div className="space-y-2">
              {projectAccess.map((row) => (
                <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div><p className="font-semibold">{row.project_name || row.project_id}</p><p className="text-xs text-muted-foreground">{labelFor(row.access_level, ACCESS_LEVELS)}</p></div>
                  <Button size="sm" variant="outline" onClick={() => deleteAccess(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <InviteLinkDialog link={inviteLink} onClose={() => setInviteLink("")} />
    </div>
  );
}

function AccountForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2"><Label>Email *</Label><Input value={form.email || ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Telefono</Label><Input value={form.phone || ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={ACCOUNT_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Contatto</Label><RelationSelect value={form.contact_id} rows={relations.contacts} placeholder="Nessun contatto" onChange={(v) => setForm((p) => ({ ...p, contact_id: v }))} /></div>
    </div>
  );
}

function ProjectAccessForm({ form, setForm, projects }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; projects: Row[] }) {
  const flags = [
    ["can_view_milestones", "Milestone"],
    ["can_view_tasks", "Task condivisi"],
    ["can_comment", "Commenti"],
    ["can_upload_files", "File"],
    ["can_approve", "Approvazioni"],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2"><Label>Progetto *</Label><RelationSelect value={form.project_id} rows={projects} placeholder="Seleziona progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Livello</Label><SelectField value={form.access_level} options={ACCESS_LEVELS} placeholder="Accesso" onChange={(v) => setForm((p) => ({ ...p, access_level: v }))} /></div>
      <div className="grid gap-3 md:col-span-2">
        {flags.map(([key, label]) => (
          <label key={key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>{label}</span>
            <Switch checked={Boolean(form[key])} onCheckedChange={(checked) => setForm((p) => ({ ...p, [key]: checked }))} />
          </label>
        ))}
      </div>
    </div>
  );
}

function InvitesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [status, setStatus] = useState("__all__");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (status !== "__all__") params.set("status", status);
      const data = await loadList("/tenant/client-portal/admin/invites", params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento inviti");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const revoke = async (row: Row) => {
    await apiFetch(`/tenant/client-portal/admin/invites/${row.id}/revoke`, { method: "PATCH" });
    await load();
  };

  return (
    <ListShell title="Inviti cliente" description="Token hashati backend. Il token raw non viene mai mostrato qui dopo la creazione." action={null}>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="accepted">Accettati</SelectItem><SelectItem value="revoked">Revocati</SelectItem><SelectItem value="expired">Scaduti</SelectItem></SelectContent></Select>
      <ErrorBox error={error} />
      {loading ? <Loading /> : items.length === 0 ? <EmptyState>Nessun invito reale.</EmptyState> : (
        <AdminTable
          rows={items}
          columns={[
            ["account_email", "Account", (row) => row.account_email || row.account_id],
            ["status", "Status", (row) => <Badge variant="outline">{row.status}</Badge>],
            ["expires_at", "Scade", (row) => shortDate(row.expires_at)],
            ["accepted_at", "Accettato", (row) => shortDate(row.accepted_at)],
            ["created_at", "Creato", (row) => shortDate(row.created_at)],
          ]}
          actions={(row) => row.status === "pending" ? <Button size="sm" variant="outline" onClick={() => revoke(row)}>Revoca</Button> : null}
        />
      )}
    </ListShell>
  );
}

function ProjectAccessPage() {
  const { relations } = useRelations();
  const [accountId, setAccountId] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({ access_level: "viewer", can_view_milestones: true, can_view_tasks: false, can_comment: true, can_upload_files: false, can_approve: true });
  const { toast } = useToast();

  const load = async (id = accountId) => {
    if (!id) return;
    const data = await loadList(`/tenant/client-portal/admin/accounts/${id}/projects`).catch(() => ({ items: [] }));
    setItems(data.items || []);
  };

  useEffect(() => { void load(accountId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accountId]);

  const save = async () => {
    await apiFetch(`/tenant/client-portal/admin/accounts/${accountId}/projects`, { method: "POST", body: JSON.stringify(toBody(form)) });
    toast({ title: "Accesso progetto salvato" });
    await load();
  };
  const remove = async (row: Row) => {
    await apiFetch(`/tenant/client-portal/admin/project-access/${row.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <ListShell title="Accessi progetto cliente" description="Condividi progetti reali con account cliente e abilita solo le capability necessarie." action={null}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card><CardContent className="space-y-4 pt-6"><Label>Account cliente</Label><RelationSelect value={accountId} rows={relations.accounts} placeholder="Seleziona account" onChange={setAccountId} />{accountId ? <><ProjectAccessForm form={form} setForm={setForm} projects={relations.projects} /><Button onClick={save} disabled={!form.project_id}>Salva accesso</Button></> : null}</CardContent></Card>
        <Card><CardContent className="pt-6">{!accountId ? <EmptyState>Seleziona un account cliente.</EmptyState> : items.length === 0 ? <EmptyState>Nessun progetto condiviso.</EmptyState> : <AdminTable rows={items} columns={[["project_name", "Progetto", (r) => r.project_name || r.project_id], ["access_level", "Livello", (r) => labelFor(r.access_level, ACCESS_LEVELS)], ["can_approve", "Approva", (r) => r.can_approve ? "Si" : "No"], ["can_comment", "Commenta", (r) => r.can_comment ? "Si" : "No"]]} actions={(row) => <Button size="sm" variant="outline" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>} />}</CardContent></Card>
      </div>
    </ListShell>
  );
}

function ApprovalsPage() {
  const { relations } = useRelations();
  return (
    <CrudPage
      title="Approvazioni cliente"
      description="Richieste di approvazione collegate a progetto, preventivo o briefing."
      path="/tenant/client-portal/admin/approvals"
      statuses={APPROVAL_STATUSES}
      initialForm={{ title: "", type: "general", status: "pending" }}
      columns={[
        ["title", "Titolo"],
        ["type", "Tipo", (r) => labelFor(r.type, APPROVAL_TYPES)],
        ["status", "Status", (r) => <StateBadge value={r.status} options={APPROVAL_STATUSES} />],
        ["project_name", "Progetto", (r) => r.project_name || r.project_id || "-"],
        ["account_email", "Cliente", (r) => r.account_email || r.account_id || "-"],
        ["due_date", "Scadenza", (r) => shortDate(r.due_date)],
        ["decision_note", "Decisione", (r) => r.decision_note || "-"],
      ]}
      renderForm={(form, setForm) => <ApprovalForm form={form} setForm={setForm} relations={relations} />}
      canSave={(form) => Boolean(form.title)}
      emptyText="Nessuna approvazione richiesta."
    />
  );
}

function ApprovalForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Descrizione cliente</Label><Textarea value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.type} options={APPROVAL_TYPES} placeholder="Tipo" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={APPROVAL_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Account cliente</Label><RelationSelect value={form.account_id} rows={relations.accounts} placeholder="Visibile per progetto/account" onChange={(v) => setForm((p) => ({ ...p, account_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Preventivo</Label><RelationSelect value={form.quote_id} rows={relations.quotes} placeholder="Nessun preventivo" onChange={(v) => setForm((p) => ({ ...p, quote_id: v }))} /></div>
      <div className="grid gap-2"><Label>Briefing</Label><RelationSelect value={form.briefing_id} rows={relations.briefings} placeholder="Nessun briefing" onChange={(v) => setForm((p) => ({ ...p, briefing_id: v }))} /></div>
      <div className="grid gap-2"><Label>Scadenza</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
    </div>
  );
}

function MaterialsPage() {
  const { relations } = useRelations();
  return (
    <CrudPage
      title="Materiali richiesti"
      description="Richieste materiali visibili nel portale cliente. Upload reale non viene simulato."
      path="/tenant/client-portal/admin/material-requests"
      statuses={MATERIAL_STATUSES}
      initialForm={{ title: "", type: "generic", status: "requested" }}
      columns={[
        ["title", "Titolo"],
        ["type", "Tipo", (r) => labelFor(r.type, MATERIAL_TYPES)],
        ["status", "Status", (r) => <StateBadge value={r.status} options={MATERIAL_STATUSES} />],
        ["project_name", "Progetto", (r) => r.project_name || r.project_id || "-"],
        ["account_email", "Cliente", (r) => r.account_email || r.account_id || "-"],
        ["due_date", "Scadenza", (r) => shortDate(r.due_date)],
        ["submitted_at", "Inviato", (r) => shortDate(r.submitted_at)],
      ]}
      renderForm={(form, setForm) => <MaterialForm form={form} setForm={setForm} relations={relations} />}
      canSave={(form) => Boolean(form.title)}
      emptyText="Nessun materiale richiesto."
    />
  );
}

function MaterialForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Descrizione cliente</Label><Textarea value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.type} options={MATERIAL_TYPES} placeholder="Tipo" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={MATERIAL_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Account cliente</Label><RelationSelect value={form.account_id} rows={relations.accounts} placeholder="Nessun account" onChange={(v) => setForm((p) => ({ ...p, account_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Briefing</Label><RelationSelect value={form.briefing_id} rows={relations.briefings} placeholder="Nessun briefing" onChange={(v) => setForm((p) => ({ ...p, briefing_id: v }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Contatto</Label><RelationSelect value={form.contact_id} rows={relations.contacts} placeholder="Nessun contatto" onChange={(v) => setForm((p) => ({ ...p, contact_id: v }))} /></div>
      <div className="grid gap-2"><Label>Scadenza</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
    </div>
  );
}

function CommentsPage() {
  const { relations } = useRelations();
  return (
    <CrudPage
      title="Commenti cliente"
      description="Commenti del portale cliente e risposte admin. Non include commenti project internal/private."
      path="/tenant/client-portal/admin/comments"
      initialForm={{ body: "", visibility: "client" }}
      columns={[
        ["body", "Commento", (r) => <span className="line-clamp-2">{r.body}</span>],
        ["account_email", "Cliente", (r) => r.account_email || r.account_id || "-"],
        ["project_id", "Progetto", (r) => r.project_id || "-"],
        ["visibility", "Visibilita", (r) => labelFor(r.visibility, COMMENT_VISIBILITIES)],
        ["created_at", "Creato", (r) => shortDate(r.created_at)],
      ]}
      renderForm={(form, setForm) => <CommentForm form={form} setForm={setForm} relations={relations} />}
      canSave={(form) => Boolean(form.body)}
      emptyText="Nessun commento cliente."
      noPatch
    />
  );
}

function CommentForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Commento *</Label><Textarea value={form.body || ""} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Visibilita</Label><SelectField value={form.visibility} options={COMMENT_VISIBILITIES} placeholder="Visibilita" onChange={(v) => setForm((p) => ({ ...p, visibility: v }))} /></div>
      <div className="grid gap-2"><Label>Account cliente</Label><RelationSelect value={form.account_id} rows={relations.accounts} placeholder="Nessun account" onChange={(v) => setForm((p) => ({ ...p, account_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <p className="text-xs text-muted-foreground">Per risposte puntuali puoi collegare anche approval_request_id o material_request_id incollandone l'UUID.</p>
      <div className="grid gap-2"><Label>Approval request ID</Label><Input value={form.approval_request_id || ""} onChange={(e) => setForm((p) => ({ ...p, approval_request_id: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Material request ID</Label><Input value={form.material_request_id || ""} onChange={(e) => setForm((p) => ({ ...p, material_request_id: e.target.value }))} /></div>
    </div>
  );
}

function CrudPage({
  title,
  description,
  path,
  statuses,
  initialForm,
  columns,
  renderForm,
  canSave,
  emptyText,
  noPatch,
}: {
  title: string;
  description: string;
  path: string;
  statuses?: Option[];
  initialForm: Row;
  columns: Array<[string, string, ((row: Row) => ReactNode)?]>;
  renderForm: (form: Row, setForm: (updater: (prev: Row) => Row) => void) => ReactNode;
  canSave: (form: Row) => boolean;
  emptyText: string;
  noPatch?: boolean;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>(initialForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (statuses && status !== "__all__") params.set("status", status);
      const data = await loadList(path, params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Errore caricamento ${title.toLowerCase()}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const open = (row?: Row) => {
    setEditing(row || {});
    setForm(row ? { ...initialForm, ...row } : initialForm);
  };
  const save = async () => {
    if (editing?.id && !noPatch) await apiFetch(`${path}/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    else await apiFetch(path, { method: "POST", body: JSON.stringify(toBody(form)) });
    setEditing(null);
    await load();
  };
  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questo record?")) return;
    await apiFetch(`${path}/${row.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <ListShell title={title} description={description} action={<Button onClick={() => open()}><Plus className="mr-2 h-4 w-4" /> Nuovo</Button>}>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..." className="pl-9" /></div>
        {statuses ? <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{statuses.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select> : null}
      </div>
      <ErrorBox error={error} />
      {loading ? <Loading /> : items.length === 0 ? <EmptyState>{emptyText}</EmptyState> : (
        <AdminTable
          rows={items}
          columns={columns}
          actions={(row) => (
            <>
              {!noPatch ? <Button size="sm" variant="outline" onClick={() => open(row)}><Edit3 className="h-4 w-4" /></Button> : null}
              <Button size="sm" variant="outline" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </>
          )}
        />
      )}
      <Dialog open={editing !== null} onOpenChange={(openDialog) => { if (!openDialog) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? `Modifica ${title}` : `Nuovo ${title}`}</DialogTitle></DialogHeader>
          {renderForm(form, setForm)}
          <DialogFooter><Button onClick={save} disabled={!canSave(form)}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </ListShell>
  );
}

function ListShell({ title, description, action, children }: { title: string; description: string; action: ReactNode; children: ReactNode }) {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title={title} description={description}>{action}</Header>
      <Card><CardContent className="space-y-4 pt-6">{children}</CardContent></Card>
    </div>
  );
}

function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

function AdminTable({ rows, columns, actions }: { rows: Row[]; columns: Array<[string, string, ((row: Row) => ReactNode)?]>; actions: (row: Row) => ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">Azioni</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              {columns.map(([key, , format]) => <td key={key} className="px-4 py-3 align-top">{format ? format(row) : String(row[key] ?? "-")}</td>)}
              <td className="px-4 py-3"><div className="flex justify-end gap-2">{actions(row)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsPage() {
  const links = useMemo(() => [
    { href: "/client/login", label: "Login cliente", icon: Eye },
    { href: "/client/accept-invite", label: "Accetta invito", icon: UserPlus },
    { href: "/client/dashboard", label: "Dashboard cliente", icon: Settings },
  ], []);
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Impostazioni portale cliente" description="Area di appoggio per verificare le route pubbliche. Email, branding avanzato e upload reale restano in arrivo." />
      <div className="grid gap-4 md:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;
          return <Card key={link.href}><CardContent className="p-4"><Button asChild variant="outline" className="w-full justify-start"><Link href={link.href}><Icon className="mr-2 h-4 w-4" /> {link.label}</Link></Button></CardContent></Card>;
        })}
      </div>
    </div>
  );
}
