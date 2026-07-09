"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2, ClipboardCheck, FileQuestion, FolderKanban, Loader2, LogOut,
  MessageSquare, Send, Upload, User,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  clearClientPortalToken,
  clientPortalFetch,
  extractClientPortalAccessToken,
  getClientPortalSessionExpiredMessage,
  getClientPortalToken,
  setClientPortalToken,
} from "@/lib/client-portal-api";
import { shortDate } from "@/components/tenant-crm/crm-core";
import { useToast } from "@/hooks/use-toast";

type Row = Record<string, any>;
type ListResponse<T = Row> = { items: T[]; total?: number };

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">{children}</div>;
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

function StateBadge({ value }: { value?: string }) {
  const label: Record<string, string> = {
    pending: "In attesa",
    approved: "Approvata",
    rejected: "Rifiutata",
    changes_requested: "Modifiche richieste",
    requested: "Richiesto",
    submitted: "Inviato",
    active: "Attivo",
  };
  const tone = value === "approved" || value === "submitted"
    ? "border-emerald-500/30 text-emerald-600"
    : value === "rejected"
      ? "border-destructive/30 text-destructive"
      : "border-chart-5/30 text-chart-5";
  return <Badge variant="outline" className={tone}>{label[value || ""] || value || "-"}</Badge>;
}

function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Row | null>(null);

  useEffect(() => {
    if (!getClientPortalToken()) return;
    clientPortalFetch<{ account: Row }>("/tenant/client-portal/me")
      .then((data) => setMe(data.account))
      .catch(() => setMe(null));
  }, []);

  const logout = () => {
    clearClientPortalToken();
    router.push("/client/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <Link href="/client/dashboard" className="text-xl font-black tracking-tight">doflow</Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Button asChild variant="ghost" size="sm"><Link href="/client/dashboard">Dashboard</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/client/projects">Progetti</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/client/approvals">Approvazioni</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/client/materials">Materiali</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/client/comments">Commenti</Link></Button>
          </nav>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="max-w-[220px] truncate">{me?.name || me?.email || "Cliente"}</span>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="mr-2 h-4 w-4" /> Esci</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function AuthShell({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <p className="text-2xl font-black">doflow</p>
          <p className="mt-1 text-sm text-muted-foreground">Portale cliente</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ClientLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const message = getClientPortalSessionExpiredMessage();
    if (message) setError(message);
  }, []);

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientPortalFetch<{ accessToken?: string }>("/tenant/client-portal/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ ...form, tenant: "doflow" }),
      });
      setClientPortalToken(extractClientPortalAccessToken(data));
      router.push("/client/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenziali non valide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Accesso cliente" description="Inserisci email e password impostate dall'invito. Hai ricevuto un invito? Usa il link inviato dal team.">
      <div className="space-y-4">
        <ErrorBox error={error} />
        <div className="grid gap-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} /></div>
        <Button className="w-full" onClick={login} disabled={loading || !form.email || !form.password}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Entra</Button>
      </div>
    </AuthShell>
  );
}

export function ClientAcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || params.get("invite") || "";
  const [form, setForm] = useState({ name: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (form.password && form.password !== form.confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await clientPortalFetch<{ accessToken?: string }>("/tenant/client-portal/auth/accept-invite", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ token, name: form.name || undefined, password: form.password || undefined, tenant: "doflow" }),
      });
      setClientPortalToken(extractClientPortalAccessToken(data));
      router.push("/client/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invito non valido";
      setError(message.includes("scaduto") ? "Invito scaduto." : message.includes("revoc") ? "Invito revocato." : message.includes("utilizzabile") ? "Invito gia accettato o non utilizzabile." : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Accetta invito" description="Completa il tuo accesso al portale cliente doflow. La password e' opzionale, ma serve per il login successivo.">
      <div className="space-y-4">
        <ErrorBox error={error || (!token ? "Token invito mancante." : null)} />
        <div className="grid gap-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Conferma password</Label><Input type="password" value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} /></div>
        <Button className="w-full" onClick={accept} disabled={loading || !token}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Accetta invito</Button>
      </div>
    </AuthShell>
  );
}

