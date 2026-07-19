"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, FolderOpen, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { getDoFlowUser } from "@/lib/jwt";
import {
  archiveDocument,
  deleteDocument,
  downloadDocumentBlob,
  getDocumentsSummary,
  listDocumentFolders,
  listDocuments,
  restoreDocument,
  type DocumentFilters,
  type DocumentFolder,
  type DocumentSummary,
  type TenantDocument,
} from "@/lib/tenant-documents-api";
import { canViewFinanceDocuments } from "./document-utils";
import { DocumentFiltersBar } from "./document-filters";
import { DocumentsList } from "./documents-list";
import { DocumentsSummaryCards } from "./documents-summary-cards";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const DEFAULT_FILTERS: DocumentFilters = {
  status: "active",
  sort: "created_at",
  sortDir: "desc",
  limit: 80,
};

export function DocumentsPage() {
  const { toast } = useToast();
  const { ConfirmDialog, confirm } = useConfirm();
  const role = getDoFlowUser()?.role;
  const canViewFinance = canViewFinanceDocuments(role);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [filters, setFilters] = useState<DocumentFilters>(DEFAULT_FILTERS);
  const [total, setTotal] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const query = useMemo(() => ({
    ...filters,
    visibility: !canViewFinance && filters.visibility === "finance" ? undefined : filters.visibility,
    category: !canViewFinance && ["finance", "invoice", "receipt"].includes(String(filters.category || "")) ? undefined : filters.category,
  }), [canViewFinance, filters]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getDocumentsSummary();
      setSummary(data);
      setSummaryError(null);
    } catch (error) {
      setSummary(null);
      setSummaryError(errorMessage(error, "Summary documenti non disponibile"));
    }
  }, []);

  const loadFolders = useCallback(async () => {
    const data = await listDocumentFolders();
    setFolders(data.items || []);
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listDocuments(query);
      setDocuments(data.items || []);
      setTotal(data.total);
    } catch (error) {
      setDocuments([]);
      setTotal(0);
      toast({
        title: "Errore caricamento documenti",
        description: errorMessage(error, "Impossibile leggere i documenti."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [query, toast]);

  const reload = useCallback(async () => {
    await Promise.all([
      loadSummary(),
      loadFolders().catch((error) => {
        toast({ title: "Cartelle non caricate", description: errorMessage(error, "Errore cartelle"), variant: "destructive" });
      }),
      loadDocuments(),
    ]);
  }, [loadDocuments, loadFolders, loadSummary, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast({ title: success });
      await reload();
    } catch (error) {
      toast({
        title: "Operazione non completata",
        description: errorMessage(error, "Errore documenti"),
        variant: "destructive",
      });
    }
  };

  const download = async (document: TenantDocument) => {
    try {
      const { blob, filename } = await downloadDocumentBlob(document);
      saveBlob(blob, filename);
    } catch (error) {
      toast({
        title: "Download fallito",
        description: errorMessage(error, "Non hai permessi o il file non è disponibile."),
        variant: "destructive",
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Documenti"
        description="Archivio interno tenant-scoped per allegati, asset, contratti, materiali progetto e documenti finance autorizzati."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/documents/folders">
                <FolderOpen className="mr-2 h-4 w-4" />
                Cartelle
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/documents/upload">
                <Upload className="mr-2 h-4 w-4" />
                Carica documento
              </Link>
            </Button>
          </>
        }
      />

      {summaryError ? (
        <div className="rounded-card border border-chart-5/30 bg-chart-5/10 px-4 py-3 text-sm text-foreground">
          {summaryError}. La lista documenti resta utilizzabile.
        </div>
      ) : null}

      <DocumentsSummaryCards summary={summary} canViewFinance={canViewFinance} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentFiltersBar filters={filters} folders={folders} canViewFinance={canViewFinance} onChange={setFilters} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{typeof total === "number" ? `${total} documenti trovati` : "Documenti interni"}</p>
        <Button variant="outline" size="sm" onClick={reload} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Aggiorna
        </Button>
      </div>

      {isLoading && documents.length === 0 ? (
        <div className="flex min-h-[24vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Caricamento documenti...
        </div>
      ) : (
        <DocumentsList
          documents={documents}
          isLoading={isLoading}
          onDownload={download}
          onArchive={(doc) => void runAction(() => archiveDocument(doc.id), "Documento archiviato")}
          onRestore={(doc) => void runAction(() => restoreDocument(doc.id), "Documento ripristinato")}
          onDelete={async (doc) => {
            const ok = await confirm({
              title: "Eliminare questo documento?",
              description: "L'operazione è un soft delete.",
              confirmLabel: "Elimina",
              variant: "destructive",
            });
            if (ok) {
              void runAction(() => deleteDocument(doc.id), "Documento eliminato");
            }
          }}
        />
      )}
      <ConfirmDialog />
    </PageShell>
  );
}
