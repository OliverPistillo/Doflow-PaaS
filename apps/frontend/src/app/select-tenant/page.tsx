// apps/frontend/src/app/select-tenant/page.tsx
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

type JwtPayload = { role?: string; tenantId?: string; tenant_id?: string }

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase().replace(/[^A-Z_]/g, "")
  if (r === "OWNER" || r === "SUPERADMIN" || r === "SUPER_ADMIN") return "SUPER_ADMIN"
  if (r === "ADMIN") return "ADMIN"
  if (r === "MANAGER") return "MANAGER"
  return "USER"
}

export default function SelectTenantPage() {
  const router = useRouter()

  React.useEffect(() => {
    const token = window.localStorage.getItem("doflow_token")
    if (!token) {
      router.replace("/login")
      return
    }

    const payload = parseJwtPayload(token)
    const role = normalizeRole(payload?.role)
    const tenant = (payload?.tenantId ?? payload?.tenant_id ?? "public").toString().toLowerCase()

    if (role === "SUPER_ADMIN") {
      router.replace("/superadmin/dashboard")
      return
    }

    if (tenant && tenant !== "public") {
      router.replace(`/${tenant}`)
      return
    }

    router.replace("/dashboard")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground animate-pulse">Caricamento…</p>
    </div>
  )
}
