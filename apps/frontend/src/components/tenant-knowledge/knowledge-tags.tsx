"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeTag } from "@/lib/tenant-knowledge-api";
import { cleanPayload } from "./knowledge-utils";
import { Empty, ErrorBox, Header, Loading, itemsOf, normalizeError } from "./knowledge-shared";

export function KnowledgeTagsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeTag[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(itemsOf(await knowledgeApi.listKnowledgeTags()));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      const payload = cleanPayload({ name: form.name, slug: form.slug, color: form.color, description: form.description });
      if (editingId) await knowledgeApi.updateKnowledgeTag(editingId, payload);
      else await knowledgeApi.createKnowledgeTag(payload);
      setForm({});
      setEditingId("");
      await load();
      toast({ title: "Tag salvato" });
    } catch (err) {
      toast({ title: "Salvataggio fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    try {
      await knowledgeApi.deleteKnowledgeTag(id);
      await load();
    } catch (err) {
      toast({ title: "Eliminazione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Header title="Tag" description="Tag interni per collegare e filtrare contenuti knowledge." />
      {error ? <ErrorBox message={error} /> : null}
      <Card>
        <CardHeader><CardTitle>{editingId ? "Modifica tag" : "Crea tag"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Nome" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Slug" value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input placeholder="Colore" value={form.color || ""} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <Textarea className="md:col-span-2" placeholder="Descrizione" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button onClick={submit}>{editingId ? "Aggiorna" : "Crea"}</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {items.length ? items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold">{item.name}</div>
                <div className="text-sm text-muted-foreground">{item.slug} · {item.color || "-"}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditingId(item.id); setForm({ name: item.name || "", slug: item.slug || "", color: item.color || "", description: item.description || "" }); }}>Modifica</Button>
                <Button variant="outline" size="sm" onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )) : <Empty>Nessun tag presente.</Empty>}
      </div>
    </div>
  );
}
