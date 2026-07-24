"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeTag } from "@/lib/tenant-knowledge-api";
import { normalizeError } from "./knowledge-shared";

export function KnowledgeAssetTags({ assetId, tags }: { assetId: string; tags: KnowledgeTag[] }) {
  const { toast } = useToast();
  const [tagId, setTagId] = useState("");

  const add = async () => {
    if (!tagId) return;
    try {
      await knowledgeApi.addAssetTag(assetId, tagId);
      setTagId("");
      toast({ title: "Tag collegato" });
    } catch (err) {
      toast({ title: "Tag fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Tag asset</CardTitle></CardHeader>
      <CardContent className="flex gap-2">
        <Select value={tagId || "__none__"} onValueChange={(v) => setTagId(v === "__none__" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Seleziona</SelectItem>
            {tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={add}>Aggiungi</Button>
      </CardContent>
    </Card>
  );
}
