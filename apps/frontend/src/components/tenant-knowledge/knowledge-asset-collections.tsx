"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type AssetCollection } from "@/lib/tenant-knowledge-api";
import { cleanPayload } from "./knowledge-utils";
import { Empty, Header, SelectFilter, itemsOf, normalizeError } from "./knowledge-shared";

export function KnowledgeAssetCollectionsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AssetCollection[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ visibility: "team", sort_order: "0" });
  const [editingId, setEditingId] = useState("");

  const load = async () => setItems(itemsOf(await knowledgeApi.listAssetCollections()));
  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      const payload = cleanPayload({
        name: form.name,
        slug: form.slug,
        description: form.description,
        visibility: form.visibility,
        sort_order: form.sort_order ? Number(form.sort_order) : undefined,
      });
      if (editingId) await knowledgeApi.updateAssetCollection(editingId, payload);
      else await knowledgeApi.createAssetCollection(payload);
      setForm({ visibility: "team", sort_order: "0" });
      setEditingId("");
      await load();
    } catch (err) {
      toast({ title: "Salvataggio fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Header title="Raccolte asset" description="CRUD raccolte per la library interna." />
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <Input placeholder="Nome" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Slug" value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <SelectFilter placeholder="Visibility" values={["private", "team", "admin"]} value={form.visibility} onChange={(v) => setForm({ ...form, visibility: v })} />
          <Input type="number" value={form.sort_order || ""} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          <Textarea className="md:col-span-3" placeholder="Descrizione" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button onClick={submit}>{editingId ? "Aggiorna" : "Crea"}</Button>
        </CardContent>
      </Card>
      {items.length ? items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">{item.slug} · {item.visibility} {item.is_system ? "· system" : ""}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditingId(item.id); setForm({ name: item.name || "", slug: item.slug || "", description: item.description || "", visibility: item.visibility || "team", sort_order: String(item.sort_order || 0) }); }}>Modifica</Button>
              <Button variant="outline" size="sm" onClick={() => knowledgeApi.deleteAssetCollection(item.id).then(load)}>Elimina</Button>
            </div>
          </CardContent>
        </Card>
      )) : <Empty>Nessuna raccolta asset presente.</Empty>}
    </div>
  );
}