export function ClientDashboardPage() {
  const [summary, setSummary] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientPortalFetch<Row>("/tenant/client-portal/summary")
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Dashboard non disponibile"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ClientShell>
      <div className="space-y-5">
        <div><h1 className="text-2xl font-bold tracking-tight">Dashboard cliente</h1><p className="mt-1 text-sm text-muted-foreground">Panoramica dei progetti e delle richieste condivise da doflow.</p></div>
        <ErrorBox error={error} />
        {loading ? <Loading /> : summary ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryTile label="Progetti condivisi" value={summary.projects_count || 0} icon={FolderKanban} href="/client/projects" />
            <SummaryTile label="Approvazioni pendenti" value={summary.approvals_pending || 0} icon={ClipboardCheck} href="/client/approvals" />
            <SummaryTile label="Richieste modifiche" value={summary.approvals_changes_requested || 0} icon={FileQuestion} href="/client/approvals" />
            <SummaryTile label="Materiali richiesti" value={summary.materials_requested || 0} icon={Upload} href="/client/materials" />
            <SummaryTile label="Materiali inviati" value={summary.materials_submitted || 0} icon={CheckCircle2} href="/client/materials" />
            <SummaryTile label="Commenti recenti" value={summary.recent_comments_count || 0} icon={MessageSquare} href="/client/comments" />
          </div>
        ) : <EmptyState>Nessun dato disponibile.</EmptyState>}
      </div>
    </ClientShell>
  );
}

