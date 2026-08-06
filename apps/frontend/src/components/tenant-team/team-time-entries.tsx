"use client";

import { useEffect, useState } from "react";
import { Check, Edit2, Plus, Send, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { teamApi, type TeamMember, type TimeEntry } from "@/lib/tenant-team-api";
import { ACTIVITY_TYPE_LABELS, STATUS_LABELS, canManageTeam, canManageTeamOps, formatDate, formatMinutes, label } from "./team-utils";
import { Empty, ErrorBox, Header, Loading } from "./team-workload";

const ACTIVITY_TYPES = ["design", "development", "seo", "copywriting", "meeting", "project_management", "support", "admin", "research", "qa", "work"];
const STATUSES = ["draft", "submitted", "approved", "rejected"];

export function TeamTimeEntriesPage({ memberId }: { memberId?: string }) {
  const { toast } = useToast();
  const { ConfirmDialog, confirm } = useConfirm();
  const [items, setItems] = useState<TimeEntry[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("__all__");
  const [memberFilter, setMemberFilter] = useState("__all__");
  const [activityFilter, setActivityFilter] = useState("__all__");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [form, setForm] = useState({ team_member_id: memberId || "", entry_date: new Date().toISOString().slice(0, 10), duration_minutes: "", activity_type: "work", description: "", project_id: "", task_id: "", is_billable: false });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [timeData, memberData] = await Promise.all([
        teamApi.timeEntries({
          team_member_id: memberId || memberFilter,
          status,
          activity_type: activityFilter,
          date_from: dateFrom,
          date_to: dateTo,
          limit: 100,
        }),
        teamApi.members({ limit: 100 }).catch(() => ({ items: [] })),
      ]);
      setItems(timeData.items || []);
      setMembers(memberData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore ore lavorate");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [memberId, memberFilter, status, activityFilter, dateFrom, dateTo]);

  const save = async () => {
    try {
      const payload = { ...form, duration_minutes: Number(form.duration_minutes || 0), is_billable: Boolean(form.is_billable) };
      if (editingId) await teamApi.updateTimeEntry(editingId, payload);
      else await teamApi.createTimeEntry(payload);
      setOpen(false);
      setEditingId(null);
      await load();
    } catch (err) {
      toast({ title: "Time entry non salvata", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const startCreate = () => {
    setEditingId(null);
    setForm({ team_member_id: memberId || "", entry_date: new Date().toISOString().slice(0, 10), duration_minutes: "", activity_type: "work", description: "", project_id: "", task_id: "", is_billable: false });
    setOpen(true);
  };
  const startEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setForm({
      team_member_id: entry.team_member_id || memberId || "",
      entry_date: entry.entry_date || new Date().toISOString().slice(0, 10),
      duration_minutes: String(entry.duration_minutes ?? 0),
      activity_type: entry.activity_type || "work",
      description: entry.description || "",
      project_id: entry.project_id || "",
      task_id: entry.task_id || "",
      is_billable: Boolean(entry.is_billable),
    });
    setOpen(true);
  };
  const action = async (entry: TimeEntry, kind: "submit" | "approve" | "reject" | "delete") => {
    try {
      if (kind === "submit") await teamApi.submitTimeEntry(entry.id);
      if (kind === "approve") await teamApi.approveTimeEntry(entry.id);
      if (kind === "reject") {
        const reason = window.prompt("Motivo del rifiuto");
        if (!reason) return;
        await teamApi.rejectTimeEntry(entry.id, reason);
      }
      if (kind === "delete") {
        const ok = await confirm({
          title: "Eliminare questa time entry?",
          confirmLabel: "Elimina",
          cancelLabel: "Annulla",
          variant: "destructive",
        });
        if (!ok) return;
        await teamApi.deleteTimeEntry(entry.id);
      }
      await load();
    } catch (err) {
      toast({ title: "Operazione non completata", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };

  return (
    <div className={memberId ? "space-y-4" : "flex-1 space-y-5 p-4 md:p-6"}>
      <ConfirmDialog />
      {!memberId ? <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><Header title="Ore lavorate" description="Timesheet reale per progetto, task e attività." /><Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Nuova time entry</Button></div> : <Button size="sm" onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Aggiungi time entry</Button>}
      {!memberId ? (
        <div className="grid gap-3 lg:grid-cols-5">
          <SelectField labelText="Membro" value={memberFilter} onChange={setMemberFilter} items={[{ value: "__all__", label: "Tutti i membri" }, ...members.map((m) => ({ value: m.id, label: m.display_name }))]} />
          <SelectField labelText="Stato" value={status} onChange={setStatus} items={[{ value: "__all__", label: "Tutti gli stati" }, ...STATUSES.map((s) => ({ value: s, label: label(STATUS_LABELS, s) }))]} />
          <SelectField labelText="Attività" value={activityFilter} onChange={setActivityFilter} items={[{ value: "__all__", label: "Tutte le attività" }, ...ACTIVITY_TYPES.map((s) => ({ value: s, label: label(ACTIVITY_TYPE_LABELS, s) }))]} />
          <div className="grid gap-2"><Label>Da</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="grid gap-2"><Label>A</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        </div>
      ) : null}
      <ErrorBox error={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty>Nessuna ora lavorata registrata.</Empty> : (
        <div className="grid gap-3">
          {items.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{entry.display_name || entry.email || "Membro"}</p>
                    <Badge variant="outline">{label(ACTIVITY_TYPE_LABELS, entry.activity_type)}</Badge>
                    <Badge variant="outline">{label(STATUS_LABELS, entry.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(entry.entry_date)} · {formatMinutes(entry.duration_minutes)} · {entry.project_name || "Nessun progetto"}{entry.task_title ? ` · ${entry.task_title}` : ""}</p>
                  {entry.description ? <p className="mt-1 text-sm">{entry.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.status === "draft" ? <Button size="sm" variant="outline" onClick={() => action(entry, "submit")}><Send className="mr-2 h-4 w-4" /> Invia</Button> : null}
                  {canManageTeam() && entry.status === "submitted" ? <><Button size="sm" variant="outline" onClick={() => action(entry, "approve")}><Check className="mr-2 h-4 w-4" /> Approva</Button><Button size="sm" variant="outline" onClick={() => action(entry, "reject")}><X className="mr-2 h-4 w-4" /> Rifiuta</Button></> : null}
                  {canManageTeamOps() || entry.status === "draft" ? <><Button size="sm" variant="outline" onClick={() => startEdit(entry)}><Edit2 className="mr-2 h-4 w-4" /> Modifica</Button><Button size="sm" variant="outline" onClick={() => action(entry, "delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button></> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Modifica time entry" : "Nuova time entry"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            {!memberId ? <SelectField labelText="Membro" value={form.team_member_id || "__none__"} onChange={(v) => setForm((p) => ({ ...p, team_member_id: v === "__none__" ? "" : v }))} items={[{ value: "__none__", label: "Seleziona membro" }, ...members.map((m) => ({ value: m.id, label: m.display_name }))]} /> : null}
            <div className="grid gap-2"><Label>Data</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm((p) => ({ ...p, entry_date: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Durata minuti</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))} /></div>
            <SelectField labelText="Attività" value={form.activity_type} onChange={(v) => setForm((p) => ({ ...p, activity_type: v }))} items={ACTIVITY_TYPES.map((v) => ({ value: v, label: label(ACTIVITY_TYPE_LABELS, v) }))} />
            <div className="grid gap-2"><Label>Project ID opzionale</Label><Input value={form.project_id} onChange={(e) => setForm((p) => ({ ...p, project_id: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Task ID opzionale</Label><Input value={form.task_id} onChange={(e) => setForm((p) => ({ ...p, task_id: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <Button onClick={save} disabled={!form.team_member_id || !form.entry_date}>{editingId ? "Aggiorna" : "Salva"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SelectField({ labelText, value, onChange, items }: { labelText: string; value: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }> }) {
  return <div className="grid gap-2"><Label>{labelText}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}
