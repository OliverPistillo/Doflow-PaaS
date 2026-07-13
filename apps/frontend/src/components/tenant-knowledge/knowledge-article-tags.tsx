"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeTag } from "@/lib/tenant-knowledge-api";
import { normalizeError } from "./knowledge-shared";

export function KnowledgeArticleTags({ articleId, tags }: { articleId: string; tags: KnowledgeTag[] }) {
  const { toast } = useToast();
  const [tagId, setTagId] = useState("");

  const addTag = async () => {
    if (!tagId) return;
    try {
      await knowledgeApi.addArticleTag(articleId, tagId);
      setTagId("");
      toast({ title: "Tag collegato" });
    } catch (err) {
      toast({ title: "Tag fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Tag articolo</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={tagId || "__none__"} onValueChange={(v) => setTagId(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Seleziona tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Seleziona</SelectItem>
              {tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addTag}>Aggiungi tag</Button>
        </div>
      </CardContent>
    </Card>
  );
}
