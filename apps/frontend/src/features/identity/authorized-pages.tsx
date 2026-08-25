"use client"

import { CommercialWorkspacePage } from "@/features/commercial/components/commercial-workspace-page"
import { DuplicatesPage } from "@/features/commercial/components/duplicates-page"
import { CommercialClientsPage } from "@/features/commercial/components/commercial-clients-page"
import { CommerceOperationsPage, type CommerceSection } from "@/features/commercial/components/commerce-operations-page"
import { ContractRenewalOperationsPage, type ContractRenewalSection } from "@/features/commercial/components/contract-renewal-operations-page"
import { AccessDenied } from "@/features/identity/access-denied"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { CommercialCampaignsPage } from "@/features/commercial/components/commercial-campaigns-page"
import { CommercialDocumentCyclePage } from "@/features/commercial/components/commercial-document-cycle-page"
import { AutomationPerformancePage } from "@/features/commercial/components/automation-performance-page"

export function AuthorizedCommercialDashboard() {
  const identity = useDoflowIdentity()
  if (!identity.hasCapability("canViewAllLeads") && !identity.hasCapability("canViewAssignedLeads")) return <AccessDenied resource="alla dashboard commerciale" />
  return <CommercialWorkspacePage />
}

export function AuthorizedDuplicatesPage() {
  const identity = useDoflowIdentity()
  if (!identity.hasCapability("canInspectDuplicates")) return <AccessDenied resource="alla verifica duplicati" />
  return <DuplicatesPage />
}

export function AuthorizedClientsPage() {
  const identity = useDoflowIdentity()
  if (!identity.hasCapability("canViewCustomers")) return <AccessDenied resource="ai clienti" />
  return <CommercialClientsPage />
}

export function AuthorizedCommercePage({ section }: { section: CommerceSection }) {
  const identity = useDoflowIdentity()
  const allowed = section === "catalogo" || section === "vendite" ? identity.hasCapability("canViewSales") : section === "ordini" ? identity.hasCapability("canViewOrders") : identity.hasCapability("canManagePayments")
  if (!allowed) return <AccessDenied resource={`a ${section}`} />
  return <CommerceOperationsPage section={section} />
}

export function AuthorizedContractRenewalPage({ section }: { section: ContractRenewalSection }) {
  const identity = useDoflowIdentity()
  const allowed = section === "contratti" ? identity.hasCapability("canViewContracts") : identity.hasCapability("canViewRenewals")
  if (!allowed) return <AccessDenied resource={`a ${section}`} />
  return <ContractRenewalOperationsPage section={section} />
}

export function AuthorizedCampaignsPage() {
  const identity = useDoflowIdentity()
  if (!identity.hasCapability("canViewCampaigns")) return <AccessDenied resource="alle campagne" />
  return <CommercialCampaignsPage />
}

export function AuthorizedDocumentCyclePage({ section }: { section: "quotes" | "invoices" }) {
  const identity = useDoflowIdentity(); const allowed = section === "quotes" ? identity.hasCapability("canViewQuotes") : identity.hasCapability("canViewInvoices")
  if (!allowed) return <AccessDenied resource={section === "quotes" ? "ai preventivi" : "alle fatture locali"} />
  return <CommercialDocumentCyclePage section={section} />
}

export function AuthorizedAutomationsPage() {
  const identity = useDoflowIdentity(); if (!identity.hasCapability("canViewAutomations")) return <AccessDenied resource="alle automazioni" />
  return <AutomationPerformancePage />
}
