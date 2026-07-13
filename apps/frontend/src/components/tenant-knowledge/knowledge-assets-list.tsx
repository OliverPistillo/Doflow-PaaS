"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type AssetItem } from "@/lib/tenant-knowledge-api";
import { ASSET_STATUS_LABELS, VISIBILITY_LABELS, downloadJson, formatDateTime } from "./knowledge-utils";
import { Empty, FiltersBar, Header, Loading, SelectFilter, StatusBadge, type Query, itemsOf, normalizeError, useKnowledgeOptions, useKnowledgeRole } from "./knowledge-shared";

export function KnowledgeAssetsPage() {
  const options = useKnowledgeOptions();
  const { canViewFinance } = useKnowledgeRole();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Query>({});
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const payload = await knowledgeApi.listKnowledgeAssets(filters);
    setItems(itemsOf(payload).filter((item) => canViewFinance || item.visibility !== "admin"));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filters]);

  const action = async (type: "archive" | "delete" | "export", item: AssetItem) => {
    try {
      if (type === "archive") await knowledgeApi.archiveKnowledgeAsset(item.id);
      if (type === "delete") await knowledgeApi.deleteKnowledgeAsset(item.id);
      if (type === "export") downloadJson(`knowledge-asset-${item.id}.json`, await knowledgeApi.exportKnowledgeAsset(item.id));
      if (type !== "export") await load();
    } catch (err) {
      toast({ title: "Azione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Header title="Asset" description="Asset library interna collegabile ai Documenti.">
        <Button asChild><Link href="/knowledge/assets/new"><Plus className="mr-2 h-4 w-4" />Nuovo asset</Link></Button>
        <Button asChild variant="outline"><Link href="/knowledge/assets/collections">Raccolte asset</Link></Button>
      </Header>
      <FiltersBar filters={filters} onChange={setFilters}>
        <SelectFilter placeholder="Tipo" values={options.asset_types} value={filters.asset_type} onChange={(v) => setFilters({ ...filters, asset_type: v })} />
        <SelectFilter placeholder="Status" values={["active", "archived"]} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
        <SelectFilter placeholder="Visibility" values={options.visibilities} value={filters.visibility} onChange={(v) => setFilters({ ...filters, visibility: v })} />
      </FiltersBar>
      {loading ? <Loading /> : items.length ? items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link className="font-semibold hover:underline" href={`/knowledge/assets/${item.id}`}>{item.name}</Link>
              <div className="text-sm text-muted-foreground">{item.asset_type} · {item.collection_name || item.collection_id || "-"} · {item.document_id || item.external_url || "-"} · {formatDateTime(item.updated_at)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={item.status} map={ASSET_STATUS_LABELS} />
              <StatusBadge value={item.visibility} map={VISIBILITY_LABELS} />
              <Button asChild variant="outline" size="sm"><Link href={`/knowledge/assets/${item.id}`}>Apri</Link></Button>
              <Button variant="outline" size="sm" onClick={() => void action("archive", item)}>Archive</Button>
              <Button variant="outline" size="sm" onClick={() => void action("export", item)}><Download className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => void action("delete", item)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )) : <Empty>Nessun asset presente.</Empty>}
    </div>
  );
}
