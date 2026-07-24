"use client";

import { CHECKLIST_CATEGORIES, CHECKLIST_STATUSES, PRIORITIES, badgeClass, canManageAdminWorkflow, formatDate, formatDateTime, labelFor, toBody, type Option } from "@/components/tenant-contracts/contract-utils";

export const DOSSIER_STATUSES: Option[] = [
  { value: "open", label: "Aperto" },
  { value: "in_progress", label: "In lavorazione" },
  { value: "waiting", label: "In attesa" },
  { value: "completed", label: "Completato" },
  { value: "blocked", label: "Bloccato" },
  { value: "archived", label: "Archiviato" },
];

export const DOSSIER_TYPES: Option[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "project_start", label: "Avvio progetto" },
  { value: "contract", label: "Contratto" },
  { value: "billing", label: "Fatturazione" },
  { value: "compliance", label: "Compliance" },
  { value: "delivery", label: "Consegna" },
  { value: "renewal", label: "Rinnovo" },
  { value: "generic", label: "Generico" },
];

export const PAPERWORK_CATEGORIES = [
  ...CHECKLIST_CATEGORIES,
  { value: "data", label: "Dati" },
  { value: "privacy", label: "Privacy" },
];

export { CHECKLIST_STATUSES as ITEM_STATUSES, PRIORITIES, badgeClass, canManageAdminWorkflow, formatDate, formatDateTime, labelFor, toBody };
