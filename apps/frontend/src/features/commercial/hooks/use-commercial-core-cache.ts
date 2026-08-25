"use client";

import { useState } from "react";

import type {
  CommercialCustomer,
  CustomerActivity,
} from "@/features/commercial/commercial-provider-types";
import type {
  CommercialLead,
  PipelineStage,
} from "@/features/commercial/types";

/**
 * Cache di rendering del Commercial Core.
 *
 * Parte sempre vuota e non persiste nel browser: ogni valore viene sostituito
 * dalle query PostgreSQL-backed del composition layer.
 */
export function useCommercialCoreCache(
  createInitialOrder: () => Record<PipelineStage, string[]>,
) {
  const [leads, setLeads] = useState<CommercialLead[]>([]);
  const [leadActivities, setLeadActivities] = useState<CustomerActivity[]>([]);
  const [customers, setCustomers] = useState<CommercialCustomer[]>([]);
  const [order, setOrder] = useState(createInitialOrder);
  const [ignoredDuplicatePairs, setIgnoredDuplicatePairs] = useState<string[]>([]);
  const [duplicatesLastAnalyzedAt, setDuplicatesLastAnalyzedAt] = useState<string>();

  return {
    leads,
    setLeads,
    leadActivities,
    setLeadActivities,
    customers,
    setCustomers,
    order,
    setOrder,
    ignoredDuplicatePairs,
    setIgnoredDuplicatePairs,
    duplicatesLastAnalyzedAt,
    setDuplicatesLastAnalyzedAt,
  };
}
