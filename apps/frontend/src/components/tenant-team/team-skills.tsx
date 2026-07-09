"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { teamApi, type TeamSkill } from "@/lib/tenant-team-api";
import { canManageTeam } from "./team-utils";
import { Empty, ErrorBox, Header, Loading } from "./team-workload";

export function TeamSkillsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<TeamSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamSkill | null>(null);
  const [form, setForm] = useState({ name: "", category: "", description: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teamApi.skills();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento competenze");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const startEdit = (skill?: TeamSkill) => {
    setEditing(skill || null);
    setForm({ name: skill?.name || "", category: skill?.category || "", description: skill?.description || "" });
    setOpen(true);
  };
  const save = async () => {
    try {
      if (editing) await teamApi.updateSkill(editing.id, form);
      else await teamApi.createSkill(form);
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Competenza non salvata", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const remove = async (skill: TeamSkill) => {
    if (!window.confirm(`Eliminare ${skill.name}?`)) return;
    await teamApi.deleteSkill(skill.id);
    await load();
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Header title="Competenze" description="Skill reali del team, seedate e modificabili." />
        {canManageTeam() ? <Button onClick={() => startEdit()}><Plus className="mr-2 h-4 w-4" /> Nuova skill</Button> : null}
      </div>
      <ErrorBox error={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty>Nessuna competenza configurata.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((skill) => (
            <Card key={skill.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{skill.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline">{skill.category || "generic"}</Badge>
                <p className="min-h-10 text-sm text-muted-foreground">{skill.description || "Nessuna descrizione."}</p>
                {canManageTeam() ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(skill)}>Modifica</Button><Button size="sm" variant="outline" onClick={() => remove(skill)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifica skill" : "Nuova skill"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <Button onClick={save} disabled={!form.name.trim()}>Salva</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
