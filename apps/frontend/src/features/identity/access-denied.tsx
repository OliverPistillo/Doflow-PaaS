"use client"

import { useRouter } from "next/navigation"

import { FlowAssistant } from "@/features/flow/flow-assistant"

export function AccessDenied({ resource = "questa risorsa" }: { resource?: string }) {
  const router = useRouter()
  return <main className="grid min-h-[calc(100dvh-4rem)] place-items-center p-4"><FlowAssistant variant="warning" size="empty-state" assetId="flow-access-denied" title="Accesso non autorizzato" message={`Il tuo account non dispone delle capacità richieste per ${resource}. Nessun dato non autorizzato è stato caricato.`} primaryAction={{ label:"Torna alla panoramica", onClick:()=>router.push("/dashboard") }} className="w-full" /></main>
}
