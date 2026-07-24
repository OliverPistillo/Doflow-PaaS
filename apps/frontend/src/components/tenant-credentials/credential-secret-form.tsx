"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CredentialSecretPayload } from "@/lib/tenant-credentials-types";
import { cleanSecretPayload } from "./credentials-utils";

const EMPTY_SECRET: CredentialSecretPayload = {
  username: "",
  password: "",
  apiKey: "",
  secretKey: "",
  token: "",
  recoveryCodes: [],
  privateNotes: "",
  customFields: [],
};

export function CredentialSecretForm({
  value,
  onChange,
  disabled,
}: {
  value?: CredentialSecretPayload;
  onChange: (value: CredentialSecretPayload) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<CredentialSecretPayload>(EMPTY_SECRET);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setForm({ ...EMPTY_SECRET, ...value });
  }, [value]);

  const set = (key: keyof CredentialSecretPayload, next: unknown) => {
    const updated = { ...form, [key]: next };
    setForm(updated);
    onChange(cleanSecretPayload(updated));
  };

  const secretInput = (key: keyof CredentialSecretPayload, labelText: string, multiline = false) => (
    <div className="grid gap-2">
      <Label htmlFor={`secret-${key}`}>{labelText}</Label>
      <div className="flex gap-2">
        {multiline ? (
          <Textarea
            id={`secret-${key}`}
            autoComplete="off"
            value={String(form[key] || "")}
            onChange={(event) => set(key, event.target.value)}
            disabled={disabled}
            className={visible[String(key)] ? "" : "font-mono blur-[2px] focus:blur-0"}
          />
        ) : (
          <Input
            id={`secret-${key}`}
            type={visible[String(key)] ? "text" : "password"}
            autoComplete="new-password"
            value={String(form[key] || "")}
            onChange={(event) => set(key, event.target.value)}
            disabled={disabled}
          />
        )}
        <Button type="button" variant="outline" size="icon" aria-label={visible[String(key)] ? `Nascondi ${labelText}` : `Mostra ${labelText}`} onClick={() => setVisible((prev) => ({ ...prev, [String(key)]: !prev[String(key)] }))}>
          {visible[String(key)] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  const recoveryText = (form.recoveryCodes || []).join("\n");
  const customFields = form.customFields || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {secretInput("username", "Username")}
        {secretInput("password", "Password")}
        {secretInput("apiKey", "API key")}
        {secretInput("secretKey", "Secret key")}
        {secretInput("token", "Token")}
        {secretInput("privateNotes", "Note private", true)}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="recoveryCodes">Recovery codes, uno per riga, massimo 50</Label>
        <Textarea
          id="recoveryCodes"
          autoComplete="off"
          value={recoveryText}
          onChange={(event) => set("recoveryCodes", event.target.value.split("\n").slice(0, 50))}
          disabled={disabled}
          className="font-mono"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Campi custom</Label>
          <Button type="button" variant="outline" size="sm" disabled={disabled || customFields.length >= 50} onClick={() => set("customFields", [...customFields, { label: "", value: "", secret: true }])}>
            <Plus className="mr-2 h-4 w-4" /> Aggiungi campo
          </Button>
        </div>
        {customFields.map((field, index) => (
          <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <Input aria-label="Label campo custom" placeholder="Label" value={field.label} onChange={(event) => {
              const next = [...customFields];
              next[index] = { ...field, label: event.target.value };
              set("customFields", next);
            }} disabled={disabled} />
            <Input aria-label="Valore campo custom" type={visible[`custom-${index}`] ? "text" : "password"} placeholder="Valore" value={field.value} autoComplete="new-password" onChange={(event) => {
              const next = [...customFields];
              next[index] = { ...field, value: event.target.value };
              set("customFields", next);
            }} disabled={disabled} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={Boolean(field.secret)} onCheckedChange={(checked) => {
                const next = [...customFields];
                next[index] = { ...field, secret: Boolean(checked) };
                set("customFields", next);
              }} disabled={disabled} />
              Sensibile
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="icon" aria-label="Mostra o nascondi campo custom" onClick={() => setVisible((prev) => ({ ...prev, [`custom-${index}`]: !prev[`custom-${index}`] }))}>{visible[`custom-${index}`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              <Button type="button" variant="outline" size="icon" aria-label="Rimuovi campo custom" onClick={() => set("customFields", customFields.filter((_, current) => current !== index))} disabled={disabled}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

