"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TenantDocument } from "@/lib/tenant-documents-api";
import { categoryLabel, formatBytes, formatDateTime } from "@/components/tenant-documents/document-utils";

export function DocumentUploadLink({ memberId }: { memberId: string }) {
  return (
    <Button asChild variant="outline">
      <Link href={`/documents/upload?entity_type=team_member&entity_id=${memberId}&category=company_document`}>
        <FileText className="mr-2 h-4 w-4" />
        Carica documento membro
      </Link>
    </Button>
  );
}

export function DocumentsMiniList({ documents, memberId }: { documents: TenantDocument[]; memberId: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Documenti membro</CardTitle>
        <DocumentUploadLink memberId={memberId} />
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="rounded-nav border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Nessun documento collegato al membro.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <div key={document.id} className="flex flex-col gap-2 rounded-nav border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/documents/${document.id}`} className="font-semibold text-primary hover:underline">{document.title}</Link>
                  <p className="text-xs text-muted-foreground">{categoryLabel(document.category)} · {formatBytes(document.size_bytes)} · {formatDateTime(document.created_at)}</p>
                </div>
                <Button asChild size="sm" variant="outline"><Link href={`/documents/${document.id}`}>Apri</Link></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
