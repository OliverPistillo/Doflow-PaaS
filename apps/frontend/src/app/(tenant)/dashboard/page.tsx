"use client"

import DashboardClient from "./dashboard-client"
import { RoleAwareDashboard } from "@/features/dashboard/role-aware-dashboard"
import { useIsDoflowExperience } from "@/features/identity/doflow-experience-context"

export default function DashboardPage() {
  return useIsDoflowExperience() ? <RoleAwareDashboard /> : <DashboardClient />
}
