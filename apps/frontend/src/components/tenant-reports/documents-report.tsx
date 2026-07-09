"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { formatBytes } from "./report-utils";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function DocumentsReportPage() {
  return (
    <ReportPage
      reportKey="documents"
      title="Report documenti"
      description="Volumi, storage, categorie, visibilità e allegati recenti."
      load={reportsApi.documents}
      render={(data, canFinance) => {
        const documents = data.documents || data;
        return (
          <div className="space-y-4">
            <Section title="KPI documenti">
              <MetricGrid metrics={[
                { label: "Totali", value: documents.totalDocuments },
                { label: "Caricati periodo", value: documents.documentsUploadedInPeriod },
                { label: "Archiviati", value: documents.archivedDocuments },
                { label: "Documenti finance", value: documents.financeDocuments, hidden: !canFinance },
              ]} />
              <p className="mt-3 text-sm text-muted-foreground">Storage usato: <strong>{formatBytes(documents.storageUsedBytes)}</strong></p>
            </Section>
            <Section title="Categorie"><KeyValueList data={documents.documentsByCategory} /></Section>
            <Section title="Visibilità"><KeyValueList data={documents.documentsByVisibility} canFinance={canFinance} /></Section>
            <Section title="Entità collegate"><KeyValueList data={documents.documentsByEntityType} canFinance={canFinance} /></Section>
            <Section title="Upload recenti">
              <SimpleTable rows={documents.recentUploads || []} columns={[
                { key: "title", label: "Titolo" },
                { key: "original_filename", label: "File" },
                { key: "category", label: "Categoria" },
                { key: "visibility", label: "Visibilità" },
                { key: "size_bytes", label: "Dimensione", format: (value) => formatBytes(value) },
              ]} />
            </Section>
          </div>
        );
      }}
    />
  );
}

