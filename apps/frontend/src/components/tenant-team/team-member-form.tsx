"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TeamMember, TeamOptions } from "@/lib/tenant-team-api";
import {
  AVAILABILITY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  OPERATIONAL_ROLE_LABELS,
  STATUS_LABELS,
  TENANT_ROLE_LABELS,
  canViewTeamCosts,
  label,
} from "./team-utils";

type FormState = Partial<TeamMember> & { skills_text?: string };

export function TeamMemberForm({
  member,
  options,
  onSubmit,
  submitting,
}: {
  member?: TeamMember | null;
  options?: TeamOptions | null;
  onSubmit: (body: Partial<TeamMember>) => Promise<void> | void;
  submitting?: boolean;
}) {
  const canCosts = canViewTeamCosts();
  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    setForm({
      email: member?.email || "",
      display_name: member?.display_name || "",
      first_name: member?.first_name || "",
      last_name: member?.last_name || "",
      phone: member?.phone || "",
      tenant_role: member?.tenant_role || "user",
      job_title: member?.job_title || "",
      department: member?.department || "",
      operational_role: member?.operational_role || "generic",
      employment_type: member?.employment_type || "employee",
      status: member?.status || "active",
      availability_status: member?.availability_status || "available",
      capacity_hours_per_week: member?.capacity_hours_per_week || "",
      skills_text: (member?.skills || []).join(", "),
      hourly_rate_cents: member?.hourly_rate_cents || null,
      daily_rate_cents: member?.daily_rate_cents || null,
      currency: member?.currency || "EUR",
      start_date: member?.start_date ? String(member.start_date).slice(0, 10) : "",
      end_date: member?.end_date ? String(member.end_date).slice(0, 10) : "",
      notes: member?.notes || "",
      private_notes: canCosts ? member?.private_notes || "" : undefined,
    });
  }, [member, canCosts]);

  const set = (key: keyof FormState, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const tenantRoles = options?.tenantRoles || ["owner", "admin", "manager", "editor", "user", "viewer"];
  const operationalRoles = options?.operationalRoles || Object.keys(OPERATIONAL_ROLE_LABELS);
  const employmentTypes = options?.employmentTypes || Object.keys(EMPLOYMENT_TYPE_LABELS);
  const statuses = options?.memberStatuses || ["active", "inactive", "invited", "suspended", "archived"];
  const availabilityStatuses = options?.availabilityStatuses || ["available", "busy", "unavailable", "vacation", "sick", "external_limited"];

  const submit = async () => {
    const body: Partial<TeamMember> = {
      ...form,
      skills: String(form.skills_text || "").split(",").map((item) => item.trim()).filter(Boolean),
      capacity_hours_per_week: form.capacity_hours_per_week === "" ? null : form.capacity_hours_per_week,
      hourly_rate_cents: canCosts && String(form.hourly_rate_cents ?? "") !== "" ? Number(form.hourly_rate_cents) : undefined,
      daily_rate_cents: canCosts && String(form.daily_rate_cents ?? "") !== "" ? Number(form.daily_rate_cents) : undefined,
      private_notes: canCosts ? form.private_notes : undefined,
    };
    delete (body as FormState).skills_text;
    await onSubmit(body);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label>Email</Label>
        <Input value={form.email || ""} onChange={(e) => set("email", e.target.value)} disabled={Boolean(member)} />
      </div>
      <div className="grid gap-2">
        <Label>Nome visualizzato</Label>
        <Input value={form.display_name || ""} onChange={(e) => set("display_name", e.target.value)} />
      </div>
      <div className="grid gap-2"><Label>Nome</Label><Input value={form.first_name || ""} onChange={(e) => set("first_name", e.target.value)} /></div>
      <div className="grid gap-2"><Label>Cognome</Label><Input value={form.last_name || ""} onChange={(e) => set("last_name", e.target.value)} /></div>
      <div className="grid gap-2"><Label>Telefono</Label><Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
      <div className="grid gap-2"><Label>Job title</Label><Input value={form.job_title || ""} onChange={(e) => set("job_title", e.target.value)} /></div>
      <SelectField labelText="Ruolo tenant" value={form.tenant_role || "user"} values={tenantRoles} labels={TENANT_ROLE_LABELS} onChange={(v) => set("tenant_role", v)} />
      <SelectField labelText="Ruolo operativo" value={form.operational_role || "generic"} values={operationalRoles} labels={OPERATIONAL_ROLE_LABELS} onChange={(v) => set("operational_role", v)} />
      <SelectField labelText="Rapporto" value={form.employment_type || "employee"} values={employmentTypes} labels={EMPLOYMENT_TYPE_LABELS} onChange={(v) => set("employment_type", v)} />
      <SelectField labelText="Stato" value={form.status || "active"} values={statuses} labels={STATUS_LABELS} onChange={(v) => set("status", v)} />
      <SelectField labelText="Disponibilità" value={form.availability_status || "available"} values={availabilityStatuses} labels={AVAILABILITY_LABELS} onChange={(v) => set("availability_status", v)} />
      <div className="grid gap-2"><Label>Capacity ore/settimana</Label><Input type="number" value={String(form.capacity_hours_per_week || "")} onChange={(e) => set("capacity_hours_per_week", e.target.value)} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Competenze libere</Label><Input value={form.skills_text || ""} onChange={(e) => set("skills_text", e.target.value)} placeholder="SEO, WordPress, UX..." /></div>
      {canCosts ? (
        <>
          <div className="grid gap-2"><Label>Tariffa oraria centesimi</Label><Input type="number" value={form.hourly_rate_cents ?? ""} onChange={(e) => set("hourly_rate_cents", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Tariffa giornaliera centesimi</Label><Input type="number" value={form.daily_rate_cents ?? ""} onChange={(e) => set("daily_rate_cents", e.target.value)} /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Note private</Label><Textarea value={form.private_notes || ""} onChange={(e) => set("private_notes", e.target.value)} /></div>
        </>
      ) : null}
      <div className="grid gap-2 md:col-span-2"><Label>Note</Label><Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
      <div className="md:col-span-2">
        <Button onClick={submit} disabled={submitting || !form.email || !form.display_name}>
          {member ? "Salva profilo" : "Crea membro"}
        </Button>
      </div>
    </div>
  );
}

function SelectField({ labelText, value, values, labels, onChange }: { labelText: string; value: string; values: string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{labelText}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {values.map((item) => <SelectItem key={item} value={item}>{label(labels, item)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
