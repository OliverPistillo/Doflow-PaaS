"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Gauge, UserCheck, UsersRound } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { knowledgeApi, type AssetItem, type KnowledgeArticle, type OperationalTemplate } from "@/lib/tenant-knowledge-api";
import { teamApi, type TeamAvailability, type TeamMember, type TeamSummary, type TeamWorkloadItem, type TimeEntry } from "@/lib/tenant-team-api";
import { availabilityMeta, averageLoad, knowledgeRows } from "./resources-model";
import { ResourcesError, ResourcesKpi, ResourcesLoading, ResourcesPageHeader } from "./resources-ui";
import { RecentKnowledge, TeamLoadSummary, TodayAvailability, WeeklyHours } from "./resources-overview-panels";

function range() {
  const today = new Date(); const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4); friday.setHours(23, 59, 59, 999);
  return { from: monday.toISOString(), to: friday.toISOString(), todayFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(), todayTo: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString() };
}

export function ResourcesOverview() {
  const { canView, canCreate } = useTenantAccess();
  const [summary, setSummary] = useState<TeamSummary | null>(null); const [members, setMembers] = useState<TeamMember[]>([]); const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]); const [availability, setAvailability] = useState<TeamAvailability[]>([]); const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]); const [assets, setAssets] = useState<AssetItem[]>([]); const [templates, setTemplates] = useState<OperationalTemplate[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(null); const dates = range();
      try {
        const teamAllowed = canView("team"); const knowledgeAllowed = canView("knowledge");
        const [summaryData, memberData, workloadData, availabilityData, timeData, articleData, assetData, templateData] = await Promise.all([
          teamAllowed ? teamApi.summary() : Promise.resolve(null),
          teamAllowed ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] as TeamMember[] }),
          teamAllowed ? teamApi.workload({ limit: 100 }) : Promise.resolve({ items: [] as TeamWorkloadItem[] }),
          teamAllowed ? teamApi.availability({ date_from: dates.todayFrom, date_to: dates.todayTo }) : Promise.resolve({ items: [] as TeamAvailability[] }),
          teamAllowed ? teamApi.timeEntries({ date_from: dates.from.slice(0, 10), date_to: dates.to.slice(0, 10), limit: 200 }) : Promise.resolve({ items: [] as TimeEntry[] }),
          knowledgeAllowed ? knowledgeApi.listKnowledgeArticles({ limit: 6, sortBy: "updated_at", sortOrder: "desc" }) : Promise.resolve({ items: [] as KnowledgeArticle[] }),
          knowledgeAllowed ? knowledgeApi.listKnowledgeAssets({ limit: 6, sortBy: "updated_at", sortOrder: "desc" }) : Promise.resolve({ items: [] as AssetItem[] }),
          knowledgeAllowed ? knowledgeApi.listOperationalTemplates({ limit: 6, sortBy: "updated_at", sortOrder: "desc" }) : Promise.resolve({ items: [] as OperationalTemplate[] }),
        ]);
        if (!active) return;
        setSummary(summaryData); setMembers(memberData.items || []); setWorkload(workloadData.items || []); setAvailability(availabilityData.items || []); setTimeEntries(timeData.items || []); setArticles(articleData.items || []); setAssets(assetData.items || []); setTemplates(templateData.items || []);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Impossibile caricare l’area Risorse."); } finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [canView]);

  const avg = useMemo(() => averageLoad(workload), [workload]);
  const recentKnowledge = useMemo(() => knowledgeRows(articles, assets, templates).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()).slice(0, 6), [articles, assets, templates]);
  const availableToday = useMemo(() => members.filter((member) => availabilityMeta(availability.find((entry) => entry.team_member_id === member.id && entry.status !== "cancelled")?.type || member.availability_status).label === "Disponibile").length, [members, availability]);
  const primaryHref = canCreate("team") ? "/team/members" : undefined;

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <ResourcesPageHeader title="Risorse" description="Persone, disponibilità e conoscenza aziendale in un’unica vista." ctaLabel="Aggiungi membro" ctaHref={primaryHref} canCreate={Boolean(primaryHref)} />
    <ResourcesError message={error} />
    {loading ? <ResourcesLoading /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResourcesKpi icon={UserCheck} label="Membri attivi" value={summary?.activeTeamMembers ?? "—"} hint={`${summary?.teamMembers || 0} profili complessivi`} />
        <ResourcesKpi icon={UsersRound} label="Disponibili oggi" value={availableToday} hint="Disponibilità reale corrente" tone="green" />
        <ResourcesKpi icon={Gauge} label="Carico medio" value={avg === null ? "—" : `${avg}%`} hint={avg === null ? "Capacità non disponibile" : "Carico reale corrente su capacità"} tone="blue" />
        <ResourcesKpi icon={Clock3} label="Ore questa settimana" value={summary ? `${summary.loggedHoursThisWeek}h` : "—"} hint="Ore effettivamente registrate" tone="orange" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]"><TeamLoadSummary rows={workload} members={members} /><TodayAvailability members={members} entries={availability} /></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]"><WeeklyHours entries={timeEntries} />{canView("knowledge") ? <RecentKnowledge rows={recentKnowledge} members={members} /> : null}</div>
    </>}
  </main>;
}
