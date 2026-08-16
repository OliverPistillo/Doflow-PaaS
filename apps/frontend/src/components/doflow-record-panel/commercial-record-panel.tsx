"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, FileText, Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { apiFetch } from "@/lib/api";
import { contractsApi, type Contract } from "@/lib/tenant-contracts-api";
import {
  commercialApi,
  type CommercialActivity,
  type CommercialCompany,
  type CommercialContact,
  type CommercialOpportunity,
  type CommercialQuote,
} from "@/lib/tenant-commercial-api";
import { listDocumentsForEntity, type TenantDocument } from "@/lib/tenant-documents-api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import type { CommercialClientRow } from "@/components/tenant-commercial/commercial-client-types";
import { commercialDate, commercialMoney, pipelineStageLabel } from "@/components/tenant-commercial/commercial-utils";
import {
  RecordPanelEmptyState,
  RecordPanelField,
  RecordPanelSection,
  UnifiedRecordPanel,
  type RecordPanelAction,
  type RecordPanelTab,
} from "./unified-record-panel";

type ListResponse<T> = { items: T[]; total?: number };
type Invoice = { id: string; invoice_number?: string | null; title?: string | null; status?: string | null; due_date?: string | null };

const companyStatusLabels: Record<string, string> = {
  active_client: "Cliente attivo",
  prospect: "Potenziale",
  former_client: "Ex cliente",
  partner: "Partner",
  dormant: "Da ricontattare",
};

const activityTypeLabels: Record<string, string> = {
  call: "Chiamata",
  email: "Email",
  meeting: "Riunione",
  note: "Nota",
  task: "Attività",
  follow_up: "Follow-up",
};

function whatsappHref(phone?: string | null) {
  const normalized = String(phone || "").replace(/[^0-9]/g, "");
  return normalized ? `https://wa.me/${normalized}` : undefined;
}

function timestamp(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function sortActivities(items: CommercialActivity[]) {
  return [...items].sort((a, b) => timestamp(b.completed_at || b.updated_at || b.created_at) - timestamp(a.completed_at || a.updated_at || a.created_at));
}

function memberName(members: TeamMember[], id?: string | null) {
  if (!id) return "Non assegnato";
  const member = members.find((item) => item.user_id === id || item.id === id);
  return member?.display_name || member?.email || "Responsabile assegnato";
}

function contactName(contact?: CommercialContact | null, fallback?: string | null) {
  const name = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "";
  return name || fallback || "Non collegato";
}

function ActivityList({ activities }: { activities: CommercialActivity[] }) {
  if (!activities.length) {
    return <RecordPanelEmptyState title="Nessuna attività collegata" description="Registra la prossima attività dal flusso CRM per costruire uno storico reale." action={<Button asChild size="sm"><Link href="/activities?new=1">Nuova attività</Link></Button>} />;
  }
  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <RecordPanelSection key={activity.id} title={activity.title} className="p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{activityTypeLabels[activity.type] || activity.type}</span>
            <span aria-hidden="true">·</span>
            <span>{commercialDate(activity.completed_at || activity.updated_at || activity.created_at, true)}</span>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">{activity.completed_at ? "Completata" : "Da fare"}</span>
          </div>
          {activity.description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700" data-record-sensitive>{activity.description}</p> : null}
        </RecordPanelSection>
      ))}
    </div>
  );
}

