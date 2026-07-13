"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeArticle } from "@/lib/tenant-knowledge-api";
import { ARTICLE_STATUS_LABELS, ARTICLE_TYPE_LABELS, PRIORITY_LABELS, VISIBILITY_LABELS, downloadJson, formatDate, labelFor } from "./knowledge-utils";
import { Empty, ErrorBox, FiltersBar, Header, Loading, SelectFilter, StatusBadge, type Query, itemsOf, normalizeError, useKnowledgeOptions, useKnowledgeRole } from "./knowledge-shared";

export function KnowledgeArticlesPage() {
  const options = useKnowledgeOptions();
  const { canViewFinance } = useKnowledgeRole();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Query>({});
  const [items, setItems] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await knowledgeApi.listKnowledgeArticles(filters);
      setItems(itemsOf(payload).filter((item) => canViewFinance || item.visibility !== "admin"));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [filters]);

  const action = async (type: "publish" | "archive" | "delete" | "export", item: KnowledgeArticle) => {
    try {
      if (type === "publish") await knowledgeApi.publishKnowledgeArticle(item.id);
      if (type === "archive") await knowledgeApi.archiveKnowledgeArticle(item.id);
      if (type === "delete") await knowledgeApi.deleteKnowledgeArticle(item.id);
      if (type === "export") downloadJson(`knowledge-article-${item.id}.json`, await knowledgeApi.exportKnowledgeArticle(item.id));
      if (type !== "export") await load();
    } catch (err) {
      toast({ title: "Azione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Header title="Articoli" description="Procedure, guide, checklist e note operative.">
        <Button asChild><Link href="/knowledge/articles/new"><Plus className="mr-2 h-4 w-4" />Nuovo articolo</Link></Button>
      </Header>
      <FiltersBar filters={filters} onChange={setFilters}>
        <SelectFilter placeholder="Tipo" values={options.article_types} value={filters.article_type} onChange={(v) => setFilters({ ...filters, article_type: v })} />
        <SelectFilter placeholder="Status" values={["draft", "published", "archived"]} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
        <SelectFilter placeholder="Visibility" values={options.visibilities} value={filters.visibility} onChange={(v) => setFilters({ ...filters, visibility: v })} />
        <SelectFilter placeholder="Priorità" values={options.priorities} value={filters.priority} onChange={(v) => setFilters({ ...filters, priority: v })} />
      </FiltersBar>
      {error ? <ErrorBox message={error} /> : null}
      {loading ? <Loading /> : items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <Link href={`/knowledge/articles/${item.id}`} className="font-semibold hover:underline">{item.title}</Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{labelFor(ARTICLE_TYPE_LABELS, item.article_type)}</span>
                    <span>Categoria: {item.category_name || item.category_id || "-"}</span>
                    <span>Review: {formatDate(item.review_due_at)}</span>
                    <span>Pubblicato: {formatDate(item.published_at)}</span>
                    <span>Visite: {item.view_count || 0}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={item.status} map={ARTICLE_STATUS_LABELS} />
                  <StatusBadge value={item.visibility} map={VISIBILITY_LABELS} />
                  <StatusBadge value={item.priority} map={PRIORITY_LABELS} />
                  <Button asChild variant="outline" size="sm"><Link href={`/knowledge/articles/${item.id}`}>Apri</Link></Button>
                  <Button variant="outline" size="sm" onClick={() => void action("publish", item)}>Publish</Button>
                  <Button variant="outline" size="sm" onClick={() => void action("archive", item)}>Archive</Button>
                  <Button variant="outline" size="sm" onClick={() => void action("export", item)}><Download className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => void action("delete", item)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <Empty>Nessun articolo presente.</Empty>}
    </div>
  );
}
