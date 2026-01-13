"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SelectTenantPage() {
  const router = useRouter()

  function enterFederica() {
    router.push("/federicanerone")
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/doflow_logo.svg"
            alt="Doflow"
            width={96}
            height={96}
            className="h-12 w-auto object-contain"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            Seleziona workspace
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Scegli il workspace a cui vuoi accedere.
          </p>
        </div>

        {/* Tenant card */}
        <Card className="p-6 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              Federica Nerone
            </span>
            <span className="text-xs text-muted-foreground">
              federicanerone.doflow.it
            </span>
          </div>

          <Button onClick={enterFederica}>
            Entra
          </Button>
        </Card>

        {/* Footer hint */}
        <p className="text-[11px] text-muted-foreground text-center">
          In futuro qui potrai gestire più workspace.
        </p>
      </div>
    </div>
  )
}
