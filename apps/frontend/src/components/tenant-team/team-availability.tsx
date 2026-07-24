"use client";

import { useEffect, useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { teamApi, type TeamAvailability, type TeamMember } from "@/lib/tenant-team-api";
import { AVAILABILITY_LABELS, STATUS_LABELS, availabilityBadgeClass, canManageTeamOps, formatDateTime, label } from "./team-utils";
import { Empty, ErrorBox, Header, Loading } from "./team-workload";

const TYPES = ["available", "unavailable", "vacation", "sick", "remote", "reduced_hours", "external_unavailable", "focus_time"];
const STATUSES = ["planned", "confirmed", "cancelled"];

export function TeamAvailabilityPage({ memberId }: { memberId?: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<TeamAvailability[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState("__all__");
  const [typeFilter, setTypeFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [form, setForm] = useState({
    team_member_id: memberId || "",
    type: "vacation",
    title: "",
    starts_at: "",
    ends_at: "",
    status: "confirmed",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [availability, memberData] = await Promise.all([
        teamApi.availability({
          team_member_id: memberId || memberFilter,
          type: typeFilter,
          status: statusFilter,
          date_from: dateFrom,
          date_to: dateTo,
        }),
        teamApi.members({ limit: 100 }).catch(() => ({ items: [] })),
      ]);
      setItems(availability.items || []);
      setMembers(memberData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore disponibilità");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [memberId, memberFilter, typeFilter, statusFilter, dateFrom, dateTo]);

  const save = async () => {
    try {
      if (editingId) await teamApi.updateAvailability(editingId, form);
      else await teamApi.createAvailability(form);
      setOpen(false);
      setEditingId(null);
      setForm((p) => ({ ...p, title: "", starts_at: "", ends_at: "", notes: "" }));
      await load();
    } catch (err) {
      toast({ title: "Disponibilità non salvata", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const startCreate = () => {
    setEditingId(null);
    setForm({ team_member_id: memberId || "", type: "vacation", title: "", starts_at: "", ends_at: "", status: "confirmed", notes: "" });
    setOpen(true);
  };
  const startEdit = (item: TeamAvailability) => {
    setEditingId(item.id);
    setForm({
      team_member_id: item.team_member_id || memberId || "",
      type: item.type || "vacation",
      title: item.title || "",
      starts_at: toDateTimeLocal(item.starts_at),
      ends_at: toDateTimeLocal(item.ends_at),
      status: item.status || "confirmed",
      notes: item.notes || "",
    });
    setOpen(true);
  };
  const remove = async (item: TeamAvailability) => {
    if (!window.confirm("Eliminare questa disponibilità?")) return;
    await teamApi.deleteAvailability(item.id);
    await load();
  };

  return (
    <div className={memberId ? "space-y-4" : "flex-1 space-y-5 p-4 md:p-6"}>
      {!memberId ? <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><Header title="Disponibilità" description="Ferie, assenze, remoto e focus time del team." />{canManageTeamOps() ? <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Nuova disponibilità</Button> : null}</div> : canManageTeamOps() ? <Button size="sm" onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Aggiungi disponibilità</Button> : null}
      {!memberId ? (
        <div className="grid gap-3 lg:grid-cols-5">
          <SelectField labelText="Membro" value={memberFilter} onChange={setMemberFilter} items={[{ value: "__all__", label: "Tutti i membri" }, ...members.map((m) => ({ value: m.id, label: m.display_name }))]} />
          <SelectField labelText="Tipo" value={typeFilter} onChange={setTypeFilter} items={[{ value: "__all__", label: "Tutti i tipi" }, ...TYPES.map((v) => ({ value: v, label: label(AVAILABILITY_LABELS, v) }))]} />
          <SelectField labelText="Stato" value={statusFilter} onChange={setStatusFilter} items={[{ value: "__all__", label: "Tutti gli stati" }, ...STATUSES.map((v) => ({ value: v, label: label(STATUS_LABELS, v) }))]} />
          <div className="grid gap-2"><Label>Da</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="grid gap-2"><Label>A</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        </div>
      ) : null}
      <ErrorBox error={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty>Nessuna disponibilità registrata.</Empty> : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title || label(AVAILABILITY_LABELS, item.type)}</p>
                    <Badge variant="outline" className={availabilityBadgeClass(item.type)}>{label(AVAILABILITY_LABELS, item.type)}</Badge>
                    <Badge variant="outline">{label(STATUS_LABELS, item.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.display_name || item.email || "Membro"} · {formatDateTime(item.starts_at)} → {formatDateTime(item.ends_at)}</p>
                </div>
                {canManageTeamOps() ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(item)}><Edit2 className="mr-2 h-4 w-4" /> Modifica</Button><Button size="sm" variant="outline" onClick={() => remove(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Modifica disponibilità" : "Nuova disponibilità"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            {!memberId ? <SelectField labelText="Membro" value={form.team_member_id || "__none__"} onChange={(v) => setForm((p) => ({ ...p, team_member_id: v === "__none__" ? "" : v }))} items={[{ value: "__none__", label: "Seleziona membro" }, ...members.map((m) => ({ value: m.id, label: m.display_name }))]} /> : null}
            <SelectField labelText="Tipo" value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v }))} items={TYPES.map((v) => ({ value: v, label: label(AVAILABILITY_LABELS, v) }))} />
            <div className="grid gap-2"><Label>Titolo</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Inizio</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fine</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))} /></div>
            <SelectField labelText="Stato" value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} items={STATUSES.map((v) => ({ value: v, label: label(STATUS_LABELS, v) }))} />
            <div className="grid gap-2"><Label>Note</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <Button onClick={save} disabled={!form.team_member_id || !form.starts_at || !form.ends_at}>{editingId ? "Aggiorna" : "Salva"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function SelectField({ labelText, value, onChange, items }: { labelText: string; value: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }> }) {
  return <div className="grid gap-2"><Label>{labelText}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}
