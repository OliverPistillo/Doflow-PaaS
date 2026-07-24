"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CredentialItem, CreateCredentialInput, CredentialsOptions, CredentialSecretPayload } from "@/lib/tenant-credentials-types";
import { ACCESS_SCOPE_LABELS, ENVIRONMENT_LABELS, KIND_LABELS, STATUS_LABELS, label, parseJsonObject, sanitizeMetadataText, toDateInput } from "./credentials-utils";
import { CredentialSecretForm } from "./credential-secret-form";

type FormState = Partial<CredentialItem> & { metadata_text?: string };

export function CredentialForm({
  credential,
  options,
  includeSecret,
  submitting,
  onSubmit,
}: {
  credential?: CredentialItem | null;
  options?: CredentialsOptions | null;
  includeSecret?: boolean;
  submitting?: boolean;
  onSubmit: (body: CreateCredentialInput) => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState>({});
  const [secret, setSecret] = useState<CredentialSecretPayload>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      title: credential?.title || "",
      kind: credential?.kind || "other",
      provider: credential?.provider || "",
      account_label: credential?.account_label || "",
      login_url: credential?.login_url || "",
      domain_name: credential?.domain_name || "",
      environment: credential?.environment || "production",
      status: credential?.status || "active",
      access_scope: credential?.access_scope || "restricted",
      owner_user_id: credential?.owner_user_id || "",
      expires_at: toDateInput(credential?.expires_at),
      renewal_at: toDateInput(credential?.renewal_at),
      rotation_due_at: toDateInput(credential?.rotation_due_at),
      auto_renew: Boolean(credential?.auto_renew),
      description: credential?.description || "",
      metadata_text: JSON.stringify(credential?.metadata || {}, null, 2),
    });
    setSecret({});
  }, [credential]);

  const set = (key: keyof FormState, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const kinds = options?.kinds?.length ? options.kinds : Object.keys(KIND_LABELS);
  const environments = options?.environments?.length ? options.environments : Object.keys(ENVIRONMENT_LABELS);
  const statuses = options?.statuses?.length ? options.statuses : Object.keys(STATUS_LABELS);
  const scopes = options?.access_scopes?.length ? options.access_scopes : Object.keys(ACCESS_SCOPE_LABELS);

  const submit = async () => {
    setError(null);
    try {
      if (!String(form.title || "").trim()) throw new Error("Il titolo è obbligatorio.");
      if (form.login_url && !/^https?:\/\//i.test(String(form.login_url))) throw new Error("Login URL deve essere HTTP o HTTPS.");
      const body: CreateCredentialInput = {
        title: String(form.title).trim(),
        kind: String(form.kind || "other"),
        provider: sanitizeMetadataText(String(form.provider || "")),
        account_label: sanitizeMetadataText(String(form.account_label || "")),
        login_url: sanitizeMetadataText(String(form.login_url || "")),
        domain_name: sanitizeMetadataText(String(form.domain_name || "")),
        environment: String(form.environment || "production"),
        status: String(form.status || "active"),
        access_scope: String(form.access_scope || "restricted"),
        owner_user_id: sanitizeMetadataText(String(form.owner_user_id || "")),
        expires_at: sanitizeMetadataText(String(form.expires_at || "")),
        renewal_at: sanitizeMetadataText(String(form.renewal_at || "")),
        rotation_due_at: sanitizeMetadataText(String(form.rotation_due_at || "")),
        auto_renew: Boolean(form.auto_renew),
        description: sanitizeMetadataText(String(form.description || "")),
        metadata: parseJsonObject(form.metadata_text || "{}", "Metadata"),
      };
      if (!body.owner_user_id) delete body.owner_user_id;
      if (includeSecret) body.secret = secret;
      await onSubmit(body);
      setSecret({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore validazione form");
    }
  };

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field labelText="Titolo" value={form.title || ""} onChange={(value) => set("title", value)} required />
        <SelectBox labelText="Tipo" value={String(form.kind || "other")} values={kinds} labels={KIND_LABELS} onChange={(value) => set("kind", value)} />
        <Field labelText="Provider" value={form.provider || ""} onChange={(value) => set("provider", value)} />
        <Field labelText="Account label" value={form.account_label || ""} onChange={(value) => set("account_label", value)} />
        <Field labelText="Login URL" value={form.login_url || ""} onChange={(value) => set("login_url", value)} placeholder="https://..." />
        <Field labelText="Dominio" value={form.domain_name || ""} onChange={(value) => set("domain_name", value)} />
        <SelectBox labelText="Ambiente" value={String(form.environment || "production")} values={environments} labels={ENVIRONMENT_LABELS} onChange={(value) => set("environment", value)} />
        <SelectBox labelText="Stato" value={String(form.status || "active")} values={statuses} labels={STATUS_LABELS} onChange={(value) => set("status", value)} />
        <SelectBox labelText="Accesso" value={String(form.access_scope || "restricted")} values={scopes} labels={ACCESS_SCOPE_LABELS} onChange={(value) => set("access_scope", value)} />
        <Field labelText="Owner user ID" value={form.owner_user_id || ""} onChange={(value) => set("owner_user_id", value)} />
        <Field labelText="Scadenza" type="date" value={form.expires_at || ""} onChange={(value) => set("expires_at", value)} />
        <Field labelText="Rinnovo" type="date" value={form.renewal_at || ""} onChange={(value) => set("renewal_at", value)} />
        <Field labelText="Rotazione richiesta entro" type="date" value={form.rotation_due_at || ""} onChange={(value) => set("rotation_due_at", value)} />
        <label className="flex items-center gap-2 pt-8 text-sm text-muted-foreground">
          <Checkbox checked={Boolean(form.auto_renew)} onCheckedChange={(checked) => set("auto_renew", Boolean(checked))} />
          Rinnovo automatico
        </label>
        <div className="grid gap-2 md:col-span-2">
          <Label>Descrizione</Label>
          <Textarea value={form.description || ""} onChange={(event) => set("description", event.target.value)} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Metadata JSON non sensibili</Label>
          <Textarea value={form.metadata_text || "{}"} onChange={(event) => set("metadata_text", event.target.value)} />
          <p className="text-xs text-muted-foreground">Non inserire username, password, token, API key o note private nei metadata.</p>
        </div>
      </div>
      {includeSecret ? (
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Primo segreto opzionale</h2>
          <p className="mb-4 text-sm text-muted-foreground">I campi restano locali al form e non vengono precompilati né salvati in storage.</p>
          <CredentialSecretForm value={secret} onChange={setSecret} disabled={submitting} />
        </div>
      ) : null}
      <Button onClick={submit} disabled={submitting}>{credential ? "Salva metadati" : "Crea credenziale"}</Button>
    </div>
  );
}

function Field({ labelText, value, onChange, type = "text", required, placeholder }: { labelText: string; value: string | number | boolean | null | undefined; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="grid gap-2">
      <Label>{labelText}{required ? " *" : ""}</Label>
      <Input type={type} value={String(value || "")} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectBox({ labelText, value, values, labels, onChange }: { labelText: string; value: string; values: string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{labelText}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{label(labels, item)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

