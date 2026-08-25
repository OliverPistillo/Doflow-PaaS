import type { CommercialOrder, CommercialPayment, CommercialSale } from "@/features/commercial/commercial-commerce"
import type { CommercialLead } from "@/features/commercial/types"

export const campaignChannels = ["Meta Ads", "Google Ads", "Organico", "Referral", "Evento", "LinkedIn", "Instagram", "Manuale"] as const
export type CampaignChannel = (typeof campaignChannels)[number]

export type CommercialCampaignAd = { id: string; name: string; status: "active" | "paused" | "archived" }
export type CommercialCampaignAdGroup = { id: string; name: string; status: "active" | "paused" | "archived"; ads: CommercialCampaignAd[] }
export type CommercialCampaign = {
  id: string
  name: string
  channel: CampaignChannel
  account: string
  status: "draft" | "active" | "paused" | "completed" | "archived"
  startsAt: string
  endsAt?: string
  spend: number
  impressions: number
  clicks: number
  adGroups: CommercialCampaignAdGroup[]
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CampaignMetrics = {
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number; leads: number; qualifiedLeads: number
  proposals: number; signedContracts: number; payingCustomers: number; qualificationRate: number; closeRate: number; cac: number
  sold: number; invoiced: number; grossCollected: number; refunded: number; netCollected: number; grossRoas: number; netRoas: number
  averageTicket: number; averageCloseDays: number; sourceQuality: number
}

const ratio = (value: number, total: number) => total > 0 ? value / total : 0

export function calculateCampaignMetrics(campaign: CommercialCampaign, leads: CommercialLead[], sales: CommercialSale[], orders: CommercialOrder[], payments: CommercialPayment[], signedContractOrderIds: Set<string>): CampaignMetrics {
  const attributedLeads = leads.filter((lead) => !lead.archivedAt && lead.campaignId === campaign.id)
  const leadIds = new Set(attributedLeads.map((lead) => lead.id))
  const campaignSales = sales.filter((sale) => !sale.archivedAt && sale.status !== "Annullata" && Boolean(sale.leadId && leadIds.has(sale.leadId)))
  const saleIds = new Set(campaignSales.map((sale) => sale.id))
  const campaignOrders = orders.filter((order) => !order.archivedAt && order.administrativeStatus !== "Annullato" && Boolean(order.saleId && saleIds.has(order.saleId)))
  const orderIds = new Set(campaignOrders.map((order) => order.id))
  const confirmed = payments.filter((payment) => !payment.archivedAt && payment.status === "Confermato" && orderIds.has(payment.orderId))
  const grossCollected = confirmed.filter((payment) => payment.type !== "Rimborso").reduce((sum, payment) => sum + Math.abs(payment.amount), 0)
  const refunded = confirmed.filter((payment) => payment.type === "Rimborso").reduce((sum, payment) => sum + Math.abs(payment.amount), 0)
  const netCollected = grossCollected - refunded
  const payingOrderIds = new Set(confirmed.filter((payment) => payment.type !== "Rimborso").map((payment) => payment.orderId))
  const payingCustomers = new Set(campaignOrders.filter((order) => payingOrderIds.has(order.id)).map((order) => order.customerId)).size
  const qualifiedLeads = attributedLeads.filter((lead) => !["new", "unqualified", "not-interested", "lost"].includes(lead.stage)).length
  const proposals = attributedLeads.filter((lead) => Boolean(lead.proposal)).length
  const signedContracts = campaignOrders.filter((order) => signedContractOrderIds.has(order.id)).length
  const sold = campaignOrders.filter((order) => order.administrativeStatus !== "Bozza").reduce((sum, order) => sum + order.total, 0)
  const invoiced = campaignOrders.reduce((sum, order) => sum + Math.max(0, Math.min(order.invoicedAmount ?? 0, order.total)), 0)
  const paidLeadIds = attributedLeads.filter((lead) => campaignSales.some((sale) => sale.leadId === lead.id && campaignOrders.some((order) => order.saleId === sale.id && payingOrderIds.has(order.id))))
  const closeDurations = paidLeadIds.map((lead) => {
    const paidAt = confirmed.filter((payment) => payment.type !== "Rimborso" && campaignOrders.some((order) => order.id === payment.orderId && campaignSales.some((sale) => sale.id === order.saleId && sale.leadId === lead.id))).sort((a, b) => a.date.localeCompare(b.date))[0]?.date
    return paidAt ? Math.max(0, (Date.parse(paidAt) - Date.parse(lead.createdAt)) / 86_400_000) : 0
  })
  const ctr = ratio(campaign.clicks, campaign.impressions) * 100
  const qualificationRate = ratio(qualifiedLeads, attributedLeads.length) * 100
  const closeRate = ratio(payingCustomers, attributedLeads.length) * 100
  return {
    spend: campaign.spend, impressions: campaign.impressions, clicks: campaign.clicks, ctr, cpc: ratio(campaign.spend, campaign.clicks),
    leads: attributedLeads.length, qualifiedLeads, proposals, signedContracts, payingCustomers, qualificationRate, closeRate,
    cac: ratio(campaign.spend, payingCustomers), sold, invoiced, grossCollected, refunded, netCollected,
    grossRoas: ratio(grossCollected, campaign.spend), netRoas: ratio(netCollected, campaign.spend), averageTicket: ratio(netCollected, payingCustomers),
    averageCloseDays: closeDurations.length ? closeDurations.reduce((sum, days) => sum + days, 0) / closeDurations.length : 0,
    sourceQuality: Math.round(qualificationRate * .4 + closeRate * .6),
  }
}

export type CampaignAdapterStatus = { provider: "Meta Lead Ads" | "Google Ads"; enabled: false; mode: "adapter-only"; reason: string }
export const campaignAdapters: CampaignAdapterStatus[] = [
  { provider: "Meta Lead Ads", enabled: false, mode: "adapter-only", reason: "Richiede credenziali e backend sicuro." },
  { provider: "Google Ads", enabled: false, mode: "adapter-only", reason: "Richiede credenziali e backend sicuro." },
]