function DocumentsList({ documents, entityLabel }: { documents: TenantDocument[]; entityLabel: string }) {
  if (!documents.length) {
    return <RecordPanelEmptyState title="Nessun file collegato" description={`Collega i documenti reali a ${entityLabel} dall’archivio Documenti.`} action={<Button asChild variant="outline" size="sm"><Link href="/documents">Apri Documenti</Link></Button>} />;
  }
  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <Link key={document.id} href={`/documents/${document.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-violet-300 hover:bg-violet-50/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><FileText className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900" data-record-sensitive>{document.title}</span><span className="block text-xs text-slate-500">{document.category} · {commercialDate(document.created_at)}</span></span>
          <span className="text-xs font-medium text-violet-700">Apri</span>
        </Link>
      ))}
    </div>
  );
}

function AdministrationList({ quotes, contracts, invoices, canViewAdministration }: { quotes: CommercialQuote[]; contracts: Contract[]; invoices: Invoice[]; canViewAdministration: boolean }) {
  if (!canViewAdministration) {
    return <RecordPanelEmptyState title="Amministrazione non disponibile" description="Il tuo profilo non dispone dei permessi backend necessari per queste informazioni." />;
  }
  if (!quotes.length && !contracts.length && !invoices.length) {
    return <RecordPanelEmptyState title="Nessun elemento amministrativo collegato" description="Preventivi, contratti e fatture compariranno qui solo quando saranno realmente associati." action={<Button asChild variant="outline" size="sm"><Link href="/quotes">Apri preventivi</Link></Button>} />;
  }
  return (
    <div className="space-y-4">
      {quotes.length ? <RecordPanelSection title="Preventivi"><div className="space-y-2">{quotes.map((quote) => <Link key={quote.id} href="/quotes" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="min-w-0 truncate font-medium text-slate-900" data-record-sensitive>{quote.title || quote.quote_number || "Preventivo"}</span><span className="shrink-0 text-xs text-slate-500">{quote.status}</span></Link>)}</div></RecordPanelSection> : null}
      {contracts.length ? <RecordPanelSection title="Contratti"><div className="space-y-2">{contracts.map((contract) => <Link key={contract.id} href={`/contracts/${contract.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="min-w-0 truncate font-medium text-slate-900" data-record-sensitive>{contract.title || contract.contract_number}</span><span className="shrink-0 text-xs text-slate-500">{contract.status}</span></Link>)}</div></RecordPanelSection> : null}
      {invoices.length ? <RecordPanelSection title="Fatture"><div className="space-y-2">{invoices.map((invoice) => <Link key={invoice.id} href="/finance/invoices" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="min-w-0 truncate font-medium text-slate-900" data-record-sensitive>{invoice.title || invoice.invoice_number || "Fattura"}</span><span className="shrink-0 text-xs text-slate-500">{invoice.status || "—"}</span></Link>)}</div></RecordPanelSection> : null}
    </div>
  );
}

