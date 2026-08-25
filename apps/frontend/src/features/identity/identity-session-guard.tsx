"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

export function IdentitySessionGuard({ children }: { children: React.ReactNode }) {
  const identity = useDoflowIdentity(); const pathname = usePathname(); const router = useRouter()
  useEffect(() => { if (identity.hasHydrated && !identity.isAuthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`) }, [identity.hasHydrated, identity.isAuthenticated, pathname, router])
  if (!identity.isAuthenticated) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground" aria-busy="true">Verifica sessione…</div>
  return children
}
