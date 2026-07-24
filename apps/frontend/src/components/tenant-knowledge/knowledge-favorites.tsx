"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeFavorite } from "@/lib/tenant-knowledge-api";
import { formatDateTime, routeForTarget } from "./knowledge-utils";
import { Empty, Header, Loading, itemsOf, normalizeError } from "./knowledge-shared";

export function KnowledgeFavoritesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setItems(itemsOf(await knowledgeApi.listKnowledgeFavorites()).filter(Boolean));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Header title="Preferiti" description="Contenuti knowledge salvati dall'utente." />
      {items.length ? items.map((item) => {
        const href = routeForTarget(item.target_type, item.target_id);
        return (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <div className="font-medium">{item.title || item.target_type}</div>
                <div className="text-sm text-muted-foreground">{item.target_id} · {formatDateTime(item.created_at)}</div>
              </div>
              <div className="flex gap-2">
                {href ? <Button asChild variant="outline" size="sm"><Link href={href}>Apri</Link></Button> : null}
                <Button variant="outline" size="sm" onClick={() => knowledgeApi.deleteKnowledgeFavorite(item.id).then(load).catch((err) => toast({ title: "Rimozione fallita", description: normalizeError(err), variant: "destructive" }))}>Rimuovi</Button>
              </div>
            </CardContent>
          </Card>
        );
      }) : <Empty>Nessun preferito salvato.</Empty>}
    </div>
  );
}
