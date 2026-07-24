"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Search, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  commercialApi,
  type CommercialActivity,
  type CommercialCompany,
  type CommercialContact,
  type CommercialOpportunity,
} from "@/lib/tenant-commercial-api";
import { ClientDetailPanel } from "./client-detail-panel";
import type { CommercialClientRow } from "./commercial-client-types";
import { ClientsTable } from "./clients-table";
import { commercialMoney } from "./commercial-utils";
import { CommercialKpiCard, CommercialPageHeader } from "./commercial-ui";

const statusOptions = [
  { value: "prospect", label: "Potenziale" },
  { value: "active_client", label: "Cliente attivo" },
  { value: "former_client", label: "Ex cliente" },
  { value: "partner", label: "Partner" },
  { value: "dormant", label: "Da ricontattare" },
];

const emptyCompany: Partial<CommercialCompany> = {
  name: "",
  legal_name: "",
  vat_number: "",
  fiscal_code: "",
  email: "",
  phone: "",
  website: "",
  industry: "",
  size: "",
  status: "prospect",
  source: "",
  address: "",
  city: "",
  province: "",
  country: "IT",
  notes: "",
};

export function CommercialClients() {
  const [companies, setCompanies] = useState<CommercialCompany[]>([]);
  const [contacts, setContacts] = useState<CommercialContact[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [activities, setActivities] = useState<CommercialActivity[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [service, setService] = useState("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<Partial<CommercialCompany>>(emptyCompany);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      commercialApi.companies({ limit: 100 }),
      commercialApi.contacts({ limit: 100 }),
      commercialApi.opportunities({ limit: 100 }),
      commercialApi.activities({ limit: 100 }),
    ]);
    if (results[0].status === "fulfilled") setCompanies(results[0].value.items || []);
    if (results[1].status === "fulfilled") setContacts(results[1].value.items || []);
    if (results[2].status === "fulfilled") setOpportunities(results[2].value.items || []);
    if (results[3].status === "fulfilled") setActivities(results[3].value.items || []);
    if (results.some((result) => result.status === "rejected")) {
      setError("Alcuni dettagli cliente non sono disponibili in questo momento.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo<CommercialClientRow[]>(() => companies.map((company) => {
    const companyContacts = contacts.filter((contact) => contact.company_id === company.id);
    const contact = companyContacts.find((item) => item.is_primary) || companyContacts[0];
    const companyOpportunities = opportunities.filter((item) => item.company_id === company.id);
    const activeOpportunity = companyOpportunities.find((item) => !["accepted", "lost", "paused"].includes(item.stage));
    const companyActivities = activities
      .filter((item) => item.company_id === company.id)
      .sort((a, b) => new Date(b.completed_at || b.updated_at || 0).getTime() - new Date(a.completed_at || a.updated_at || 0).getTime());
    const needsFollowUp = company.status === "dormant" || companyOpportunities.some((item) => {
      if (!item.next_action_at || ["accepted", "lost", "paused"].includes(item.stage)) return false;
      return new Date(item.next_action_at).getTime() <= Date.now();
    });
    return {
      company,
      contact,
      opportunities: companyOpportunities,
      activeOpportunity,
      lastActivity: companyActivities[0],
      value: companyOpportunities.reduce((sum, item) => sum + Number(item.value_estimate || 0), 0),
      service: activeOpportunity?.service_type || companyOpportunities[0]?.service_type || undefined,
      needsFollowUp,
    };
  }), [activities, companies, contacts, opportunities]);

  const services = useMemo(
    () => Array.from(new Set(rows.map((row) => row.service).filter((value): value is string => Boolean(value)))).sort(),
    [rows],
  );

  const filteredRows = rows.filter((row) => {
    const needle = search.trim().toLowerCase();
    const haystack = [
      row.company.name,
      row.company.email,
      row.contact?.first_name,
      row.contact?.last_name,
      row.contact?.email,
    ].filter(Boolean).join(" ").toLowerCase();
    return (!needle || haystack.includes(needle))
      && (status === "all" || row.company.status === status)
      && (service === "all" || row.service === service);
  });

  const selected = rows.find((row) => row.company.id === selectedId);
  const activeClients = rows.filter((row) => row.company.status === "active_client").length;
  const followUps = rows.filter((row) => row.needsFollowUp).length;
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);

  const openCreate = () => {
    setEditingId(undefined);
    setForm(emptyCompany);
    setDialogOpen(true);
  };

  const openEdit = (row: CommercialClientRow) => {
    setEditingId(row.company.id);
    setForm({ ...row.company });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!String(form.name || "").trim()) return;
    setSaving(true);
    setError(null);
    const payload = Object.fromEntries(
      Object.entries(form).filter(([key, value]) => key !== "id" && key !== "created_at" && key !== "updated_at" && value !== ""),
    );
    try {
      if (editingId) await commercialApi.updateCompany(editingId, payload);
      else await commercialApi.createCompany(payload);
      setDialogOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Salvataggio cliente non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: CommercialClientRow) => {
    if (!window.confirm(`Eliminare ${row.company.name}?`)) return;
    try {
      await commercialApi.deleteCompany(row.company.id);
      if (selectedId === row.company.id) setSelectedId(undefined);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Eliminazione cliente non riuscita.");
    }
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <CommercialPageHeader
        title="Clienti"
        description="Persone, aziende e storico commerciale in un unico posto."
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-12 rounded-xl border-slate-200 bg-white pl-11" placeholder="Cerca cliente, referente o email..." />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white lg:w-40"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white lg:w-44"><SelectValue placeholder="Servizio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i servizi</SelectItem>
            {services.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="h-12 rounded-xl bg-indigo-600 px-5 text-white hover:bg-indigo-700">Nuovo cliente</Button>
      </div>

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <CommercialKpiCard label="Clienti attivi" value={loading ? "…" : activeClients} icon={Users} tone="violet" />
        <CommercialKpiCard label="Da ricontattare" value={loading ? "…" : followUps} icon={Clock3} tone="orange" />
        <CommercialKpiCard label="Valore clienti" value={loading ? "…" : commercialMoney(totalValue)} icon={TrendingUp} tone="green" />
      </div>

      <div className={selected ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" : ""}>
        <ClientsTable rows={filteredRows} selectedId={selectedId} onSelect={(row) => setSelectedId(row.company.id)} onEdit={openEdit} onDelete={remove} />
        {selected ? <ClientDetailPanel row={selected} onClose={() => setSelectedId(undefined)} onOpen={() => openEdit(selected)} /> : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifica cliente" : "Nuovo cliente"}</DialogTitle>
            <DialogDescription>I dati vengono salvati nell’anagrafica aziende del tenant.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2"><Label>Nome *</Label><Input value={form.name || ""} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Ragione sociale</Label><Input value={form.legal_name || ""} onChange={(event) => setForm((prev) => ({ ...prev, legal_name: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Stato</Label><Select value={form.status || "prospect"} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Partita IVA</Label><Input value={form.vat_number || ""} onChange={(event) => setForm((prev) => ({ ...prev, vat_number: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Codice fiscale</Label><Input value={form.fiscal_code || ""} onChange={(event) => setForm((prev) => ({ ...prev, fiscal_code: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Telefono</Label><Input value={form.phone || ""} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Sito web</Label><Input value={form.website || ""} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Settore</Label><Input value={form.industry || ""} onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Dimensione</Label><Input value={form.size || ""} onChange={(event) => setForm((prev) => ({ ...prev, size: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fonte</Label><Input value={form.source || ""} onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label>Indirizzo</Label><Input value={form.address || ""} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Città</Label><Input value={form.city || ""} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Provincia</Label><Input value={form.province || ""} onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Paese</Label><Input value={form.country || ""} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label>Note</Label><Textarea value={form.notes || ""} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving || !String(form.name || "").trim()}>{saving ? "Salvataggio..." : "Salva cliente"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
