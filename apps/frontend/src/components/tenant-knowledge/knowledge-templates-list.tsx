"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type OperationalTemplate } from "@/lib/tenant-knowledge-api";
import { TEMPLATE_STATUS_LABELS, VISIBILITY_LABELS, downloadJson, formatDateTime } from "./knowledge-utils";
import { Empty, FiltersBar, Header, Loading, SelectFilter, StatusBadge, type Query, itemsOf, normalizeError, useKnowledgeOptions, useKnowledgeRole } from "./knowledge-shared";

export function KnowledgeTemplatesPage() {
  const options = useKnowledgeOptions();
  const { canViewFinance } = useKnowledgeRole();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Query>({});
  const [items, setItems] = useState<OperationalTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const payload = await knowledgeApi.listOperationalTemplates(filters);
    setItems(itemsOf(payload).filter((item) => canViewFinance || item.visibility !== "admin"));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filters]);

  const action = async (type: "activate" | "archive" | "duplicate" | "export" | "delete", item: OperationalTemplate) => {
    try {
      if (type === "activate") await knowledgeApi.activateOperationalTemplate(item.id);
      if (type === "archive") await knowledgeApi.archiveOperationalTemplate(item.id);
      if (type === "duplicate") {
        const copy = await knowledgeApi.duplicateOperationalTemplate(item.id);
        location.href = `/knowledge/templates/${copy.id}`;
        return;
      }
      if (type === "export") downloadJson(`knowledge-template-${item.id}.json`, await knowledgeApi.exportOperationalTemplate(item.id));
      if (type === "delete") await knowledgeApi.deleteOperationalTemplate(item.id);
      if (type !== "export") await load();
    } catch (err) {
      toast({ title: "Azione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Header title="Template operativi" description="Template interni attivabili, versionati e riutilizzabili.">
        <Button asChild><Link href="/knowledge/templates/new"><Plus className="mr-2 h-4 w-4" />Nuovo template</Link></Button>
      </Header>
      <FiltersBar filters={filters} onChange={setFilters}>
        <SelectFilter placeholder="Tipo" values={options.template_types} value={filters.template_type} onChange={(v) => setFilters({ ...filters, template_type: v })} />
        <SelectFilter placeholder="Status" values={["draft", "active", "archived"]} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
        <SelectFilter placeholder="Visibility" values={options.visibilities} value={filters.visibility} onChange={(v) => setFilters({ ...filters, visibility: v })} />
      </FiltersBar>
      {loading ? <Loading /> : items.length ? items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href={`/knowledge/templates/${item.id}`} className="font-semibold hover:underline">{item.name}</Link>
              <div className="text-sm text-muted-foreground">{item.template_type} · {item.category} · usage {item.usage_count || 0} · last used {formatDateTime(item.last_used_at)} {item.is_system ? "· system" : ""}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={item.status} map={TEMPLATE_STATUS_LABELS} />
              <StatusBadge value={item.visibility} map={VISIBILITY_LABELS} />
              <Button asChild variant="outline" size="sm"><Link href={`/knowledge/templates/${item.id}`}>Apri</Link></Button>
              <Button variant="outline" size="sm" onClick={() => void action("activate", item)}>Activate</Button>
              <Button variant="outline" size="sm" onClick={() => void action("archive", item)}>Archive</Button>
              <Button variant="outline" size="sm" onClick={() => void action("duplicate", item)}>Duplica</Button>
              <Button variant="outline" size="sm" onClick={() => void action("export", item)}><Download className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => void action("delete", item)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )) : <Empty>Nessun template operativo presente.</Empty>}
    </div>
  );
}
