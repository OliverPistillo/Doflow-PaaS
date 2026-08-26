"use client"

import { BookOpenCheck } from "lucide-react"
import { useSearchParams } from "next/navigation"

import SupportPage from "@/app/(tenant)/support/page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DoflowSupportPage() {
  const tutorial = useSearchParams().get("view") === "tutorial"
  return <div className="w-full"><h1 className="sr-only">Supporto tecnico</h1>{tutorial ? <Card className="mx-4 mt-4 md:mx-6 md:mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="size-5 text-primary" />Aiuto e tutorial</CardTitle><CardDescription>Guide operative e assistenza condividono lo stesso centro supporto Doflow.</CardDescription></CardHeader><CardContent className="text-sm text-muted-foreground">Consulta i ticket esistenti o apri una richiesta: stato, conversazione e risposte provengono dal server.</CardContent></Card> : null}<SupportPage /></div>
}
