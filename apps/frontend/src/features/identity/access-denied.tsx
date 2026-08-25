"use client"

import Link from "next/link"
import { ShieldX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AccessDenied({ resource = "questa risorsa" }: { resource?: string }) {
  return <main className="grid min-h-[calc(100dvh-4rem)] place-items-center p-4"><Card className="w-full max-w-md"><CardHeader className="text-center"><ShieldX className="mx-auto size-10 text-muted-foreground" /><CardTitle><h1>Accesso non autorizzato</h1></CardTitle><CardDescription>Il tuo account non dispone delle capacità richieste per la risorsa: {resource}.</CardDescription></CardHeader><CardContent className="flex justify-center"><Button asChild><Link href="/dashboard">Torna alla panoramica</Link></Button></CardContent></Card></main>
}