function SummaryTile({ label, value, icon: Icon, href }: { label: string; value: number; icon: any; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/30">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
          <div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ClientProjectsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    clientPortalFetch<ListResponse>("/tenant/client-portal/projects")
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Errore caricamento progetti"))
      .finally(() => setLoading(false));
  }, []);
  return (
    <ClientShell>
      <div className="space-y-5">
        <div><h1 className="text-2xl font-bold tracking-tight">Progetti</h1><p className="mt-1 text-sm text-muted-foreground">Solo progetti condivisi esplicitamente dal team doflow. Nessun dato economico o nota interna.</p></div>
        <ErrorBox error={error} />
        {loading ? <Loading /> : items.length === 0 ? <EmptyState>Nessun progetto condiviso.</EmptyState> : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((project) => (
              <Link key={project.id} href={`/client/projects/${project.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3"><CardTitle>{project.name}</CardTitle><Badge variant="outline">{project.status || "-"}</Badge></div>
                    <CardDescription>{project.company_name || "Progetto doflow"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-3 text-sm text-muted-foreground">{project.description || project.client_notes || "Nessuna descrizione condivisa."}</p>
                    <Progress value={Number(project.progress || 0)} />
                    <p className="text-xs text-muted-foreground">Fase: {project.current_phase || "-"} · Scadenza: {shortDate(project.due_date) || "-"}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ClientShell>
  );
}

export function ClientProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Row | null>(null);
  const [milestones, setMilestones] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [files, setFiles] = useState<Row[]>([]);
  const [comments, setComments] = useState<Row[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m, t, f, c] = await Promise.all([
        clientPortalFetch<Row>(`/tenant/client-portal/projects/${projectId}`),
        clientPortalFetch<ListResponse>(`/tenant/client-portal/projects/${projectId}/milestones`).catch(() => ({ items: [] })),
        clientPortalFetch<ListResponse>(`/tenant/client-portal/projects/${projectId}/tasks`).catch(() => ({ items: [] })),
        clientPortalFetch<ListResponse>(`/tenant/client-portal/projects/${projectId}/files`).catch(() => ({ items: [] })),
        clientPortalFetch<ListResponse>(`/tenant/client-portal/comments?project_id=${projectId}`).catch(() => ({ items: [] })),
      ]);
      setProject(p);
      setMilestones(m.items || []);
      setTasks(t.items || []);
      setFiles(f.items || []);
      setComments(c.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Progetto non disponibile");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const sendComment = async () => {
    await clientPortalFetch("/tenant/client-portal/comments", { method: "POST", body: JSON.stringify({ project_id: projectId, body: comment }) });
    setComment("");
    await load();
  };

  return (
    <ClientShell>
      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : project ? (
        <div className="space-y-5">
          <div><h1 className="text-2xl font-bold tracking-tight">{project.name}</h1><p className="mt-1 text-sm text-muted-foreground">{project.description || project.client_notes || "Panoramica progetto condivisa da doflow."}</p></div>
          <Card><CardContent className="space-y-3 p-4"><div className="flex flex-wrap gap-2"><Badge variant="outline">{project.status || "-"}</Badge><Badge variant="outline">{project.current_phase || "Fase non indicata"}</Badge><Badge variant="outline">Scadenza {shortDate(project.due_date) || "-"}</Badge></div><Progress value={Number(project.progress || 0)} /></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard title="Milestone" empty="Nessuna milestone condivisa.">{milestones.map((m) => <RowLine key={m.id} title={m.title} meta={`${m.status || "-"} · ${shortDate(m.due_date) || "-"}`} />)}</ListCard>
            <ListCard title="Task condivisi" empty="Le attivita interne non sono condivise in questa fase.">{tasks.map((t) => <RowLine key={t.id} title={t.title} meta={`${t.status || "-"} · ${shortDate(t.due_at) || "-"}`} />)}</ListCard>
            <ListCard title="File visibili" empty="Nessun file condiviso.">{files.map((f) => <RowLine key={f.id} title={f.original_filename || f.file_id || "File"} meta={f.type || "file"} />)}</ListCard>
            <Card><CardHeader><CardTitle>Commenti</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Scrivi al team doflow..." /><Button onClick={sendComment} disabled={!comment.trim()}><Send className="mr-2 h-4 w-4" /> Invia commento</Button>{comments.length === 0 ? <EmptyState>Nessun commento.</EmptyState> : comments.map((c) => <RowLine key={c.id} title={c.body} meta={shortDate(c.created_at)} />)}</CardContent></Card>
          </div>
        </div>
      ) : null}
    </ClientShell>
  );
}

function ListCard({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-2">{hasChildren ? children : <EmptyState>{empty}</EmptyState>}</CardContent></Card>;
}

function RowLine({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return <div className="rounded-lg border p-3"><p className="font-semibold">{title}</p>{meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}</div>;
}

export function ClientApprovalsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [decision, setDecision] = useState<{ row: Row; type: "approve" | "reject" | "request-changes" } | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const load = async () => {
    setLoading(true);
    const data = await clientPortalFetch<ListResponse>("/tenant/client-portal/approvals").catch(() => ({ items: [] }));
    setItems(data.items || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const decide = async () => {
    if (!decision) return;
    await clientPortalFetch(`/tenant/client-portal/approvals/${decision.row.id}/${decision.type}`, { method: "PATCH", body: JSON.stringify({ decision_note: note }) });
    toast({ title: "Decisione registrata" });
    setDecision(null);
    setNote("");
    await load();
  };
  return (
    <ClientShell>
      <div className="space-y-5"><div><h1 className="text-2xl font-bold tracking-tight">Approvazioni</h1><p className="mt-1 text-sm text-muted-foreground">Approva, rifiuta o richiedi modifiche sulle richieste condivise.</p></div>{loading ? <Loading /> : items.length === 0 ? <EmptyState>Nessuna approvazione richiesta.</EmptyState> : <div className="space-y-3">{items.map((row) => <Card key={row.id}><CardContent className="space-y-3 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><p className="font-semibold">{row.title}</p><p className="text-sm text-muted-foreground">{row.description || "Nessuna descrizione."}</p><p className="mt-1 text-xs text-muted-foreground">Scadenza {shortDate(row.due_date) || "-"}</p></div><StateBadge value={row.status} /></div>{row.status === "pending" || row.status === "changes_requested" ? <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setDecision({ row, type: "approve" })}><CheckCircle2 className="mr-2 h-4 w-4" /> Approva</Button><Button size="sm" variant="outline" onClick={() => setDecision({ row, type: "request-changes" })}><FileQuestion className="mr-2 h-4 w-4" /> Richiedi modifiche</Button><Button size="sm" variant="outline" onClick={() => setDecision({ row, type: "reject" })}><XCircle className="mr-2 h-4 w-4" /> Rifiuta</Button></div> : null}{row.decision_note ? <p className="text-sm text-muted-foreground">Nota decisione: {row.decision_note}</p> : null}</CardContent></Card>)}</div>}</div>
      <Dialog open={!!decision} onOpenChange={(open) => { if (!open) setDecision(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Conferma decisione</DialogTitle></DialogHeader><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opzionale per il team doflow" /><DialogFooter><Button onClick={decide}>Invia</Button></DialogFooter></DialogContent>
      </Dialog>
    </ClientShell>
  );
}

export function ClientMaterialsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const load = async () => {
    setLoading(true);
    const data = await clientPortalFetch<ListResponse>("/tenant/client-portal/material-requests").catch(() => ({ items: [] }));
    setItems(data.items || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const submit = async () => {
    if (!selected) return;
    await clientPortalFetch(`/tenant/client-portal/material-requests/${selected.id}/submit`, { method: "PATCH", body: JSON.stringify({ notes: note }) });
    if (filename.trim()) {
      await clientPortalFetch(`/tenant/client-portal/material-requests/${selected.id}/files`, { method: "POST", body: JSON.stringify({ original_filename: filename.trim(), notes: note }) });
    }
    toast({ title: "Materiale segnato come inviato" });
    setSelected(null);
    setNote("");
    setFilename("");
    await load();
  };
  return (
    <ClientShell>
      <div className="space-y-5"><div><h1 className="text-2xl font-bold tracking-tight">Materiali</h1><p className="mt-1 text-sm text-muted-foreground">Invia note o metadata. L'upload file reale non viene simulato.</p></div>{loading ? <Loading /> : items.length === 0 ? <EmptyState>Nessun materiale richiesto.</EmptyState> : <div className="space-y-3">{items.map((row) => <Card key={row.id}><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between"><div><p className="font-semibold">{row.title}</p><p className="text-sm text-muted-foreground">{row.description || "Nessuna descrizione."}</p><p className="mt-1 text-xs text-muted-foreground">{row.type || "materiale"} · scadenza {shortDate(row.due_date) || "-"}</p></div><div className="flex gap-2"><StateBadge value={row.status} />{row.status !== "submitted" && row.status !== "approved" ? <Button size="sm" onClick={() => setSelected(row)}>Invia</Button> : null}</div></CardContent></Card>)}</div>}</div>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Invia materiale</DialogTitle></DialogHeader><div className="space-y-3"><Input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="Nome file o riferimento, opzionale" /><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota per il team doflow" /><p className="text-xs text-muted-foreground">Non viene caricato nessun file binario: salviamo solo metadata se indicati.</p></div><DialogFooter><Button onClick={submit}>Segna come inviato</Button></DialogFooter></DialogContent>
      </Dialog>
    </ClientShell>
  );
}

export function ClientCommentsPage() {
  const [comments, setComments] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [materials, setMaterials] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({ body: "", targetType: "project" });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const load = async () => {
    setLoading(true);
    const [c, p, a, m] = await Promise.all([
      clientPortalFetch<ListResponse>("/tenant/client-portal/comments").catch(() => ({ items: [] })),
      clientPortalFetch<ListResponse>("/tenant/client-portal/projects").catch(() => ({ items: [] })),
      clientPortalFetch<ListResponse>("/tenant/client-portal/approvals").catch(() => ({ items: [] })),
      clientPortalFetch<ListResponse>("/tenant/client-portal/material-requests").catch(() => ({ items: [] })),
    ]);
    setComments(c.items || []);
    setProjects(p.items || []);
    setApprovals(a.items || []);
    setMaterials(m.items || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const submit = async () => {
    const body: Row = { body: form.body };
    if (form.targetType === "project") body.project_id = form.project_id;
    if (form.targetType === "approval") body.approval_request_id = form.approval_request_id;
    if (form.targetType === "material") body.material_request_id = form.material_request_id;
    await clientPortalFetch("/tenant/client-portal/comments", { method: "POST", body: JSON.stringify(body) });
    toast({ title: "Commento inviato" });
    setForm({ body: "", targetType: "project" });
    await load();
  };
  const targetRows = form.targetType === "project" ? projects : form.targetType === "approval" ? approvals : materials;
  const targetKey = form.targetType === "project" ? "project_id" : form.targetType === "approval" ? "approval_request_id" : "material_request_id";
  return (
    <ClientShell>
      <div className="space-y-5"><div><h1 className="text-2xl font-bold tracking-tight">Commenti</h1><p className="mt-1 text-sm text-muted-foreground">Scrivi al team doflow su progetto, approvazione o richiesta materiale.</p></div><Card><CardContent className="grid gap-3 pt-6 md:grid-cols-[180px_1fr]"><Select value={form.targetType} onValueChange={(v) => setForm({ body: form.body, targetType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project">Progetto</SelectItem><SelectItem value="approval">Approvazione</SelectItem><SelectItem value="material">Materiale</SelectItem></SelectContent></Select><Select value={form[targetKey] || "__none__"} onValueChange={(v) => setForm((p) => ({ ...p, [targetKey]: v === "__none__" ? "" : v }))}><SelectTrigger><SelectValue placeholder="Seleziona destinazione" /></SelectTrigger><SelectContent><SelectItem value="__none__">Seleziona destinazione</SelectItem>{targetRows.map((row) => <SelectItem key={row.id} value={row.id}>{row.name || row.title || row.id}</SelectItem>)}</SelectContent></Select><Textarea className="md:col-span-2" value={form.body || ""} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} placeholder="Scrivi un commento..." /><Button className="md:col-span-2" onClick={submit} disabled={!form.body || !form[targetKey]}>Invia commento</Button></CardContent></Card>{loading ? <Loading /> : comments.length === 0 ? <EmptyState>Nessun commento.</EmptyState> : <div className="space-y-2">{comments.map((row) => <RowLine key={row.id} title={row.body} meta={`${row.visibility || "client"} · ${shortDate(row.created_at)}`} />)}</div>}</div>
    </ClientShell>
  );
}
