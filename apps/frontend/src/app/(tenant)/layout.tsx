"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"

import { apiFetch } from "@/lib/api"
import { clearDoFlowUser, setDoFlowUser } from "@/lib/jwt"

type AuthMe = {
  user: {
    id: string
    role: string
    tenantId?: string
    tenantSlug?: string
    authStage?: string
  }
}

const ShellLoader = () => (
  <div
    data-app-prepaint="universal-v1"
    className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground"
  >
    Apertura spazio di lavoro…
  </div>
)

const TenantAppShell = dynamic(
  () => import("@/components/layout/tenant-app-shell").then((module) => module.TenantAppShell),
  { ssr: false, loading: ShellLoader },
)

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = React.useState<AuthMe["user"] | null | undefined>(undefined)

  React.useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    apiFetch<AuthMe>("/auth/me", { signal: controller.signal })
      .then((result) => {
        if (cancelled) return
        setDoFlowUser({ ...result.user, sub: result.user.id })
        setSession(result.user)
      })
      .catch((error) => {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) return
        clearDoFlowUser()
        setSession(null)
        router.replace("/login")
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [router])

  if (session === undefined || session === null) return <ShellLoader />

  const tenant = String(session.tenantSlug || session.tenantId || "").toLowerCase()
  const role = String(session.role || "").toLowerCase()
  if (["superadmin", "super_admin"].includes(role) || tenant === "public") {
    if (!pathname.startsWith("/superadmin")) router.replace("/superadmin")
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Apertura amministrazione…
      </div>
    )
  }

  return <TenantAppShell session={session}>{children}</TenantAppShell>
}
