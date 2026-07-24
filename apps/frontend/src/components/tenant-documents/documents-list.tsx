"use client";

import Link from "next/link";
import { Archive, Download, Eye, FileText, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page-shell";
import type { TenantDocument } from "@/lib/tenant-documents-api";
import {
  categoryClass,
  categoryLabel,
  entityLabel,
  formatBytes,
  formatDateTime,
  statusClass,
  statusLabel,
  visibilityClass,
  visibilityLabel,
} from "./document-utils";

type Props = {
  documents: TenantDocument[];
  isLoading?: boolean;
  onDownload: (document: TenantDocument) => void;
  onArchive: (document: TenantDocument) => void;
  onRestore: (document: TenantDocument) => void;
  onDelete: (document: TenantDocument) => void;
};

export function DocumentsList({ documents, isLoading, onDownload, onArchive, onRestore, onDelete }: Props) {
  if (!isLoading && documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nessun documento da mostrare"
        message="Carica un documento o modifica i filtri per visualizzare gli allegati interni."
      />
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <Card key={document.id}>
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground">{document.title}</h3>
                <Badge variant="outline" className={categoryClass(document.category)}>{categoryLabel(document.category)}</Badge>
                <Badge variant="outline" className={visibilityClass(document.visibility)}>{visibilityLabel(document.visibility)}</Badge>
                <Badge variant="outline" className={statusClass(document.status)}>{statusLabel(document.status)}</Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {document.original_filename} · {document.mime_type || "mime non disponibile"} · {formatBytes(document.size_bytes)}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{document.folder_name || "Senza cartella"}</span>
                <span>·</span>
                <span>{document.uploaded_by_email || document.uploaded_by || "Uploader non disponibile"}</span>
                <span>·</span>
                <span>{formatDateTime(document.created_at)}</span>
                {document.entity_type && document.entity_id ? (
                  <>
                    <span>·</span>
                    <span>{entityLabel(document.entity_type)} {document.entity_id.slice(0, 8)}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/documents/${document.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Apri
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDownload(document)}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              {document.status === "archived" || document.status === "deleted" ? (
                <Button variant="outline" size="sm" onClick={() => onRestore(document)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Ripristina
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => onArchive(document)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivia
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onDelete(document)}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Elimina
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
