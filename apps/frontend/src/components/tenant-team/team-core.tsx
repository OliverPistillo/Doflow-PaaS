"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { teamApi, type TeamMember, type TeamOptions, type TeamSummary, type TeamWorkloadItem } from "@/lib/tenant-team-api";
import { TeamSummaryCards } from "./team-summary-cards";
import { TeamMemberForm } from "./team-member-form";
import { TeamMembersList } from "./team-members-list";
import { AVAILABILITY_LABELS, OPERATIONAL_ROLE_LABELS, STATUS_LABELS, canManageTeam, label } from "./team-utils";
import { Empty, ErrorBox, Header, Loading } from "./team-workload";

export function TeamOverviewPage() {
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, workloadData] = await Promise.all([teamApi.summary(), teamApi.workload()]);
      setSummary(summaryData);
      setWorkload(workloadData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento team");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Team" description="Gestionale interno per dipendenti, collaboratori, carichi, disponibilità e ore lavorate." />
      <ErrorBox error={error} />
      {loading ? <Loading /> : (
        <>
          <TeamSummaryCards summary={summary} />
          {(summary?.teamMembers || 0) === 0 ? <Empty>Nessun membro team configurato.</Empty> : null}
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Carichi principali</CardTitle>
                <CardDescription>Top 5 membri per utilizzo stimato.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {workload.slice(0, 5).length === 0 ? <p className="text-sm text-muted-foreground">Nessun carico disponibile.</p> : workload.slice(0, 5).map((item) => (
                  <div key={item.team_member_id} className="flex items-center justify-between rounded-nav bg-muted/40 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/team/members/${item.team_member_id}`} className="truncate font-semibold text-primary hover:underline">{item.display_name}</Link>
                      <p className="text-xs text-muted-foreground">{label(OPERATIONAL_ROLE_LABELS, item.operational_role)} · {item.openTasks} task aperti</p>
                    </div>
                    <span className={item.isOverloaded ? "font-bold text-destructive" : "font-bold"}>{item.utilizationPercent || 0}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Azioni rapide</CardTitle><CardDescription>Comandi principali del modulo Team.</CardDescription></CardHeader>
              <CardContent className="grid gap-2">
                <Button asChild variant="outline"><Link href="/team/members">Membri</Link></Button>
                <Button asChild variant="outline"><Link href="/team/workload">Carichi lavoro</Link></Button>
                <Button asChild variant="outline"><Link href="/team/time-entries">Ore lavorate</Link></Button>
                <Button asChild variant="outline"><Link href="/team/availability">Disponibilità</Link></Button>
                <Button asChild variant="outline"><Link href="/team/skills">Competenze</Link></Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function TeamMembersPage() {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]);
  const [options, setOptions] = useState<TeamOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const [operationalRole, setOperationalRole] = useState("__all__");
  const [availability, setAvailability] = useState("__all__");

  const params = useMemo(() => ({ search, status, operational_role: operationalRole, availability_status: availability, limit: 100 }), [search, status, operationalRole, availability]);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [memberData, workloadData, optionData] = await Promise.all([
        teamApi.members(params),
        teamApi.workload(),
        teamApi.options().catch(() => null),
      ]);
      setMembers(memberData.items || []);
      setWorkload(workloadData.items || []);
      setOptions(optionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento membri");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { const t = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(t); }, [params]);

  const create = async (body: Partial<TeamMember>) => {
    try {
      await teamApi.createMember(body);
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Membro non creato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const sync = async () => {
    try {
      const result = await teamApi.syncUsers();
      toast({ title: "Utenti sincronizzati", description: `${result.total} profili team presenti.` });
      await load();
    } catch (err) {
      toast({ title: "Sync non riuscito", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const remove = async (member: TeamMember) => {
    if (!window.confirm(`Archiviare ${member.display_name}?`)) return;
    await teamApi.deleteMember(member.id);
    await load();
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <Header title="Dipendenti e collaboratori" description="Profili operativi collegati agli utenti tenant esistenti." />
        <div className="flex flex-wrap gap-2">
          {canManageTeam() ? <Button variant="outline" onClick={sync}><RefreshCw className="mr-2 h-4 w-4" /> Sync utenti</Button> : null}
          {canManageTeam() ? <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nuovo membro</Button> : null}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px_200px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Cerca nome, email, job title..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Filter value={status} setValue={setStatus} all="Tutti gli stati" values={options?.memberStatuses || ["active", "inactive", "invited", "suspended", "archived"]} labels={STATUS_LABELS} />
        <Filter value={operationalRole} setValue={setOperationalRole} all="Tutti i ruoli" values={options?.operationalRoles || Object.keys(OPERATIONAL_ROLE_LABELS)} labels={OPERATIONAL_ROLE_LABELS} />
        <Filter value={availability} setValue={setAvailability} all="Tutte disponibilità" values={options?.availabilityStatuses || Object.keys(AVAILABILITY_LABELS)} labels={AVAILABILITY_LABELS} />
      </div>
      <ErrorBox error={error} />
      {loading ? <Loading /> : <TeamMembersList members={members} workload={workload} onDelete={remove} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Nuovo membro team</DialogTitle></DialogHeader>
          <TeamMemberForm options={options} onSubmit={create} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filter({ value, setValue, all, values, labels }: { value: string; setValue: (value: string) => void; all: string; values: string[]; labels: Record<string, string> }) {
  return <Select value={value} onValueChange={setValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">{all}</SelectItem>{values.map((item) => <SelectItem key={item} value={item}>{label(labels, item)}</SelectItem>)}</SelectContent></Select>;
}
