"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { knowledgeApi, type KnowledgeSearchResult } from "@/lib/tenant-knowledge-api";
import { formatDateTime, routeForTarget } from "./knowledge-utils";
import { Empty, ErrorBox, Header, Loading, StatusBadge, itemsOf, normalizeError, useKnowledgeRole } from "./knowledge-shared";

export function KnowledgeSearch({ compact = false }: { compact?: boolean }) {
  const { canViewFinance } = useKnowledgeRole();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<KnowledgeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await knowledgeApi.searchKnowledge({ search, limit: compact ? 5 : 50 });
      setItems(itemsOf(payload).filter((item) => canViewFinance || item.visibility !== "admin"));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!compact) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{compact ? "Ricerca veloce" : "Ricerca interna"}</CardTitle>
        <CardDescription>Cerca tra articoli, asset e template operativi reali.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="Cerca procedure, asset, template..." />
          <Button onClick={run} disabled={loading}><Search className="mr-2 h-4 w-4" />Cerca</Button>
        </div>
        {error ? <ErrorBox message={error} /> : null}
        {loading ? <Loading /> : (
          <div className="space-y-2">
            {items.length ? items.map((item, index) => {
              const id = item.target_id || item.id || "";
              const href = routeForTarget(item.target_type, id);
              const content = (
                <div className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{item.title || "Risultato knowledge"}</div>
                    <StatusBadge value={item.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.target_type} · {item.type || item.category || "-"} · {formatDateTime(item.updated_at)}</div>
                  {item.excerpt ? <p className="mt-2 text-muted-foreground">{item.excerpt}</p> : null}
                </div>
              );
              return href ? <Link key={`${id}-${index}`} href={href}>{content}</Link> : <div key={`${id}-${index}`}>{content}</div>;
            }) : <Empty>Nessun risultato trovato.</Empty>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KnowledgeSearchPage() {
  return <div className="space-y-6"><Header title="Ricerca" description="Ricerca tenant-scoped nella knowledge interna." /><KnowledgeSearch /></div>;
}
