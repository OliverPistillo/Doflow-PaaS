"use client";

import { apiFetch } from "@/lib/api";

export type TeamMemberSkill = {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  level?: string | null;
};

export type TeamMember = {
  id: string;
  user_id?: string | null;
  email: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  tenant_role?: string | null;
  job_title?: string | null;
  department?: string | null;
  operational_role?: string | null;
  employment_type?: string | null;
  status?: string | null;
  skills?: string[] | null;
  capacity_hours_per_week?: number | string | null;
  availability_status?: string | null;
  hourly_rate_cents?: number | null;
  daily_rate_cents?: number | null;
  currency?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  private_notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  skill_items?: TeamMemberSkill[];
};

export type TeamInviteResult = {
  email_sent: boolean;
  invite_link: string;
  expires_at: string;
};

export type CreateTeamMemberInput = Partial<TeamMember> & {
  send_invite?: boolean;
};

export type CreateTeamMemberResult = {
  member: TeamMember;
  invite: TeamInviteResult | null;
};

export type TeamSkill = {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TeamAvailability = {
  id: string;
  team_member_id: string;
  display_name?: string | null;
  email?: string | null;
  type: string;
  title?: string | null;
  starts_at: string;
  ends_at: string;
  capacity_hours?: number | string | null;
  is_all_day?: boolean;
  status: string;
  notes?: string | null;
  created_at?: string | null;
};

export type TimeEntry = {
  id: string;
  team_member_id: string;
  user_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  company_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  project_name?: string | null;
  task_title?: string | null;
  entry_date: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes: number;
  activity_type: string;
  description?: string | null;
  is_billable?: boolean;
  status: string;
  rejected_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TeamActivity = {
  id: string;
  team_member_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type TeamModulePermission = {
  id: string;
  team_member_id: string;
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_manage: boolean;
};

export type TeamWorkloadItem = {
  team_member_id: string;
  display_name: string;
  email: string;
  operational_role?: string | null;
  status?: string | null;
  availability_status?: string | null;
  capacity_hours_per_week?: number;
  openTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  activeProjects: number;
  loggedMinutesThisWeek: number;
  loggedMinutesThisMonth: number;
  utilizationPercent: number;
  isOverloaded: boolean;
  warnings?: string[];
  hourly_rate_cents?: number | null;
  daily_rate_cents?: number | null;
  currency?: string | null;
};

export type TeamSummary = {
  teamMembers: number;
  activeTeamMembers: number;
  availableTeamMembers: number;
  unavailableTeamMembers: number;
  overloadedMembers: number;
  totalCapacityHours: number;
  loggedHoursThisWeek: number;
  loggedHoursThisMonth: number;
  pendingTimeEntries: number;
  overdueTasksByTeam: number;
  workload: TeamWorkloadItem[];
  costEstimateThisMonth?: number;
  sources?: Record<string, boolean>;
};

export type TeamOptions = {
  tenantRoles: string[];
  operationalRoles: string[];
  employmentTypes: string[];
  memberStatuses: string[];
  availabilityStatuses: string[];
  skillLevels: string[];
  availabilityTypes: string[];
  availabilityEntryStatuses: string[];
  timeActivityTypes: string[];
  timeStatuses: string[];
  moduleKeys: string[];
  sensitiveFieldsVisible?: boolean;
};

export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number };
type Params = Record<string, string | number | boolean | null | undefined>;

function qs(params?: Params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const teamApi = {
  summary: () => apiFetch<TeamSummary>("/tenant/team/summary"),
  workload: (params?: Params) => apiFetch<ListResponse<TeamWorkloadItem>>(`/tenant/team/workload${qs(params)}`),
  members: (params?: Params) => apiFetch<ListResponse<TeamMember>>(`/tenant/team/members${qs(params)}`),
  createMember: (body: CreateTeamMemberInput) => apiFetch<CreateTeamMemberResult>("/tenant/team/members", { method: "POST", body: JSON.stringify(body) }),
  member: (id: string) => apiFetch<TeamMember>(`/tenant/team/members/${id}`),
  updateMember: (id: string, body: Partial<TeamMember>) => apiFetch<TeamMember>(`/tenant/team/members/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteMember: (id: string) => apiFetch<{ success: boolean }>(`/tenant/team/members/${id}`, { method: "DELETE" }),
  inviteMember: (id: string) => apiFetch<TeamInviteResult>(`/tenant/team/members/${id}/invite`, { method: "POST" }),
  syncUsers: () => apiFetch<{ ok: boolean; total: number }>("/tenant/team/members/sync-users", { method: "POST" }),
  memberWorkload: (id: string) => apiFetch<TeamWorkloadItem>(`/tenant/team/members/${id}/workload`),
  memberActivity: (id: string) => apiFetch<ListResponse<TeamActivity>>(`/tenant/team/members/${id}/activity`),
  skills: (params?: Params) => apiFetch<ListResponse<TeamSkill>>(`/tenant/team/skills${qs(params)}`),
  createSkill: (body: Partial<TeamSkill>) => apiFetch<TeamSkill>("/tenant/team/skills", { method: "POST", body: JSON.stringify(body) }),
  updateSkill: (id: string, body: Partial<TeamSkill>) => apiFetch<TeamSkill>(`/tenant/team/skills/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSkill: (id: string) => apiFetch<{ success: boolean }>(`/tenant/team/skills/${id}`, { method: "DELETE" }),
  addMemberSkill: (id: string, body: Record<string, unknown>) => apiFetch(`/tenant/team/members/${id}/skills`, { method: "POST", body: JSON.stringify(body) }),
  removeMemberSkill: (id: string, skillId: string) => apiFetch(`/tenant/team/members/${id}/skills/${skillId}`, { method: "DELETE" }),
  availability: (params?: Params) => apiFetch<ListResponse<TeamAvailability>>(`/tenant/team/availability${qs(params)}`),
  createAvailability: (body: Partial<TeamAvailability>) => apiFetch<TeamAvailability>("/tenant/team/availability", { method: "POST", body: JSON.stringify(body) }),
  updateAvailability: (id: string, body: Partial<TeamAvailability>) => apiFetch<TeamAvailability>(`/tenant/team/availability/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAvailability: (id: string) => apiFetch<{ success: boolean }>(`/tenant/team/availability/${id}`, { method: "DELETE" }),
  timeEntries: (params?: Params) => apiFetch<ListResponse<TimeEntry>>(`/tenant/team/time-entries${qs(params)}`),
  createTimeEntry: (body: Partial<TimeEntry>) => apiFetch<TimeEntry>("/tenant/team/time-entries", { method: "POST", body: JSON.stringify(body) }),
  updateTimeEntry: (id: string, body: Partial<TimeEntry>) => apiFetch<TimeEntry>(`/tenant/team/time-entries/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTimeEntry: (id: string) => apiFetch<{ success: boolean }>(`/tenant/team/time-entries/${id}`, { method: "DELETE" }),
  submitTimeEntry: (id: string) => apiFetch<TimeEntry>(`/tenant/team/time-entries/${id}/submit`, { method: "PATCH" }),
  approveTimeEntry: (id: string) => apiFetch<TimeEntry>(`/tenant/team/time-entries/${id}/approve`, { method: "PATCH" }),
  rejectTimeEntry: (id: string, reason: string) => apiFetch<TimeEntry>(`/tenant/team/time-entries/${id}/reject`, { method: "PATCH", body: JSON.stringify({ rejected_reason: reason }) }),
  permissions: (id: string) => apiFetch<ListResponse<TeamModulePermission>>(`/tenant/team/members/${id}/module-permissions`),
  updatePermissions: (id: string, permissions: Partial<TeamModulePermission>[]) => apiFetch<ListResponse<TeamModulePermission>>(`/tenant/team/members/${id}/module-permissions`, { method: "PATCH", body: JSON.stringify({ permissions }) }),
  options: () => apiFetch<TeamOptions>("/tenant/team/options"),
};
