"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeCategory } from "@/lib/tenant-knowledge-api";
import { cleanPayload } from "./knowledge-utils";
import { Empty, ErrorBox, Header, Loading, SelectFilter, itemsOf, normalizeError } from "./knowledge-shared";

export function KnowledgeCategoriesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeCategory[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ visibility: "team", sort_order: "0" });
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(itemsOf(await knowledgeApi.listKnowledgeCategories()));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      const payload = cleanPayload({
        name: form.name,
        slug: form.slug,
        description: form.description,
        parent_id: form.parent_id,
        icon: form.icon,
        color: form.color,
        visibility: form.visibility,
        sort_order: form.sort_order ? Number(form.sort_order) : undefined,
      });
      if (editingId) await knowledgeApi.updateKnowledgeCategory(editingId, payload);
      else await knowledgeApi.createKnowledgeCategory(payload);
      setForm({ visibility: "team", sort_order: "0" });
      setEditingId("");
      await load();
      toast({ title: "Categoria salvata" });
    } catch (err) {
      toast({ title: "Salvataggio fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    try {
      await knowledgeApi.deleteKnowledgeCategory(id);
      await load();
    } catch (err) {
      toast({ title: "Non hai permessi per modificare questa categoria.", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Header title="Categorie" description="Organizza articoli, asset e template per area operativa." />
      {error ? <ErrorBox message={error} /> : null}
      <Card>
        <CardHeader><CardTitle>{editingId ? "Modifica categoria" : "Crea categoria"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Nome" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Slug" value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input placeholder="Colore" value={form.color || ""} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <Input placeholder="Parent ID opzionale" value={form.parent_id || ""} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} />
          <Input placeholder="Icona" value={form.icon || ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <SelectFilter placeholder="Visibility" values={["private", "team", "admin"]} value={form.visibility} onChange={(value) => setForm({ ...form, visibility: value })} />
          <Input type="number" placeholder="Sort order" value={form.sort_order || ""} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
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
                <div className="text-sm text-muted-foreground">{item.slug} · {item.visibility || "-"} {item.is_system ? "· system" : ""}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditingId(item.id);
                  setForm({
                    name: item.name || "",
                    slug: item.slug || "",
                    description: item.description || "",
                    parent_id: item.parent_id || "",
                    icon: item.icon || "",
                    color: item.color || "",
                    visibility: item.visibility || "team",
                    sort_order: String(item.sort_order || 0),
                  });
                }}>Modifica</Button>
                <Button variant="outline" size="sm" onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )) : <Empty>Nessuna categoria presente.</Empty>}
      </div>
    </div>
  );
}
