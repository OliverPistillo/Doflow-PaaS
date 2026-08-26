"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { PlatformAppShell } from "@/components/layout/platform-app-shell"
import { apiFetch } from "@/lib/api"
import { clearDoFlowUser, setDoFlowUser } from "@/lib/jwt"

type AuthMe = {
  user: {
    id: string
    email?: string
    role?: string
    tenantId?: string
    tenantSlug?: string
    authStage?: string
  }
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    apiFetch<AuthMe>("/auth/me")
      .then(({ user }) => {
        if (cancelled) return
        setDoFlowUser({ ...user, sub: user.id })
        const role = String(user.role || "").toLowerCase().trim()
        const tenant = String(user.tenantSlug || user.tenantId || "").toLowerCase().trim()
        const isPlatformSuperadmin = ["superadmin", "super_admin"].includes(role) && tenant === "public"
        if (!isPlatformSuperadmin) {
          router.replace("/dashboard")
          return
        }
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        clearDoFlowUser()
        router.replace("/login")
      })
    return () => { cancelled = true }
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground" role="status">
        Accesso Control Plane…
      </div>
    )
  }

  return <PlatformAppShell>{children}</PlatformAppShell>
}
