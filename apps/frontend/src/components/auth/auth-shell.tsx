"use client"

import Image from "next/image"
import Link from "next/link"
import { LockKeyhole, ShieldCheck } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "register"

type AuthShellProps = {
  mode: AuthMode
  title: string
  description: string
  children: React.ReactNode
  mascotShy?: boolean
  cardClassName?: string
  brandTitle?: React.ReactNode
  brandDescription?: string
  registerHref?: string
  loginHref?: string
  onModeChange?: (mode: AuthMode) => void
}

export function AuthShell({
  mode,
  title,
  description,
  children,
  cardClassName,
  brandTitle = <>Il lavoro scorre in un unico spazio.</>,
  brandDescription = "Commerciale, produzione e amministrazione restano collegate dal primo contatto alla consegna.",
}: AuthShellProps) {
  return (
    <main data-auth-ui="universal" className="relative grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6"><ThemeToggle /></div>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className={cn("w-full max-w-md", mode === "register" && "max-w-xl", cardClassName)}>
          <Link href="/" aria-label="Vai alla home Doflow" className="inline-flex">
            <Image src="/logo_doflow_nero.png" alt="Doflow" width={142} height={32} priority className="mb-10 h-auto w-36 dark:hidden" />
            <Image src="/logo_doflow_bianco.png" alt="Doflow" width={142} height={32} priority className="mb-10 hidden h-auto w-36 dark:block" />
          </Link>
          <header className="mb-7"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></header>
          {children}
          <div className="mt-6 flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>Le credenziali e i permessi vengono verificati esclusivamente dal backend Doflow.</p>
          </div>
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#14204a_0%,#3030a8_48%,#7557df_100%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_25%),radial-gradient(circle_at_80%_70%,#8bdcff_0,transparent_30%)]" />
        <div className="relative flex items-center gap-2 text-sm font-medium"><LockKeyhole className="size-4" />Doflow Workspace</div>
        <div className="relative max-w-xl"><div className="text-4xl font-semibold leading-tight xl:text-5xl">{brandTitle}</div><p className="mt-4 max-w-lg text-base text-white/75">{brandDescription}</p></div>
        <p className="relative text-xs text-white/60">Accesso sicuro · sessione server-side</p>
      </section>
    </main>
  )
}
