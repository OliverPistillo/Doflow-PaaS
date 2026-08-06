"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit3, FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { getDoFlowUser } from "@/lib/jwt";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  listDocumentFolders,
  updateDocumentFolder,
  type DocumentFolder,
} from "@/lib/tenant-documents-api";
import { canViewFinanceDocuments, formatDateTime, visibilityClass, visibilityLabel } from "./document-utils";

type FolderForm = {
  id?: string;
  name: string;
  description: string;
  parent_id: string;
  visibility: string;
};

const EMPTY_FORM: FolderForm = { name: "", description: "", parent_id: "", visibility: "internal" };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Errore cartelle";
}

export function DocumentFoldersPage() {
  const { toast } = useToast();
  const { ConfirmDialog, confirm } = useConfirm();
  const canViewFinance = canViewFinanceDocuments(getDoFlowUser()?.role);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FolderForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDocumentFolders();
      setFolders(data.items || []);
    } catch (error) {
      toast({ title: "Cartelle non caricate", description: errorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (folder: DocumentFolder) => {
    setForm({
      id: folder.id,
      name: folder.name || "",
      description: folder.description || "",
      parent_id: folder.parent_id || "",
      visibility: folder.visibility || "internal",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const body = {
        name: form.name,
        description: form.description,
        parent_id: form.parent_id || null,
        visibility: form.visibility,
      };
      if (form.id) {
        await updateDocumentFolder(form.id, body);
        toast({ title: "Cartella aggiornata" });
      } else {
        await createDocumentFolder(body);
        toast({ title: "Cartella creata" });
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast({ title: "Operazione non completata", description: errorMessage(error), variant: "destructive" });
    }
  };

  const remove = async (folder: DocumentFolder) => {
    const ok = await confirm({
      title: "Eliminare la cartella?",
      description: `Stai per eliminare la cartella "${folder.name}". Questa operazione non può essere annullata.`,
      confirmLabel: "Elimina",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteDocumentFolder(folder.id);
      toast({ title: "Cartella eliminata" });
      await load();
    } catch (error) {
      toast({ title: "Eliminazione non completata", description: errorMessage(error), variant: "destructive" });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Cartelle documenti"
        description="Organizza documenti interni, contratti, asset e allegati per area o relazione."
        actions={<Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuova cartella</Button>}
      />

      {loading ? (
        <div className="flex min-h-[24vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Caricamento cartelle...
        </div>
      ) : folders.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nessuna cartella configurata.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {folders.map((folder) => (
            <Card key={folder.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-nav bg-primary/10 p-2 text-primary"><FolderOpen className="h-4 w-4" /></span>
                    <CardTitle className="truncate text-lg">{folder.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className={visibilityClass(folder.visibility)}>{visibilityLabel(folder.visibility)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="min-h-10 text-sm text-muted-foreground">{folder.description || "Nessuna descrizione."}</p>
                <p className="text-xs text-muted-foreground">Creata {formatDateTime(folder.created_at)}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(folder)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Modifica
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => remove(folder)}>
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    Elimina
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Modifica cartella" : "Nuova cartella"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>Nome</Label><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            <div className="grid gap-2">
              <Label>Cartella padre</Label>
              <Select value={form.parent_id || "__none__"} onValueChange={(value) => setForm((prev) => ({ ...prev, parent_id: value === "__none__" ? "" : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessuna</SelectItem>
                  {folders.filter((folder) => folder.id !== form.id).map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Visibilità</Label>
              <Select value={form.visibility} onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interno</SelectItem>
                  {canViewFinance ? <SelectItem value="finance">Finance</SelectItem> : null}
                  <SelectItem value="private">Privato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={!form.name.trim()}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
        <ConfirmDialog />
    </PageShell>
  );
}
