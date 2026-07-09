"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Building2, FileText, FolderKanban, Loader2, Target, Users, Wallet, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { reportsApi, type KpiTarget, type ReportKey, type ReportParams, type ReportSummary } from "@/lib/tenant-reports-api";
import { getDoFlowUser } from "@/lib/jwt";
import { ReportFilters, useReportParams } from "./report-filters";
import { ReportsSummaryCards } from "./reports-summary-cards";
import { badgeTone, canViewFinance, compactJson, downloadText, entriesOf, formatCurrency, formatNumber, formatPercent, isFinanceKey, KPI_STATUS_LABELS, label, REPORT_LABELS } from "./report-utils";

export function ReportsOverviewPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewFinance(summary?.user?.role || getDoFlowUser()?.role);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reportsApi.summary()
      .then((data) => { if (active) setSummary(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Errore caricamento report"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const cards = [
    { label: "Direzione", href: "/reports/executive", icon: BarChart3 },
    { label: "Vendite", href: "/reports/sales", icon: Target },
    { label: "Progetti", href: "/reports/projects", icon: FolderKanban },
    ...(canFinance ? [{ label: "Finance", href: "/reports/finance", icon: Wallet }] : []),
    { label: "Team", href: "/reports/team", icon: Users },
    { label: "Documenti", href: "/reports/documents", icon: FileText },
    { label: "Operatività", href: "/reports/operations", icon: Workflow },
    { label: "Clienti", href: "/reports/customers", icon: Building2 },
  ];

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Report/KPI" description="Centro direzionale interno con KPI reali da CRM, progetti, finance, team, documenti e notifiche." />
      <ErrorBox error={error} />
      {loading ? <Loading /> : (
        <>
          <ReportsSummaryCards summary={summary} canViewFinance={canFinance} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.href} className="transition-colors hover:bg-muted/40">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-semibold">{card.label}</p>
                      <p className="text-sm text-muted-foreground">Apri report</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={card.href}><Icon className="mr-2 h-4 w-4" /> Apri</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Azioni rapide</CardTitle>
              <CardDescription>Snapshot, obiettivi e viste salvate.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/reports/executive">Report direzione</Link></Button>
              <Button asChild variant="outline"><Link href="/reports/targets">Obiettivi KPI</Link></Button>
              <Button asChild variant="outline"><Link href="/reports/snapshots">Snapshot</Link></Button>
              <Button asChild variant="outline"><Link href="/reports/saved-views">Viste salvate</Link></Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function ReportPage({
  reportKey,
  title,
  description,
  load,
  render,
  financeOnly = false,
}: {
  reportKey: ReportKey;
  title: string;
  description: string;
  load: (params: ReportParams) => Promise<any>;
  render: (data: any, canFinance: boolean) => ReactNode;
  financeOnly?: boolean;
}) {
  const params = useReportParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const role = data?.user?.role || getDoFlowUser()?.role;
  const canFinance = canViewFinance(role);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    load(params)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Errore caricamento report"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(params), load]);

  if (financeOnly && !canFinance && !loading) {
    return (
      <div className="flex-1 space-y-5 p-4 md:p-6">
        <Header title={title} description={description} />
        <ForbiddenBox>Non hai permessi per vedere i report Finance.</ForbiddenBox>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <Header title={title} description={description} />
        <ExportButtons reportKey={reportKey} params={params} />
      </div>
      <ReportFilters />
      <ErrorBox error={error} />
      {loading ? <Loading /> : data ? render(data, canFinance) : <Empty>Nessun dato disponibile per il periodo selezionato.</Empty>}
    </div>
  );
}

export function Header({ title, description }: { title: string; description: string }) {
  return <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

export function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

export function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="rounded-nav border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

export function ForbiddenBox({ children }: { children: ReactNode }) {
  return <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><AlertTriangle className="h-5 w-5 text-destructive" />{children}</CardContent></Card>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{children}</CardContent></Card>;
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle>{description ? <CardDescription>{description}</CardDescription> : null}</CardHeader><CardContent>{children}</CardContent></Card>;
}

export function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: unknown; kind?: "currency" | "percent" | "number"; hidden?: boolean }> }) {
  const visible = metrics.filter((m) => !m.hidden);
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {visible.map((metric) => (
        <div key={metric.label} className="rounded-nav border bg-muted/30 p-3">
          <p className="text-xs font-semibold text-muted-foreground">{metric.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {metric.kind === "currency" ? formatCurrency(metric.value) : metric.kind === "percent" ? formatPercent(metric.value) : formatNumber(metric.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function KeyValueList({ data, canFinance = true, valueKind }: { data?: Record<string, unknown> | null; canFinance?: boolean; valueKind?: "currency" | "percent" | "number" }) {
  const entries = entriesOf(data).filter(([key]) => canFinance || !isFinanceKey(key));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3 rounded-nav bg-muted/40 px-3 py-2 text-sm">
          <span className="truncate text-muted-foreground">{key}</span>
          <span className="font-semibold tabular-nums">{valueKind === "currency" ? formatCurrency(value) : valueKind === "percent" ? formatPercent(value) : formatNumber(value)}</span>
        </div>
      ))}
    </div>
  );
}

export function SimpleTable({ rows, columns, empty = "Nessun dato disponibile." }: { rows?: any[]; columns: Array<{ key: string; label: string; finance?: boolean; format?: (value: any, row: any) => ReactNode }>; empty?: string }) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">{columns.map((col) => <th key={col.key} className="px-3 py-2">{col.label}</th>)}</tr></thead>
        <tbody>
          {list.map((row, index) => (
            <tr key={row.id || index} className="border-b last:border-0">
              {columns.map((col) => <td key={col.key} className="px-3 py-2">{col.format ? col.format(row[col.key], row) : String(row[col.key] ?? "-")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TargetsProgress({ targets }: { targets?: KpiTarget[] }) {
  const list = targets || [];
  if (list.length === 0) return <p className="text-sm text-muted-foreground">Nessun target configurato.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((target) => {
        const progress = Math.min(100, Number(target.progressPercent || 0));
        return (
          <div key={target.id || target.kpiKey || target.kpi_key} className="rounded-nav border p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{target.label}</p>
                <p className="text-xs text-muted-foreground">{target.kpiKey || target.kpi_key} · target {formatNumber(target.target ?? target.target_value)}</p>
              </div>
              <Badge variant="outline" className={badgeTone(target.status)}>{label(KPI_STATUS_LABELS, target.status)}</Badge>
            </div>
            <Progress value={progress} />
            <p className="mt-2 text-xs text-muted-foreground">Actual {formatNumber(target.actual)} · {formatPercent(target.progressPercent)}</p>
          </div>
        );
      })}
    </div>
  );
}

export function JsonPreview({ value }: { value: unknown }) {
  return <pre className="max-h-[420px] overflow-auto rounded-nav bg-muted/50 p-3 text-xs">{compactJson(value)}</pre>;
}

export function ExportButtons({ reportKey, params }: { reportKey: string; params: ReportParams }) {
  const { toast } = useToast();
  const exportIt = async (format: "json" | "csv") => {
    try {
      const result = await reportsApi.exportReport(reportKey, { ...params, format });
      if (format === "csv") {
        downloadText(`report-${reportKey}.csv`, result.csv || "", "text/csv");
      } else {
        downloadText(`report-${reportKey}.json`, JSON.stringify(result.payload ?? result, null, 2));
      }
    } catch (err) {
      toast({ title: "Export fallito", description: err instanceof Error ? err.message : "Errore export", variant: "destructive" });
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => exportIt("json")}>Esporta JSON</Button>
      <Button variant="outline" onClick={() => exportIt("csv")}>Esporta CSV</Button>
    </div>
  );
}

export function ReportBadge({ value }: { value?: string | null }) {
  return <Badge variant="outline" className={badgeTone(value)}>{value || "-"}</Badge>;
}

export function reportTitle(key: string) {
  return label(REPORT_LABELS, key);
}