export function DoflowCommercialRecordPanel({
  kind,
  recordId,
  fallbackOpportunity,
  fallbackClient,
  activeTab,
  onTabChange,
  onClose,
  showEconomic,
}: {
  kind: "opportunity" | "company";
  recordId: string;
  fallbackOpportunity?: CommercialOpportunity | null;
  fallbackClient?: CommercialClientRow | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  showEconomic: boolean;
}) {
  const { canView } = useTenantAccess();
  const [opportunity, setOpportunity] = useState<CommercialOpportunity | null>(fallbackOpportunity || null);
  const [company, setCompany] = useState<CommercialCompany | null>(fallbackClient?.company || null);
  const [contact, setContact] = useState<CommercialContact | null>(fallbackClient?.contact || null);
  const [activities, setActivities] = useState<CommercialActivity[]>(fallbackClient?.lastActivity ? [fallbackClient.lastActivity] : []);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [quotes, setQuotes] = useState<CommercialQuote[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        if (kind === "opportunity") {
          const detail = await commercialApi.opportunity(recordId);
          if (cancelled) return;
          setOpportunity(detail);
          const [activityResult, documentResult, quoteResult, contractResult, companyResult, memberResult] = await Promise.allSettled([
            commercialApi.activities({ opportunity_id: recordId, limit: 100, sortBy: "updated_at" }),
            canView("documents") ? listDocumentsForEntity("opportunity", recordId, { limit: 100 }) : Promise.resolve({ items: [] }),
            canView("quotes") ? commercialApi.quotes({ opportunity_id: recordId, limit: 100 }) : Promise.resolve({ items: [] }),
            canView("contracts") ? contractsApi.list({ opportunity_id: recordId, limit: 100 }) : Promise.resolve({ items: [] }),
            detail.company_id ? commercialApi.company(detail.company_id) : Promise.resolve(null),
            canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
          ]);
          if (cancelled) return;
          if (activityResult.status === "fulfilled") setActivities(sortActivities(activityResult.value.items || []));
          if (documentResult.status === "fulfilled") setDocuments(documentResult.value.items || []);
          if (quoteResult.status === "fulfilled") setQuotes(quoteResult.value.items || []);
          if (contractResult.status === "fulfilled") setContracts(contractResult.value.items || []);
          if (companyResult.status === "fulfilled") setCompany(companyResult.value);
          if (memberResult.status === "fulfilled") setMembers(memberResult.value.items || []);
        } else {
          const detail = await commercialApi.company(recordId);
          if (cancelled) return;
          setCompany(detail);
          const [contactResult, opportunityResult, activityResult, documentResult, quoteResult, contractResult, invoiceResult, memberResult] = await Promise.allSettled([
            commercialApi.contacts({ company_id: recordId, limit: 100 }),
            commercialApi.opportunities({ company_id: recordId, limit: 100 }),
            commercialApi.activities({ company_id: recordId, limit: 100, sortBy: "updated_at" }),
            canView("documents") ? listDocumentsForEntity("company", recordId, { limit: 100 }) : Promise.resolve({ items: [] }),
            canView("quotes") ? commercialApi.quotes({ company_id: recordId, limit: 100 }) : Promise.resolve({ items: [] }),
            canView("contracts") ? contractsApi.list({ company_id: recordId, limit: 100 }) : Promise.resolve({ items: [] }),
            canView("finance") ? apiFetch<ListResponse<Invoice>>(`/tenant/finance/invoices?company_id=${encodeURIComponent(recordId)}&limit=100`) : Promise.resolve({ items: [] }),
            canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
          ]);
          if (cancelled) return;
          if (contactResult.status === "fulfilled") setContact(contactResult.value.items.find((item) => item.is_primary) || contactResult.value.items[0] || null);
          if (opportunityResult.status === "fulfilled") setOpportunity(opportunityResult.value.items[0] || null);
          if (activityResult.status === "fulfilled") setActivities(sortActivities(activityResult.value.items || []));
          if (documentResult.status === "fulfilled") setDocuments(documentResult.value.items || []);
          if (quoteResult.status === "fulfilled") setQuotes(quoteResult.value.items || []);
          if (contractResult.status === "fulfilled") setContracts(contractResult.value.items || []);
          if (invoiceResult.status === "fulfilled") setInvoices(invoiceResult.value.items || []);
          if (memberResult.status === "fulfilled") setMembers(memberResult.value.items || []);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Record non disponibile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [canView, kind, recordId]);

  const currentOpportunity = kind === "opportunity" ? opportunity : opportunity || fallbackClient?.activeOpportunity || null;
  const phone = contact?.phone || currentOpportunity?.contact_phone || company?.phone;
  const email = contact?.email || currentOpportunity?.contact_email || company?.email;
  const latestActivity = activities[0];
  const canShowEconomic = showEconomic && canView("finance");
  const owner = kind === "opportunity"
    ? memberName(members, currentOpportunity?.assigned_to)
    : memberName(members, company?.owner_user_id);
  const status = kind === "opportunity"
    ? pipelineStageLabel(currentOpportunity?.stage || "", true)
    : companyStatusLabels[company?.status || ""] || company?.status || "Non definito";

  const overview = (
    <div className="space-y-4">
      {currentOpportunity?.next_action ? (
        <RecordPanelSection title="Prossima azione">
          <p className="text-base font-semibold text-slate-950" data-record-sensitive>{currentOpportunity.next_action}</p>
          <p className="mt-1 text-xs text-slate-500">{commercialDate(currentOpportunity.next_action_at, true)}</p>
        </RecordPanelSection>
      ) : (
        <RecordPanelEmptyState title="Nessuna prossima azione" description="Aggiungi un’attività CRM per rendere esplicito il prossimo passo." action={<Button asChild size="sm"><Link href="/activities?new=1">Nuova attività</Link></Button>} />
      )}
      <RecordPanelSection title={kind === "opportunity" ? "Dettagli trattativa" : "Dettagli cliente"}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <RecordPanelField label="Referente" value={contactName(contact, currentOpportunity?.contact_name)} sensitive />
          <RecordPanelField label="Email" value={email ? <a className="text-violet-700 hover:underline" href={`mailto:${email}`}>{email}</a> : "—"} sensitive />
          <RecordPanelField label="Telefono" value={phone ? <a className="text-violet-700 hover:underline" href={`tel:${phone}`}>{phone}</a> : "—"} sensitive />
          <RecordPanelField label="Responsabile" value={owner} sensitive />
          <RecordPanelField label="Origine" value={currentOpportunity?.lead_source || company?.source || "—"} />
          <RecordPanelField label={kind === "opportunity" ? "Fase" : "Stato"} value={status} />
          {canShowEconomic && currentOpportunity ? <RecordPanelField label="Valore" value={commercialMoney(currentOpportunity.value_estimate)} sensitive /> : null}
          <RecordPanelField label="Ultima attività" value={latestActivity ? commercialDate(latestActivity.completed_at || latestActivity.updated_at || latestActivity.created_at, true) : "—"} />
        </dl>
      </RecordPanelSection>
      {latestActivity ? <RecordPanelSection title="Ultimo aggiornamento"><p className="text-sm font-medium text-slate-900" data-record-sensitive>{latestActivity.title}</p>{latestActivity.description ? <p className="mt-2 text-sm leading-6 text-slate-600" data-record-sensitive>{latestActivity.description}</p> : null}</RecordPanelSection> : null}
    </div>
  );

  const tabs = useMemo<RecordPanelTab[]>(() => [
    { value: "overview", label: "Riepilogo", content: overview },
    { value: "activity", label: "Attività e comunicazioni", content: <ActivityList activities={activities} /> },
    { value: "files", label: "File", content: <DocumentsList documents={documents} entityLabel={kind === "opportunity" ? "questa opportunità" : "questo cliente"} /> },
    { value: "administration", label: "Amministrazione", content: <AdministrationList quotes={quotes} contracts={contracts} invoices={invoices} canViewAdministration={canView("quotes") || canView("contracts") || canView("finance")} /> },
  ], [activities, canView, contracts, documents, invoices, kind, overview, quotes]);

  const actions: RecordPanelAction[] = [
    { label: "Chiama", icon: Phone, href: phone ? `tel:${phone}` : undefined, disabled: !phone, disabledReason: "Numero di telefono non disponibile" },
    { label: "WhatsApp", icon: MessageCircle, href: whatsappHref(phone), external: true, disabled: !whatsappHref(phone), disabledReason: "Numero WhatsApp non disponibile" },
    { label: "Email", icon: Mail, href: email ? `mailto:${email}` : undefined, disabled: !email, disabledReason: "Indirizzo email non disponibile" },
    { label: "Nuova attività", icon: CalendarPlus, href: "/activities?new=1" },
  ];

  return (
    <UnifiedRecordPanel
      open
      onClose={onClose}
      eyebrow={kind === "opportunity" ? "Opportunità" : "Cliente"}
      title={kind === "opportunity" ? currentOpportunity?.title || "Dettaglio opportunità" : company?.name || "Dettaglio cliente"}
      subtitle={kind === "opportunity" ? currentOpportunity?.company_name || company?.name : currentOpportunity?.service_type || company?.industry}
      status={status}
      owner={owner}
      actions={actions}
      moreActions={kind === "opportunity" ? [
        { label: "Avvia briefing", href: `/briefings/new?opportunity=${encodeURIComponent(recordId)}` },
        { label: "Crea preventivo", href: `/quotes/new?opportunity=${encodeURIComponent(recordId)}` },
      ] : [
        { label: "Apri attività CRM", href: "/activities" },
        { label: "Apri preventivi", href: "/quotes" },
      ]}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      loading={loading}
      error={error}
    />
  );
}
