"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { teamApi, type TeamWorkloadItem } from "@/lib/tenant-team-api";
import { AVAILABILITY_LABELS, OPERATIONAL_ROLE_LABELS, availabilityBadgeClass, formatMinutes, label, workloadTone } from "./team-utils";

export function TeamWorkloadPage() {
  const [items, setItems] = useState<TeamWorkloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teamApi.workload();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento carichi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Carichi lavoro" description="Vista operativa reale su task, progetti, ore loggate e disponibilità." />
      {error ? <ErrorBox error={error} /> : null}
      {loading ? <Loading /> : items.length === 0 ? <Empty>Nessun carico lavoro disponibile.</Empty> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <Card key={item.team_member_id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{item.display_name || item.email}</CardTitle>
                    <CardDescription>{label(OPERATIONAL_ROLE_LABELS, item.operational_role)} · {item.email}</CardDescription>
                  </div>
                  <Badge variant="outline" className={availabilityBadgeClass(item.availability_status)}>{label(AVAILABILITY_LABELS, item.availability_status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Utilizzo stimato</span>
                    <span className={workloadTone(item.utilizationPercent)}>{item.utilizationPercent || 0}%</span>
                  </div>
                  <Progress value={Math.min(100, item.utilizationPercent || 0)} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Mini label="Task aperti" value={item.openTasks} />
                  <Mini label="Scaduti" value={item.overdueTasks} danger={item.overdueTasks > 0} />
                  <Mini label="Progetti" value={item.activeProjects} />
                  <Mini label="Ore mese" value={formatMinutes(item.loggedMinutesThisMonth)} />
                </div>
                {item.warnings?.length ? (
                  <div className="flex items-start gap-2 rounded-nav border border-chart-5/30 bg-chart-5/10 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-5" />
                    <span>{item.warnings.join(", ")}</span>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/team/members/${item.team_member_id}`}>Apri membro</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href="/projects/tasks">Apri task</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header({ title, description }: { title: string; description: string }) {
  return <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

export function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-nav border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{children}</CardContent></Card>;
}

function Mini({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-nav bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={danger ? "font-bold text-destructive" : "font-bold"}>{value}</p></div>;
}
