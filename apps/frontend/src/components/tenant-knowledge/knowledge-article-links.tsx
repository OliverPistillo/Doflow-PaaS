"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeArticleLink, type KnowledgeOptions } from "@/lib/tenant-knowledge-api";
import { cleanPayload, isUuid } from "./knowledge-utils";
import { Empty, SelectFilter, normalizeError } from "./knowledge-shared";

export function KnowledgeArticleLinks({ articleId, links, options, onChanged }: { articleId: string; links: KnowledgeArticleLink[]; options: KnowledgeOptions; onChanged: () => void }) {
  const { toast } = useToast();
  const [linkForm, setLinkForm] = useState<Record<string, string>>({ relation_type: "related" });

  const addLink = async () => {
    if (!isUuid(linkForm.entity_id)) {
      toast({ title: "entity_id non valido", description: "Usa un UUID reale/sintatticamente valido. Non usare UUID placeholder.", variant: "destructive" });
      return;
    }
    try {
      await knowledgeApi.createArticleLink(articleId, cleanPayload(linkForm));
      setLinkForm({ relation_type: "related" });
      onChanged();
    } catch (err) {
      toast({ title: "Collegamento fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Collegamenti</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <SelectFilter placeholder="Entity type" values={options.entity_types} value={linkForm.entity_type} onChange={(v) => setLinkForm({ ...linkForm, entity_type: v })} />
          <Input placeholder="entity_id UUID reale" value={linkForm.entity_id || ""} onChange={(e) => setLinkForm({ ...linkForm, entity_id: e.target.value })} />
          <SelectFilter placeholder="Relation" values={options.relation_types} value={linkForm.relation_type} onChange={(v) => setLinkForm({ ...linkForm, relation_type: v })} />
          <Button onClick={addLink}>Collega</Button>
        </div>
        {links.length ? links.map((link) => (
          <div key={link.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>{link.entity_type}:{link.entity_id} · {link.relation_type}</span>
            <Button size="sm" variant="outline" onClick={() => knowledgeApi.deleteArticleLink(articleId, link.id).then(onChanged)}>Rimuovi</Button>
          </div>
        )) : <Empty>Nessun collegamento.</Empty>}
      </CardContent>
    </Card>
  );
}
