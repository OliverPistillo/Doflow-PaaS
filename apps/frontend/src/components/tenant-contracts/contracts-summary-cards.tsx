"use client";

import { AlertTriangle, CheckCircle2, Clock3, FilePenLine, FileText, Send, Signature } from "lucide-react";
import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";

type ContractsSummary = {
  contracts?: ContractsSummary;
  totalContracts?: number;
  draftContracts?: number;
  sentContracts?: number;
  waitingSignatureContracts?: number;
  signedContracts?: number;
  expiringContracts?: number;
  overdueContracts?: number;
};

export function ContractsSummaryCards({ summary }: { summary?: ContractsSummary | null }) {
  const data = summary?.contracts || summary || {};

  return (
    <KpiGrid>
      <KpiStatCard label="Contratti totali" value={data.totalContracts || 0} icon={FileText} />
      <KpiStatCard label="Bozze" value={data.draftContracts || 0} icon={FilePenLine} />
      <KpiStatCard label="Inviati" value={data.sentContracts || 0} icon={Send} tone="info" />
      <KpiStatCard label="In attesa firma" value={data.waitingSignatureContracts || 0} icon={Signature} tone="warning" />
      <KpiStatCard label="Firmati o attivi" value={data.signedContracts || 0} icon={CheckCircle2} tone="success" />
      <KpiStatCard label="In scadenza" value={data.expiringContracts || 0} icon={Clock3} tone="warning" />
      <KpiStatCard label="Scaduti" value={data.overdueContracts || 0} icon={AlertTriangle} tone="danger" />
    </KpiGrid>
  );
}
