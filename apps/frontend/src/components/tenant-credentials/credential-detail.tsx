"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Download, KeyRound, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import type { CredentialItem, CredentialsOptions } from "@/lib/tenant-credentials-types";
import { CredentialAudit } from "./credential-audit";
import { CredentialForm } from "./credential-form";
import { CredentialLinks } from "./credential-links";
import { CredentialMetadata } from "./credential-metadata";
import { CredentialPermissions } from "./credential-permissions";
import { CredentialReplaceSecretDialog } from "./credential-replace-secret-dialog";
import { CredentialRevealDialog } from "./credential-reveal-dialog";
import { CredentialRotateDialog } from "./credential-rotate-dialog";
import { CredentialRotations } from "./credential-rotations";
import { CredentialsError, CredentialsHeader, CredentialsLoading } from "./credentials-shared";
import { assertMetadataOnlyExport, canManageCredentials, downloadJson, label, KIND_LABELS, ENVIRONMENT_LABELS, STATUS_LABELS, normalizeError } from "./credentials-utils";

export function CredentialNewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [options, setOptions] = useState<CredentialsOptions | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    credentialsApi.options().then(setOptions).catch(() => undefined);
  }, []);

  const submit = async (body: Parameters<typeof credentialsApi.create>[0]) => {
    setSubmitting(true);
    try {
      const created = await credentialsApi.create(body);
      toast({ title: "Credenziale creata" });
      router.push(`/credentials/${created.id}`);
    } catch (err) {
      toast({ title: "Creazione non riuscita", description: normalizeError(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <CredentialsHeader title="Nuova credenziale" description="Crea metadati e, opzionalmente, il primo segreto. Non inserire segreti nei metadata." />
      <Card>
        <CardHeader><CardTitle>Metadati e primo segreto</CardTitle><CardDescription>Il backend cifra il segreto; la UI non gestisce chiavi crittografiche.</CardDescription></CardHeader>
        <CardContent><CredentialForm options={options} includeSecret submitting={submitting} onSubmit={submit} /></CardContent>
      </Card>
    </div>
  );
}

export function CredentialDetailPage({ credentialId }: { credentialId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [credential, setCredential] = useState<CredentialItem | null>(null);
  const [options, setOptions] = useState<CredentialsOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const canManage = canManageCredentials();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [item, opts] = await Promise.all([
        credentialsApi.get(credentialId),
        credentialsApi.options().catch(() => null),
      ]);
      setCredential(item);
      setOptions(opts);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [credentialId]);

  const update = async (body: Parameters<typeof credentialsApi.create>[0]) => {
    setSaving(true);
    try {
      const updated = await credentialsApi.update(credentialId, body);
      setCredential(updated);
      toast({ title: "Metadati salvati" });
    } catch (err) {
      toast({ title: "Salvataggio non riuscito", description: normalizeError(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!window.confirm("La credenziale verrà archiviata e non apparirà più nelle liste operative.")) return;
    try {
      await credentialsApi.archive(credentialId);
      toast({ title: "Credenziale archiviata" });
      await load();
    } catch (err) {
      toast({ title: "Archive non riuscito", description: normalizeError(err), variant: "destructive" });
    }
  };

  const restore = async () => {
    try {
      await credentialsApi.restore(credentialId);
      toast({ title: "Credenziale ripristinata" });
      await load();
    } catch (err) {
      toast({ title: "Restore non riuscito", description: normalizeError(err), variant: "destructive" });
    }
  };

  const exportOne = async () => {
    try {
      const payload = await credentialsApi.exportOne(credentialId);
      assertMetadataOnlyExport(payload);
      downloadJson(`credential-${credentialId}-metadata.json`, payload);
    } catch (err) {
      toast({ title: "Export bloccato", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (loading) return <div className="flex-1 p-6"><CredentialsLoading /></div>;
  if (error || !credential) return <div className="flex-1 p-6"><CredentialsError message={error || "Credenziale non disponibile"} /></div>;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <CredentialsHeader title={credential.title} description={`${label(KIND_LABELS, credential.kind)} · ${credential.provider || "provider non indicato"} · ${label(ENVIRONMENT_LABELS, credential.environment)} · ${label(STATUS_LABELS, credential.status)}`}>
        <Button variant="outline" onClick={() => setRevealOpen(true)} disabled={!credential.has_secret}><KeyRound className="mr-2 h-4 w-4" /> Rivela</Button>
        <Button variant="outline" onClick={() => setReplaceOpen(true)}>{credential.has_secret ? "Sostituisci segreto" : "Configura segreto"}</Button>
        <Button variant="outline" onClick={() => setRotateOpen(true)}><RefreshCw className="mr-2 h-4 w-4" /> Ruota</Button>
        <Button variant="outline" onClick={exportOne}><Download className="mr-2 h-4 w-4" /> Export</Button>
        {credential.status === "archived" ? <Button variant="outline" onClick={restore}><RotateCcw className="mr-2 h-4 w-4" /> Ripristina</Button> : <Button variant="outline" onClick={archive}><Archive className="mr-2 h-4 w-4" /> Archivia</Button>}
        <Button asChild variant="outline"><Link href="/credentials">Torna lista</Link></Button>
      </CredentialsHeader>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="secret">Segreto</TabsTrigger>
          <TabsTrigger value="permissions">Permessi</TabsTrigger>
          <TabsTrigger value="links">Collegamenti</TabsTrigger>
          <TabsTrigger value="rotations">Rotazioni</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><CredentialMetadata credential={credential} /></TabsContent>
        <TabsContent value="secret">
          <Card>
            <CardHeader><CardTitle>Gestione segreto</CardTitle><CardDescription>Il dettaglio non mostra mai il segreto. Usa reveal solo per un motivo operativo esplicito.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => setRevealOpen(true)} disabled={!credential.has_secret}>Rivela segreto</Button>
              <Button variant="outline" onClick={() => setReplaceOpen(true)}>{credential.has_secret ? "Sostituisci segreto" : "Configura segreto"}</Button>
              <Button variant="outline" onClick={() => setRotateOpen(true)}>Ruota credenziale</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="permissions"><CredentialPermissions credentialId={credential.id} /></TabsContent>
        <TabsContent value="links"><CredentialLinks credentialId={credential.id} /></TabsContent>
        <TabsContent value="rotations"><CredentialRotations credentialId={credential.id} /></TabsContent>
        <TabsContent value="audit"><CredentialAudit credentialId={credential.id} /></TabsContent>
      </Tabs>

      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Modifica metadati</CardTitle><CardDescription>Non inserire username, password, token o API key nei metadata.</CardDescription></CardHeader>
          <CardContent><CredentialForm credential={credential} options={options} submitting={saving} onSubmit={update} /></CardContent>
        </Card>
      ) : null}

      <CredentialRevealDialog credential={credential} open={revealOpen} onOpenChange={setRevealOpen} />
      <CredentialReplaceSecretDialog credential={credential} open={replaceOpen} onOpenChange={setReplaceOpen} onDone={load} />
      <CredentialRotateDialog credential={credential} open={rotateOpen} onOpenChange={setRotateOpen} onDone={load} />
    </div>
  );
}
