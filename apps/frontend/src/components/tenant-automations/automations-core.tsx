"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, Play, Plus, RefreshCw, Search, Trash2, Workflow, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getDoFlowUser } from "@/lib/jwt";
import {
  automationsApi,
  type AutomationActionLog,
  type AutomationActivity,
  type AutomationDedupeEntry,
  type AutomationOptions,
  type AutomationRule,
  type AutomationRun,
  type AutomationSummary,
  type AutomationTemplate,
} from "@/lib/tenant-automations-api";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  RUN_MODE_LABELS,
  RUN_STATUS_LABELS,
  TRIGGER_LABELS,
  badgeClass,
  canManageAutomations,
  canViewFinanceAutomations,
  compactJson,
  downloadJson,
  formatDateTime,
  formatMs,
  isFinanceAutomation,
  label,
  optionList,
  parseJsonTextarea,
  scrubFinancePayload,
} from "./automation-utils";
import { AutomationsSummaryCards } from "./automations-summary-cards";

type Filters = Record<string, string>;

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

function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

function StateBadge({ value, children }: { value?: string | null; children?: ReactNode }) {
  return <Badge variant="outline" className={badgeClass(value)}>{children || value || "-"}</Badge>;
}

function SelectField({ value, options, placeholder, onChange }: { value?: string; options: Array<{ value: string; label: string }>; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || "__all__"} onValueChange={(next) => onChange(next === "__all__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}</SelectItem>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function JsonBlock({ value, canFinance = true }: { value: unknown; canFinance?: boolean }) {
  return <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">{compactJson(scrubFinancePayload(value, canFinance))}</pre>;
}

function useAutomationOptions() {
  const [options, setOptions] = useState<AutomationOptions | null>(null);
  useEffect(() => {
    let active = true;
    automationsApi.options().then((data) => { if (active) setOptions(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return options;
}

export function AutomationsOverviewPage() {
  const { toast } = useToast();
  const options = useAutomationOptions();
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [triggerType, setTriggerType] = useState("manual_run");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewFinanceAutomations();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, runsData, rulesData] = await Promise.all([
        automationsApi.summary(),
        automationsApi.runs({ limit: 5 }).catch(() => ({ items: [] })),
        automationsApi.rules({ limit: 5, is_enabled: true }).catch(() => ({ items: [] })),
      ]);
      setSummary(summaryData);
      setRuns(runsData.items || []);
      setRules((rulesData.items || []).filter((row) => canFinance || !isFinanceAutomation(row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento automazioni");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const runDue = async () => {
    if (!window.confirm("Eseguire ora le automazioni dovute?")) return;
    setRunning(true);
    try {
      const result = await automationsApi.runDue();
      toast({ title: "Run dovute avviate", description: `Regole eseguite: ${String((result as any).rulesRun ?? "-")}` });
      await load();
    } catch (err) {
      toast({ title: "Run dovute non avviate", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const runTrigger = async () => {
    setRunning(true);
    try {
      const result = await automationsApi.runTrigger(triggerType, {});
      toast({ title: "Trigger eseguito", description: `Regole eseguite: ${String((result as any).rulesRun ?? "-")}` });
      await load();
    } catch (err) {
      toast({ title: "Trigger non eseguito", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Automazioni" description="Motore interno tenant-scoped per regole, trigger, azioni sicure, run e dedupe.">
        <Button asChild><Link href="/automations/rules/new"><Plus className="mr-2 h-4 w-4" /> Nuova regola</Link></Button>
        <Button asChild variant="outline"><Link href="/automations/templates">Template</Link></Button>
      </Header>
      <ErrorBox error={error} />
      {loading ? <Loading /> : <AutomationsSummaryCards summary={summary} />}
      <Card>
        <CardHeader>
          <CardTitle>Run manuali</CardTitle>
          <CardDescription>Le automazioni partono solo da bottoni espliciti in questa UI.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <Button onClick={runDue} disabled={running}><Play className="mr-2 h-4 w-4" /> Esegui automazioni dovute</Button>
          <div className="grid flex-1 gap-2 md:grid-cols-[1fr_auto]">
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue placeholder="Trigger" /></SelectTrigger>
              <SelectContent>{(options?.triggers || ["manual_run"]).map((trigger) => <SelectItem key={trigger} value={trigger}>{label(TRIGGER_LABELS, trigger)}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={runTrigger} disabled={running}><Zap className="mr-2 h-4 w-4" /> Esegui trigger</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Regole abilitate</CardTitle><CardDescription>Prime regole attive restituite dal backend.</CardDescription></CardHeader>
          <CardContent>{rules.length ? <RulesTable rows={rules} compact /> : <Empty>Nessuna regola abilitata.</Empty>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ultime esecuzioni</CardTitle><CardDescription>Storico run più recente.</CardDescription></CardHeader>
          <CardContent>{runs.length ? <RunsTable rows={runs} compact /> : <Empty>Nessuna esecuzione registrata.</Empty>}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AutomationTemplatesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AutomationTemplate[]>([]);
  const [selected, setSelected] = useState<AutomationTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationsApi.templates({ limit: 100 });
      setRows(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento template");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const seed = async () => {
    try {
      await automationsApi.seedTemplates();
      toast({ title: "Template base aggiornati" });
      await load();
    } catch (err) {
      toast({ title: "Seed non riuscito", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Template automazioni" description="Template di sistema riusabili, read-only lato UI.">
        {canManageAutomations() ? <Button onClick={seed}><RefreshCw className="mr-2 h-4 w-4" /> Seed base templates</Button> : null}
      </Header>
      <ErrorBox error={error} />
      {loading ? <Loading /> : rows.length === 0 ? <Empty>Nessun template automazione presente.</Empty> : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Card key={row.id} className="transition-colors hover:bg-muted/40">
              <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{row.name}</p>
                    <StateBadge value={row.category}>{label(CATEGORY_LABELS, row.category)}</StateBadge>
                    <StateBadge value={row.trigger_type}>{label(TRIGGER_LABELS, row.trigger_type)}</StateBadge>
                    {row.is_system ? <Badge variant="outline">System</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.description || row.key}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Azioni: {Array.isArray(row.default_actions) ? row.default_actions.length : 0}</p>
                </div>
                <Button variant="outline" onClick={() => setSelected(row)}>Dettaglio</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {selected ? (
        <Card>
          <CardHeader><CardTitle>{selected.name}</CardTitle><CardDescription>{selected.key}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div><p className="mb-2 text-sm font-semibold">Condizioni default</p><JsonBlock value={selected.default_conditions} /></div>
            <div><p className="mb-2 text-sm font-semibold">Azioni default</p><JsonBlock value={selected.default_actions} /></div>
            <div><p className="mb-2 text-sm font-semibold">Schedule default</p><JsonBlock value={selected.default_schedule} /></div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function AutomationRulesPage() {
  const options = useAutomationOptions();
  const [rows, setRows] = useState<AutomationRule[]>([]);
  const [filters, setFilters] = useState<Filters>({ search: "", category: "", trigger_type: "", run_mode: "", priority: "", is_enabled: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewFinanceAutomations();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationsApi.rules({ ...filters, limit: 100 });
      setRows((data.items || []).filter((row) => canFinance || !isFinanceAutomation(row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento regole");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Regole automazione" description="Regole effettive del tenant, con enable/disable e run manuale.">
        <Button asChild><Link href="/automations/rules/new"><Plus className="mr-2 h-4 w-4" /> Nuova regola</Link></Button>
      </Header>
      <ErrorBox error={error} />
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <div className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Cerca regole..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></div>
          <SelectField value={filters.category} options={optionList(options?.categories, CATEGORY_LABELS)} placeholder="Categoria" onChange={(v) => setFilters((p) => ({ ...p, category: v }))} />
          <SelectField value={filters.trigger_type} options={optionList(options?.triggers, TRIGGER_LABELS)} placeholder="Trigger" onChange={(v) => setFilters((p) => ({ ...p, trigger_type: v }))} />
          <SelectField value={filters.is_enabled} options={[{ value: "true", label: "Abilitate" }, { value: "false", label: "Disabilitate" }]} placeholder="Stato" onChange={(v) => setFilters((p) => ({ ...p, is_enabled: v }))} />
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Filtra</Button>
        </CardContent>
      </Card>
      {loading ? <Loading /> : <RulesTable rows={rows} onReload={load} />}
    </div>
  );
}

function RulesTable({ rows, compact = false, onReload }: { rows: AutomationRule[]; compact?: boolean; onReload?: () => void }) {
  const canManage = canManageAutomations();
  if (!rows.length) return <Empty>Nessuna regola automazione presente.</Empty>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Trigger</th><th className="px-4 py-3">Modo</th><th className="px-4 py-3">Priorità</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3">Ultimo run</th>{compact ? null : <th className="px-4 py-3 text-right">Azioni</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-4 py-3"><Link className="font-semibold text-primary hover:underline" href={`/automations/rules/${row.id}`}>{row.name}</Link><p className="text-xs text-muted-foreground">{row.last_error_message || row.description}</p></td>
              <td className="px-4 py-3"><StateBadge value={row.category}>{label(CATEGORY_LABELS, row.category)}</StateBadge></td>
              <td className="px-4 py-3">{label(TRIGGER_LABELS, row.trigger_type)}</td>
              <td className="px-4 py-3">{label(RUN_MODE_LABELS, row.run_mode)}</td>
              <td className="px-4 py-3"><StateBadge value={row.priority}>{label(PRIORITY_LABELS, row.priority)}</StateBadge></td>
              <td className="px-4 py-3"><StateBadge value={row.is_enabled ? "success" : "skipped"}>{row.is_enabled ? "Abilitata" : "Disabilitata"}</StateBadge></td>
              <td className="px-4 py-3">{formatDateTime(row.last_run_at)}</td>
              {compact ? null : <td className="px-4 py-3"><AutomationRuleActions rule={row} onReload={onReload} canManage={canManage} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AutomationRuleActions({ rule, onReload, canManage = canManageAutomations() }: { rule: AutomationRule; onReload?: () => void; canManage?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      const result = await fn();
      toast({ title: ok });
      onReload?.();
      const runId = (result as any)?.id;
      if (runId && ok.includes("eseguita")) router.push(`/automations/runs/${runId}`);
    } catch (err) {
      toast({ title: "Operazione non riuscita", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" asChild><Link href={`/automations/rules/${rule.id}`}>Apri</Link></Button>
      {canManage ? (
        <>
          {rule.is_enabled ? <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => automationsApi.disableRule(rule.id), "Regola disabilitata")}>Disable</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => automationsApi.enableRule(rule.id), "Regola abilitata")}>Enable</Button>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => window.confirm("Eseguire ora questa automazione?") && act(() => automationsApi.runRule(rule.id), "Regola eseguita")}>Run</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act(async () => downloadJson(`automation-rule-${rule.id}.json`, await automationsApi.exportRule(rule.id)), "Export creato")}><Download className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => window.confirm("Eliminare questa regola?") && act(() => automationsApi.deleteRule(rule.id), "Regola eliminata")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </>
      ) : null}
    </div>
  );
}

export function AutomationRuleFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const options = useAutomationOptions();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "general",
    trigger_type: "manual_run",
    trigger_config: "{}",
    conditions: "{}",
    actions: '[\n  {\n    "type": "noop",\n    "config": {\n      "message": "Test automazione"\n    }\n  }\n]',
    schedule_config: "{}",
    is_enabled: false,
    run_mode: "manual",
    priority: "medium",
    cooldown_minutes: "60",
    max_runs_per_day: "50",
  });
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await automationsApi.createRule({
        name: form.name,
        description: form.description,
        category: form.category,
        trigger_type: form.trigger_type,
        trigger_config: parseJsonTextarea(form.trigger_config, {}),
        conditions: parseJsonTextarea(form.conditions, {}),
        actions: parseJsonTextarea(form.actions, []),
        schedule_config: parseJsonTextarea(form.schedule_config, {}),
        is_enabled: form.is_enabled,
        run_mode: form.run_mode,
        priority: form.priority,
        cooldown_minutes: Number(form.cooldown_minutes || 60),
        max_runs_per_day: Number(form.max_runs_per_day || 50),
      });
      toast({ title: "Regola creata" });
      router.push(`/automations/rules/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione regola");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Nuova regola" description="Crea una regola interna usando solo trigger, condizioni e azioni allowlist." />
      <ErrorBox error={error} />
      <AutomationRuleForm form={form} setForm={setForm} options={options} />
      <div className="flex gap-2"><Button onClick={save} disabled={saving || !form.name}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salva regola</Button><Button variant="outline" onClick={() => router.push("/automations/rules")}>Annulla</Button></div>
    </div>
  );
}

export function AutomationRuleForm({ form, setForm, options }: { form: Record<string, any>; setForm: (fn: any) => void; options: AutomationOptions | null }) {
  const set = (key: string, value: unknown) => setForm((prev: Record<string, any>) => ({ ...prev, [key]: value }));
  return (
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
        <Field label="name" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="description" value={form.description} onChange={(v) => set("description", v)} />
        <SelectField value={form.category} options={optionList(options?.categories, CATEGORY_LABELS)} placeholder="Categoria" onChange={(v) => set("category", v || "general")} />
        <SelectField value={form.trigger_type} options={optionList(options?.triggers, TRIGGER_LABELS)} placeholder="Trigger" onChange={(v) => set("trigger_type", v || "manual_run")} />
        <SelectField value={form.run_mode} options={optionList(options?.runModes, RUN_MODE_LABELS)} placeholder="Run mode" onChange={(v) => set("run_mode", v || "manual")} />
        <SelectField value={form.priority} options={optionList(options?.priorities, PRIORITY_LABELS)} placeholder="Priorità" onChange={(v) => set("priority", v || "medium")} />
        <Field label="cooldown_minutes" type="number" value={form.cooldown_minutes} onChange={(v) => set("cooldown_minutes", v)} />
        <Field label="max_runs_per_day" type="number" value={form.max_runs_per_day} onChange={(v) => set("max_runs_per_day", v)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_enabled)} onChange={(e) => set("is_enabled", e.target.checked)} /> Abilita subito</label>
        <JsonField label="trigger_config" value={form.trigger_config} onChange={(v) => set("trigger_config", v)} />
        <JsonField label="conditions" value={form.conditions} onChange={(v) => set("conditions", v)} />
        <JsonField label="actions" value={form.actions} onChange={(v) => set("actions", v)} />
        <JsonField label="schedule_config" value={form.schedule_config} onChange={(v) => set("schedule_config", v)} />
      </CardContent>
    </Card>
  );
}

function Field({ label: fieldLabel, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="grid gap-2"><Label>{fieldLabel}</Label><Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>;
}

function JsonField({ label: fieldLabel, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="grid gap-2 lg:col-span-2"><Label>{fieldLabel}</Label><Textarea className="min-h-28 font-mono text-xs" value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>;
}

export function AutomationRuleDetailPage({ ruleId }: { ruleId: string }) {
  const { toast } = useToast();
  const options = useAutomationOptions();
  const [rule, setRule] = useState<AutomationRule | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewFinanceAutomations();
  const canManage = canManageAutomations();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ruleData, runsData] = await Promise.all([automationsApi.rule(ruleId), automationsApi.ruleRuns(ruleId, { limit: 10 }).catch(() => ({ items: [] }))]);
      setRule(ruleData);
      setRuns(runsData.items || []);
      setForm({
        name: ruleData.name,
        description: ruleData.description || "",
        category: ruleData.category,
        trigger_type: ruleData.trigger_type,
        trigger_config: compactJson(ruleData.trigger_config),
        conditions: compactJson(ruleData.conditions),
        actions: compactJson(ruleData.actions || []),
        schedule_config: compactJson(ruleData.schedule_config),
        is_enabled: ruleData.is_enabled,
        run_mode: ruleData.run_mode,
        priority: ruleData.priority,
        cooldown_minutes: String(ruleData.cooldown_minutes ?? 60),
        max_runs_per_day: String(ruleData.max_runs_per_day ?? 50),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento regola");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [ruleId]);

  const save = async () => {
    if (!form) return;
    try {
      const updated = await automationsApi.updateRule(ruleId, {
        name: form.name,
        description: form.description,
        category: form.category,
        trigger_type: form.trigger_type,
        trigger_config: parseJsonTextarea(form.trigger_config, {}),
        conditions: parseJsonTextarea(form.conditions, {}),
        actions: parseJsonTextarea(form.actions, []),
        schedule_config: parseJsonTextarea(form.schedule_config, {}),
        run_mode: form.run_mode,
        priority: form.priority,
        cooldown_minutes: Number(form.cooldown_minutes || 60),
        max_runs_per_day: Number(form.max_runs_per_day || 50),
      });
      setRule(updated);
      toast({ title: "Regola aggiornata" });
      await load();
    } catch (err) {
      toast({ title: "Salvataggio non riuscito", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex-1 p-4 md:p-6"><Loading /></div>;
  if (error || !rule || !form) return <div className="flex-1 p-4 md:p-6"><ErrorBox error={error || "Regola non trovata"} /></div>;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title={rule.name} description={`${label(CATEGORY_LABELS, rule.category)} · ${label(TRIGGER_LABELS, rule.trigger_type)}`}>
        <Button asChild variant="outline"><Link href="/automations/rules">Lista</Link></Button>
        <AutomationRuleActions rule={rule} onReload={load} canManage={canManage} />
      </Header>
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="config">Configurazione</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Card><CardContent className="grid gap-4 p-4 md:grid-cols-3"><Info label="Enabled" value={rule.is_enabled ? "Sì" : "No"} /><Info label="Run mode" value={label(RUN_MODE_LABELS, rule.run_mode)} /><Info label="Priorità" value={label(PRIORITY_LABELS, rule.priority)} /><Info label="Cooldown" value={`${rule.cooldown_minutes || 0} min`} /><Info label="Max run/giorno" value={String(rule.max_runs_per_day || 0)} /><Info label="Next run" value={formatDateTime(rule.next_run_at)} /><Info label="Ultimo run" value={formatDateTime(rule.last_run_at)} /><Info label="Ultimo OK" value={formatDateTime(rule.last_success_at)} /><Info label="Ultimo errore" value={formatDateTime(rule.last_error_at)} /><Info label="Errore" value={rule.last_error_message || "-"} wide /></CardContent></Card>
        </TabsContent>
        <TabsContent value="config" className="space-y-4">
          <AutomationRuleForm form={form} setForm={setForm} options={options} />
          <div className="flex gap-2">{canManage ? <Button onClick={save}>Salva configurazione</Button> : null}<Button variant="outline" onClick={load}>Annulla modifiche</Button></div>
          {!canFinance && isFinanceAutomation(rule) ? <ErrorBox error="Payload finance oscurati per questo ruolo." /> : null}
        </TabsContent>
        <TabsContent value="runs"><RunsTable rows={runs} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label: name, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return <div className={wide ? "md:col-span-3" : ""}><p className="text-xs font-semibold text-muted-foreground">{name}</p><div className="mt-1 text-sm">{value}</div></div>;
}

export function AutomationRunsPage() {
  const [rows, setRows] = useState<AutomationRun[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: "", trigger_type: "", rule_id: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationsApi.runs({ ...filters, limit: 100 });
      setRows(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento runs");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Esecuzioni automazioni" description="Storico dei run e relativo esito." />
      <ErrorBox error={error} />
      <Card><CardContent className="grid gap-3 p-4 md:grid-cols-4"><SelectField value={filters.status} options={Object.entries(RUN_STATUS_LABELS).map(([value, label]) => ({ value, label }))} placeholder="Status" onChange={(v) => setFilters((p) => ({ ...p, status: v }))} /><Field label="trigger_type" value={filters.trigger_type} onChange={(v) => setFilters((p) => ({ ...p, trigger_type: v }))} /><Field label="rule_id" value={filters.rule_id} onChange={(v) => setFilters((p) => ({ ...p, rule_id: v }))} /><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Filtra</Button></CardContent></Card>
      {loading ? <Loading /> : <RunsTable rows={rows} />}
    </div>
  );
}

function RunsTable({ rows, compact = false }: { rows: AutomationRun[]; compact?: boolean }) {
  if (!rows.length) return <Empty>Nessuna esecuzione registrata.</Empty>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Run</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Trigger</th><th className="px-4 py-3">Match</th><th className="px-4 py-3">Azioni</th><th className="px-4 py-3">Durata</th>{compact ? null : <th className="px-4 py-3 text-right">Apri</th>}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3"><p className="font-semibold">{formatDateTime(row.started_at)}</p><p className="text-xs text-muted-foreground">{row.rule_name || row.rule_id || "-"}</p></td><td className="px-4 py-3"><StateBadge value={row.status}>{label(RUN_STATUS_LABELS, row.status)}</StateBadge></td><td className="px-4 py-3">{label(TRIGGER_LABELS, row.trigger_type)}</td><td className="px-4 py-3">{row.matched_count || 0}</td><td className="px-4 py-3">{row.actions_success_count || 0} OK · {row.actions_failed_count || 0} KO</td><td className="px-4 py-3">{formatMs(row.duration_ms)}</td>{compact ? null : <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/automations/runs/${row.id}`}>Dettaglio</Link></Button></td>}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function AutomationRunDetailPage({ runId }: { runId: string }) {
  const [run, setRun] = useState<AutomationRun | null>(null);
  const [actions, setActions] = useState<AutomationActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewFinanceAutomations();
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [runData, actionData] = await Promise.all([automationsApi.run(runId), automationsApi.runActions(runId).catch(() => ({ items: [] }))]);
      setRun(runData);
      setActions(actionData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento run");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [runId]);
  if (loading) return <div className="flex-1 p-4 md:p-6"><Loading /></div>;
  if (error || !run) return <div className="flex-1 p-4 md:p-6"><ErrorBox error={error || "Run non trovato"} /></div>;
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Dettaglio run" description={`${label(RUN_STATUS_LABELS, run.status)} · ${label(TRIGGER_LABELS, run.trigger_type)}`}>
        <Button asChild variant="outline"><Link href="/automations/runs">Lista runs</Link></Button>
        {run.rule_id ? <Button asChild variant="outline"><Link href={`/automations/rules/${run.rule_id}`}>Apri rule</Link></Button> : null}
        <Button variant="outline" onClick={async () => downloadJson(`automation-run-${run.id}.json`, await automationsApi.exportRun(run.id))}><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
      </Header>
      <Card><CardContent className="grid gap-4 p-4 md:grid-cols-4"><Info label="Status" value={<StateBadge value={run.status}>{label(RUN_STATUS_LABELS, run.status)}</StateBadge>} /><Info label="Started" value={formatDateTime(run.started_at)} /><Info label="Finished" value={formatDateTime(run.finished_at)} /><Info label="Durata" value={formatMs(run.duration_ms)} /><Info label="Matched" value={String(run.matched_count || 0)} /><Info label="Actions" value={String(run.actions_count || 0)} /><Info label="Success/Failed" value={`${run.actions_success_count || 0}/${run.actions_failed_count || 0}`} /><Info label="Source" value={run.trigger_source || "-"} /><Info label="Errore" value={run.error_message || run.skipped_reason || "-"} wide /></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Input payload</CardTitle></CardHeader><CardContent><JsonBlock value={run.input_payload} canFinance={canFinance} /></CardContent></Card><Card><CardHeader><CardTitle>Result payload</CardTitle></CardHeader><CardContent><JsonBlock value={run.result_payload} canFinance={canFinance} /></CardContent></Card></div>
      <AutomationActionLogs rows={actions} canFinance={canFinance} />
    </div>
  );
}

export function AutomationActionLogs({ rows, canFinance = canViewFinanceAutomations() }: { rows: AutomationActionLog[]; canFinance?: boolean }) {
  if (!rows.length) return <Empty>Nessuna action log per questo run.</Empty>;
  return (
    <Card><CardHeader><CardTitle>Action logs</CardTitle></CardHeader><CardContent className="space-y-3">
      {rows.map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{row.action_type}</p><StateBadge value={row.status}>{label(RUN_STATUS_LABELS, row.status)}</StateBadge><span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span></div><p className="mt-1 text-muted-foreground">{row.message || row.error_message || "Azione registrata."}</p><p className="mt-1 text-xs text-muted-foreground">{row.target_entity_type || "-"} · {row.target_entity_id || "-"}</p><JsonBlock value={row.payload} canFinance={canFinance} /></div>)}
    </CardContent></Card>
  );
}

export function AutomationDedupePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AutomationDedupeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationsApi.dedupe({ limit: 100 });
      setRows(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento dedupe");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const remove = async (id: string) => {
    try {
      await automationsApi.deleteDedupe(id);
      toast({ title: "Dedupe entry eliminata" });
      await load();
    } catch (err) {
      toast({ title: "Eliminazione non riuscita", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Dedupe automazioni" description="Chiavi di deduplica e cooldown usate per evitare spam." /><ErrorBox error={error} />{loading ? <Loading /> : rows.length === 0 ? <Empty>Nessuna entry dedupe.</Empty> : <div className="grid gap-3">{rows.map((row) => <Card key={row.id}><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><p className="truncate font-semibold">{row.dedupe_key}</p><p className="text-sm text-muted-foreground">{row.entity_type || "-"} · {row.entity_id || "-"} · hit {row.hit_count || 0}</p><p className="text-xs text-muted-foreground">Prima: {formatDateTime(row.first_seen_at)} · ultima: {formatDateTime(row.last_seen_at)} · exp: {formatDateTime(row.expires_at)}</p></div>{canManageAutomations() ? <Button size="sm" variant="outline" onClick={() => remove(row.id)}><Trash2 className="mr-2 h-4 w-4" /> Elimina</Button> : null}</CardContent></Card>)}</div>}</div>;
}

export function AutomationActivityPage() {
  const [rows, setRows] = useState<AutomationActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewFinanceAutomations();
  useEffect(() => {
    let active = true;
    automationsApi.activity({ limit: 100 }).then((data) => { if (active) setRows(data.items || []); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Errore caricamento activity"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Activity automazioni" description="Audit interno delle modifiche e delle azioni eseguite." /><ErrorBox error={error} />{loading ? <Loading /> : rows.length === 0 ? <Empty>Nessuna activity registrata.</Empty> : <div className="grid gap-3">{rows.map((row) => <Card key={row.id}><CardContent className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{row.action.replace(/_/g, " ")}</p><span className="text-sm text-muted-foreground">{formatDateTime(row.created_at)}</span></div><p className="mt-1 text-sm text-muted-foreground">Rule {row.rule_id || "-"} · Template {row.template_id || "-"}</p><JsonBlock value={row.metadata} canFinance={canFinance} /></CardContent></Card>)}</div>}</div>;
}

export function AutomationOptionsPanel() {
  const options = useAutomationOptions();
  if (!options) return null;
  return <Card><CardHeader><CardTitle>Options backend</CardTitle><CardDescription>Allowlist disponibili dal backend.</CardDescription></CardHeader><CardContent><JsonBlock value={options} /></CardContent></Card>;
}
