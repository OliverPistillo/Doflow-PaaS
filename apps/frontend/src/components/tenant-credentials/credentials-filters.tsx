"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CredentialsOptions } from "@/lib/tenant-credentials-types";
import { ACCESS_SCOPE_LABELS, ENVIRONMENT_LABELS, KIND_LABELS, STATUS_LABELS, label } from "./credentials-utils";
import { SelectField } from "./credentials-shared";

export type CredentialFilters = Record<string, string>;

const SORTS = ["updated_at", "title", "expires_at", "renewal_at", "rotation_due_at", "created_at"];

function options(values: string[] | undefined, labels: Record<string, string>) {
  return (values && values.length ? values : Object.keys(labels)).map((value) => ({ value, label: label(labels, value) }));
}

export function CredentialsFilters({ filters, options: backendOptions, onChange }: { filters: CredentialFilters; options?: CredentialsOptions | null; onChange: (next: CredentialFilters) => void }) {
  const set = (key: string, value: string) => onChange({ ...filters, [key]: value });
  return (
    <Card>
      <CardContent className="grid gap-3 pt-6 md:grid-cols-4 xl:grid-cols-6">
        <Input placeholder="Cerca titolo, provider, dominio" value={filters.search || ""} onChange={(event) => set("search", event.target.value)} />
        <SelectField value={filters.kind} placeholder="Tipo" options={options(backendOptions?.kinds, KIND_LABELS)} onChange={(value) => set("kind", value)} />
        <SelectField value={filters.environment} placeholder="Ambiente" options={options(backendOptions?.environments, ENVIRONMENT_LABELS)} onChange={(value) => set("environment", value)} />
        <SelectField value={filters.status} placeholder="Stato" options={options(backendOptions?.statuses, STATUS_LABELS)} onChange={(value) => set("status", value)} />
        <SelectField value={filters.access_scope} placeholder="Accesso" options={options(backendOptions?.access_scopes, ACCESS_SCOPE_LABELS)} onChange={(value) => set("access_scope", value)} />
        <SelectField value={filters.sort || "updated_at"} placeholder="Ordina" options={SORTS.map((value) => ({ value, label: value }))} onChange={(value) => set("sort", value || "updated_at")} />
        <SelectField value={filters.dir || "desc"} placeholder="Direzione" options={[{ value: "desc", label: "Discendente" }, { value: "asc", label: "Ascendente" }]} onChange={(value) => set("dir", value || "desc")} />
        <Button variant="outline" onClick={() => onChange({})}>Reset filtri</Button>
      </CardContent>
    </Card>
  );
}

