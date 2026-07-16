"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { listDocumentsForEntity, type TenantDocument } from "@/lib/tenant-documents-api";
import { teamApi, type TeamActivity, type TeamInviteResult, type TeamMember, type TeamModulePermission, type TeamOptions, type TeamSkill, type TeamWorkloadItem } from "@/lib/tenant-team-api";
import { DocumentUploadLink, DocumentsMiniList } from "./team-member-documents";
import { TeamAvailabilityPage } from "./team-availability";
import { TeamMemberForm } from "./team-member-form";
import { TeamTimeEntriesPage } from "./team-time-entries";
import {
  AVAILABILITY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  OPERATIONAL_ROLE_LABELS,
  TENANT_ROLE_LABELS,
  availabilityBadgeClass,
  canManageTeam,
  canViewTeamCosts,
  formatCurrencyCents,
  formatDate,
  formatDateTime,
  formatMinutes,
  label,
  roleBadgeClass,
} from "./team-utils";
import { Empty, ErrorBox, Loading } from "./team-workload";

export function TeamMemberDetailPage({ memberId }: { memberId: string }) {
  const { toast } = useToast();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [workload, setWorkload] = useState<TeamWorkloadItem | null>(null);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [skills, setSkills] = useState<TeamSkill[]>([]);
  const [permissions, setPermissions] = useState<TeamModulePermission[]>([]);
  const [options, setOptions] = useState<TeamOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [inviteResult, setInviteResult] = useState<TeamInviteResult | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [memberData, workloadData, activityData, documentData, skillData, optionData, permissionData] = await Promise.all([
        teamApi.member(memberId),
        teamApi.memberWorkload(memberId).catch(() => null),
        teamApi.memberActivity(memberId).catch(() => ({ items: [] })),
        listDocumentsForEntity("team_member", memberId, { limit: 5 }).catch(() => ({ items: [] })),
        teamApi.skills().catch(() => ({ items: [] })),
        teamApi.options().catch(() => null),
        canManageTeam() ? teamApi.permissions(memberId).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      ]);
      setMember(memberData);
      setWorkload(workloadData);
      setActivity(activityData.items || []);
      setDocuments(documentData.items || []);
      setSkills(skillData.items || []);
      setOptions(optionData);
      setPermissions(permissionData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Membro non trovato");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [memberId]);

  const saveMember = async (body: Partial<TeamMember>) => {
    await teamApi.updateMember(memberId, body);
    setEditOpen(false);
    await load();
  };
  const addSkill = async () => {
    if (!skillId) return;
    await teamApi.addMemberSkill(memberId, { skill_id: skillId });
    setSkillId("");
    await load();
  };
  const removeSkill = async (id: string) => {
    await teamApi.removeMemberSkill(memberId, id);
    await load();
  };
  const savePermissions = async () => {
    try {
      await teamApi.updatePermissions(memberId, permissions);
      toast({ title: "Permessi salvati" });
      await load();
    } catch (err) {
      toast({ title: "Permessi non salvati", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const sendInvite = async () => {
    try {
      const result = await teamApi.inviteMember(memberId);
      setInviteResult(result);
      toast({ title: result.email_sent ? "Invito inviato" : "Invito creato", description: result.email_sent ? "Email inviata correttamente." : "Email non inviata: copia il link manualmente." });
      await load();
    } catch (err) {
      toast({ title: "Invito non creato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex flex-1 justify-center py-24 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento membro...</div>;
  if (error || !member) return <div className="flex-1 p-4 md:p-6"><ErrorBox error={error || "Membro non trovato"} /></div>;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-3"><Link href="/team/members">Torna ai membri</Link></Button>
          <h1 className="text-2xl font-bold tracking-tight">{member.display_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className={roleBadgeClass(member.tenant_role)}>{label(TENANT_ROLE_LABELS, member.tenant_role)}</Badge>
            <Badge variant="outline">{label(OPERATIONAL_ROLE_LABELS, member.operational_role)}</Badge>
            <Badge variant="outline" className={availabilityBadgeClass(member.availability_status)}>{label(AVAILABILITY_LABELS, member.availability_status)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DocumentUploadLink memberId={memberId} />
          {canManageTeam() && !member.user_id ? (
            <Button variant="outline" onClick={sendInvite}>
              <Send className="mr-2 h-4 w-4" /> {member.status === "invited" ? "Reinvia invito" : "Invita alla webapp"}
            </Button>
          ) : null}
          <Button onClick={() => setEditOpen(true)}>Modifica profilo</Button>
        </div>
      </div>

      {inviteResult ? <InviteResultCard invite={inviteResult} onClear={() => setInviteResult(null)} /> : null}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="profile">Profilo</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="time">Ore</TabsTrigger>
          <TabsTrigger value="availability">Disponibilità</TabsTrigger>
          <TabsTrigger value="skills">Competenze</TabsTrigger>
          <TabsTrigger value="documents">Documenti</TabsTrigger>
          <TabsTrigger value="activity">Attività</TabsTrigger>
          {canManageTeam() ? <TabsTrigger value="permissions">Permessi</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-3">
            <Info label="Ruolo tenant" value={label(TENANT_ROLE_LABELS, member.tenant_role)} />
            <Info label="Ruolo operativo" value={label(OPERATIONAL_ROLE_LABELS, member.operational_role)} />
            <Info label="Rapporto" value={label(EMPLOYMENT_TYPE_LABELS, member.employment_type)} />
            <Info label="Accesso webapp" value={member.user_id ? "Account attivo" : member.status === "invited" ? "Invito in attesa" : "Solo profilo"} />
            <Info label="Capacity" value={member.capacity_hours_per_week ? `${member.capacity_hours_per_week}h/settimana` : "-"} />
            <Info label="Inizio" value={formatDate(member.start_date)} />
            <Info label="Telefono" value={member.phone || "-"} />
          </div>
          <Card className="mt-4"><CardHeader><CardTitle>Note</CardTitle></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{member.notes || "Nessuna nota."}</p>{canViewTeamCosts() ? <><div className="grid gap-3 md:grid-cols-2"><Info label="Tariffa oraria" value={formatCurrencyCents(member.hourly_rate_cents, member.currency || "EUR")} /><Info label="Tariffa giornaliera" value={formatCurrencyCents(member.daily_rate_cents, member.currency || "EUR")} /></div><p className="whitespace-pre-wrap rounded-nav bg-muted/40 p-3 text-sm">{member.private_notes || "Nessuna nota privata."}</p></> : null}</CardContent></Card>
        </TabsContent>

        <TabsContent value="workload">
          {workload ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Task aperti" value={String(workload.openTasks || 0)} />
              <Info label="Task scaduti" value={String(workload.overdueTasks || 0)} />
              <Info label="Progetti attivi" value={String(workload.activeProjects || 0)} />
              <Info label="Utilizzo" value={`${workload.utilizationPercent || 0}%`} />
              <Info label="Ore settimana" value={formatMinutes(workload.loggedMinutesThisWeek)} />
              <Info label="Ore mese" value={formatMinutes(workload.loggedMinutesThisMonth)} />
            </div>
          ) : <Empty>Nessun workload disponibile.</Empty>}
        </TabsContent>
        <TabsContent value="time"><TeamTimeEntriesPage memberId={memberId} /></TabsContent>
        <TabsContent value="availability"><TeamAvailabilityPage memberId={memberId} /></TabsContent>
        <TabsContent value="skills">
          <Card><CardHeader><CardTitle>Competenze membro</CardTitle><CardDescription>Aggiungi o rimuovi skill reali dal profilo.</CardDescription></CardHeader><CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={skillId || "__none__"} onValueChange={(v) => setSkillId(v === "__none__" ? "" : v)}><SelectTrigger><SelectValue placeholder="Seleziona skill" /></SelectTrigger><SelectContent><SelectItem value="__none__">Seleziona skill</SelectItem>{skills.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              <Button onClick={addSkill} disabled={!skillId}><Plus className="mr-2 h-4 w-4" /> Aggiungi</Button>
            </div>
            <div className="flex flex-wrap gap-2">{(member.skill_items || []).length === 0 ? <span className="text-sm text-muted-foreground">Nessuna skill assegnata.</span> : member.skill_items?.map((skill) => <Badge key={skill.id} variant="outline" className="gap-2">{skill.name}<button onClick={() => removeSkill(skill.id)}><Trash2 className="h-3 w-3 text-destructive" /></button></Badge>)}</div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="documents"><DocumentsMiniList documents={documents} memberId={memberId} /></TabsContent>
        <TabsContent value="activity">{activity.length === 0 ? <Empty>Nessuna attività recente.</Empty> : <div className="space-y-2">{activity.map((item) => <Card key={item.id}><CardContent className="flex items-center justify-between p-3 text-sm"><span>{item.action}</span><span className="text-muted-foreground">{formatDateTime(item.created_at)}</span></CardContent></Card>)}</div>}</TabsContent>
        {canManageTeam() ? <TabsContent value="permissions"><PermissionsPanel permissions={permissions} setPermissions={setPermissions} onSave={savePermissions} /></TabsContent> : null}
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Modifica membro</DialogTitle></DialogHeader>
          <TeamMemberForm member={member} options={options} onSubmit={saveMember} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></CardContent></Card>;
}

function InviteResultCard({ invite, onClear }: { invite: TeamInviteResult; onClear: () => void }) {
  const { toast } = useToast();
  const copy = async () => {
    await navigator.clipboard.writeText(invite.invite_link);
    toast({ title: "Link copiato" });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invito webapp</CardTitle>
        <CardDescription>{invite.email_sent ? "Invito inviato correttamente. Puoi anche copiare il link manualmente." : "Il profilo e l'invito sono validi, ma l'email non e stata inviata. Copia e invia manualmente il link."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Scadenza: {formatDateTime(invite.expires_at)}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly className="flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={invite.invite_link} />
          <Button type="button" onClick={copy}><Copy className="mr-2 h-4 w-4" /> Copia link</Button>
          <Button type="button" variant="outline" onClick={onClear}>Nascondi</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionsPanel({ permissions, setPermissions, onSave }: { permissions: TeamModulePermission[]; setPermissions: (items: TeamModulePermission[]) => void; onSave: () => void }) {
  if (permissions.length === 0) {
    return <Card><CardContent className="space-y-3 p-5"><p className="text-sm text-muted-foreground">Nessun permesso granulare configurato. Il sistema ruoli resta la fonte principale.</p><Button onClick={onSave}><Save className="mr-2 h-4 w-4" /> Salva</Button></CardContent></Card>;
  }
  const toggle = (index: number, key: keyof TeamModulePermission) => setPermissions(permissions.map((item, i) => i === index ? { ...item, [key]: !item[key] } : item));
  return <Card><CardHeader><CardTitle>Permessi modulo</CardTitle><CardDescription>Profilo team/reportistica: enforcement completo previsto in Fase 11C.</CardDescription></CardHeader><CardContent className="space-y-3">{permissions.map((permission, index) => <div key={permission.id || permission.module_key} className="flex flex-wrap items-center gap-3 rounded-nav border p-3 text-sm"><span className="w-32 font-semibold">{permission.module_key}</span>{(["can_view", "can_create", "can_update", "can_delete", "can_manage"] as const).map((key) => <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={Boolean(permission[key])} onChange={() => toggle(index, key)} /> {key.replace("can_", "")}</label>)}</div>)}<Button onClick={onSave}><Save className="mr-2 h-4 w-4" /> Salva permessi</Button></CardContent></Card>;
}
