"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import {
  commercialApi,
  type CommercialActivity,
  type CommercialCompany,
  type CommercialContact,
  type CommercialOpportunity,
} from "@/lib/tenant-commercial-api";
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
import { RecordTimeline } from "./record-timeline";
import { RecordFiles } from "./record-files";
import { RecordAdministration } from "./record-administration";

const companyStatusLabels: Record<string, string> = {
  active_client: "Cliente attivo",
  prospect: "Potenziale",
  former_client: "Ex cliente",
  partner: "Partner",
  dormant: "Da ricontattare",
};

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
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [timelineDraft, setTimelineDraft] = useState<{ key: number; channel: "email" | "whatsapp"; body: string } | null>(null);
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
          const [activityResult, companyResult, memberResult] = await Promise.allSettled([
            commercialApi.activities({ opportunity_id: recordId, limit: 100, sortBy: "updated_at" }),
            detail.company_id ? commercialApi.company(detail.company_id) : Promise.resolve(null),
            canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
          ]);
          if (cancelled) return;
          if (activityResult.status === "fulfilled") setActivities(sortActivities(activityResult.value.items || []));
          if (companyResult.status === "fulfilled") setCompany(companyResult.value);
          if (memberResult.status === "fulfilled") setMembers(memberResult.value.items || []);
        } else {
          const detail = await commercialApi.company(recordId);
          if (cancelled) return;
          setCompany(detail);
          const [contactResult, opportunityResult, activityResult, memberResult] = await Promise.allSettled([
            commercialApi.contacts({ company_id: recordId, limit: 100 }),
            commercialApi.opportunities({ company_id: recordId, limit: 100 }),
            commercialApi.activities({ company_id: recordId, limit: 100, sortBy: "updated_at" }),
            canView("team") ? teamApi.members({ limit: 100 }) : Promise.resolve({ items: [] }),
          ]);
          if (cancelled) return;
          if (contactResult.status === "fulfilled") setContact(contactResult.value.items.find((item) => item.is_primary) || contactResult.value.items[0] || null);
          if (opportunityResult.status === "fulfilled") setOpportunity(opportunityResult.value.items[0] || null);
          if (activityResult.status === "fulfilled") setActivities(sortActivities(activityResult.value.items || []));
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
    { value: "activity", label: "Attività e comunicazioni", content: <RecordTimeline recordKind={kind} recordId={recordId} moduleKey="crm" phone={phone} email={email} members={members} draft={timelineDraft} /> },
    { value: "files", label: "File", content: <RecordFiles recordKind={kind} recordId={recordId} onSolicit={(channel, body) => { setTimelineDraft({ key: Date.now(), channel, body }); onTabChange("activity"); }} /> },
    { value: "administration", label: "Amministrazione", content: <RecordAdministration recordKind={kind} recordId={recordId} /> },
  ], [email, kind, members, onTabChange, overview, phone, recordId, timelineDraft]);

  const actions: RecordPanelAction[] = [
    { label: "Chiama", icon: Phone, onSelect: () => onTabChange("activity") },
    { label: "WhatsApp", icon: MessageCircle, onSelect: () => onTabChange("activity") },
    { label: "Email", icon: Mail, onSelect: () => onTabChange("activity") },
    { label: "Nuova attività", icon: CalendarPlus, onSelect: () => onTabChange("activity") },
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
