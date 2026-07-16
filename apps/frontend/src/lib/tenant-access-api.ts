"use client";

import { apiFetch } from "@/lib/api";

export type TenantModuleKey =
  | "dashboard"
  | "crm"
  | "briefing"
  | "quotes"
  | "projects"
  | "calendar"
  | "documents"
  | "notifications"
  | "team"
  | "knowledge"
  | "contracts"
  | "paperwork"
  | "finance"
  | "reports"
  | "automations"
  | "credentials"
  | "settings"
  | "credentials.read"
  | "credentials.create"
  | "credentials.edit"
  | "credentials.reveal"
  | "credentials.manage_permissions"
  | "credentials.audit";

export type ModuleCapability = {
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_manage: boolean;
};

export type EffectiveTenantAccess = {
  role: string;
  audience: "executive" | "manager" | "employee";
  modules: Record<TenantModuleKey, ModuleCapability>;
};

export function getCurrentTenantAccess() {
  return apiFetch<EffectiveTenantAccess>("/tenant/team/me/module-permissions");
}
