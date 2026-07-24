"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  knowledgeApi,
  type AssetItem,
  type KnowledgeArticle,
  type KnowledgeFavorite,
  type KnowledgeSummary,
  type OperationalTemplate,
} from "@/lib/tenant-knowledge-api";
import { downloadJson, formatDateTime, routeForTarget } from "./knowledge-utils";
import { Empty, ErrorBox, Header, Loading, itemsOf, normalizeError } from "./knowledge-shared";
import { KnowledgeSearch } from "./knowledge-search";
import { KnowledgeSummaryCards } from "./knowledge-summary-cards";

type MiniItem = {
  id?: string;
  title?: string | null;
  name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  target_id?: string | null;
  target_type?: string | null;
};

export function KnowledgeOverviewPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<KnowledgeSummary | null>(null);
  const [favorites, setFavorites] = useState<KnowledgeFavorite[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryValue, favoritesValue] = await Promise.all([
        knowledgeApi.getKnowledgeSummary(),
        knowledgeApi.listKnowledgeFavorites().catch(() => ({ items: [] as KnowledgeFavorite[] })),
      ]);
      setSummary(summaryValue);
      setFavorites(itemsOf(favoritesValue));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const seed = async () => {
    try {
      await knowledgeApi.seedKnowledgeBase();
      toast({ title: "Base knowledge rigenerata" });
      await load();
    } catch (err) {
      toast({ title: "Seed fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  const exportAll = async () => {
    try {
      downloadJson("knowledge-export.json", await knowledgeApi.exportKnowledge());
    } catch (err) {
      toast({ title: "Export fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const data = summary || {};

  return (
    <div className="space-y-6">
      <Header title="Knowledge Base" description="Procedure, asset e template operativi interni del tenant doflow.">
        <Button asChild><Link href="/knowledge/articles/new"><Plus className="mr-2 h-4 w-4" />Nuovo articolo</Link></Button>
        <Button asChild variant="outline"><Link href="/knowledge/assets/new">Nuovo asset</Link></Button>
        <Button asChild variant="outline"><Link href="/knowledge/templates/new">Nuovo template</Link></Button>
        <Button variant="outline" onClick={seed}><RefreshCw className="mr-2 h-4 w-4" />Rigenera base knowledge</Button>
        <Button variant="outline" onClick={exportAll}><Download className="mr-2 h-4 w-4" />Export</Button>
      </Header>
      <KnowledgeSearch compact />
      <KnowledgeSummaryCards summary={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniList title="Articoli recenti" items={data.recentArticles || []} href={(item) => `/knowledge/articles/${item.id}`} empty="Nessun articolo recente." />
        <MiniList title="Articoli da revisionare" items={data.reviewArticles || []} href={(item) => `/knowledge/articles/${item.id}`} empty="Nessun articolo da revisionare." />
        <MiniList title="Template attivi" items={data.activeTemplateItems || []} href={(item) => `/knowledge/templates/${item.id}`} empty="Nessun template attivo." />
        <MiniList title="Asset recenti" items={data.recentAssets || []} href={(item) => `/knowledge/assets/${item.id}`} empty="Nessun asset recente." />
        <MiniList title="Preferiti" items={favorites} href={(item) => routeForTarget(item.target_type, item.target_id) || "/knowledge/favorites"} empty="Nessun preferito salvato." />
      </div>
    </div>
  );
}

function MiniList<T extends MiniItem | KnowledgeArticle | OperationalTemplate | AssetItem | KnowledgeFavorite>(
  { title, items, href, empty }: { title: string; items: T[]; href: (item: T) => string; empty: string },
) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length ? items.slice(0, 5).map((item, index) => (
          <Link key={item.id || index} href={href(item)} className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
            <div className="font-medium">{miniTitle(item)}</div>
            <div className="text-xs text-muted-foreground">{formatDateTime(miniDate(item))}</div>
          </Link>
        )) : <Empty>{empty}</Empty>}
      </CardContent>
    </Card>
  );
}

function miniTitle(item: MiniItem | KnowledgeArticle | OperationalTemplate | AssetItem | KnowledgeFavorite) {
  if ("title" in item && item.title) return item.title;
  if ("name" in item && item.name) return item.name;
  return "Elemento knowledge";
}

function miniDate(item: MiniItem | KnowledgeArticle | OperationalTemplate | AssetItem | KnowledgeFavorite) {
  if ("updated_at" in item && item.updated_at) return item.updated_at;
  return item.created_at || null;
}
