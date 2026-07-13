"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { knowledgeApi, type KnowledgeActivity } from "@/lib/tenant-knowledge-api";
import { formatDateTime } from "./knowledge-utils";
import { Empty, FiltersBar, Header, JsonBlock, Loading, type Query, itemsOf } from "./knowledge-shared";

export function KnowledgeActivityPage() {
  const [filters, setFilters] = useState<Query>({});
  const [items, setItems] = useState<KnowledgeActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    knowledgeApi.getKnowledgeActivity(filters).then((data) => setItems(itemsOf(data))).finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="space-y-6">
      <Header title="Activity" description="Audit del modulo knowledge." />
      <FiltersBar filters={filters} onChange={setFilters}>
        <Input placeholder="target_type" value={filters.target_type || ""} onChange={(e) => setFilters({ ...filters, target_type: e.target.value })} />
        <Input placeholder="target_id" value={filters.target_id || ""} onChange={(e) => setFilters({ ...filters, target_id: e.target.value })} />
      </FiltersBar>
      {loading ? <Loading /> : items.length ? items.map((item) => (
        <Card key={item.id}>
          <CardContent className="pt-6 text-sm">
            <div className="font-medium">{item.action}</div>
            <div className="text-muted-foreground">{item.target_type}:{item.target_id} · {item.entity_type}:{item.entity_id} · {item.actor_user_id || "-"} · {formatDateTime(item.created_at)}</div>
            <JsonBlock value={item.metadata} />
          </CardContent>
        </Card>
      )) : <Empty>Nessuna activity presente.</Empty>}
    </div>
  );
}
