"use client"

import Link from "next/link"
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { roleLabels } from "@/features/identity/permissions"

export function CommercialSettingsPage() {
  const identity = useDoflowIdentity()
  const canManageRoles = identity.hasCapability("canManageRoles")

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          Account e accesso al workspace Doflow.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4" />Account attivo
          </CardTitle>
          <CardDescription>
            L’identità deriva dalla sessione autenticata e non può essere sostituita dal browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <UserAvatar
            userId={identity.currentUser.id}
            name={identity.currentUser.name}
            className="size-12"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{identity.currentUser.name}</p>
            <p className="truncate text-sm text-muted-foreground">{identity.currentUser.email}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {identity.currentUser.roles.map((role) => (
              <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {canManageRoles ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" />Team e account
            </CardTitle>
            <CardDescription>
              Ruoli, capability esplicite, permessi modulo e lifecycle sono centralizzati nella console Team Space.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/team-space?tab=team-accounts">
                Apri Team e account <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  )
}
