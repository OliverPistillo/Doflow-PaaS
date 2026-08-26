"use client"

import Image from "next/image"
import Link from "next/link"
import { CircleCheck, FolderKanban, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"

type LoginExperienceProps = {
  mascotShy?: boolean
  children: React.ReactNode
}

const FLOW = [
  { label: "Lead e clienti", icon: UsersRound },
  { label: "Progetti e attività", icon: FolderKanban },
  { label: "Controllo e consegna", icon: CircleCheck },
]

export function LoginExperience({ children }: LoginExperienceProps) {
  return (
    <main data-auth-ui="universal" className="relative grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
        <ThemeToggle />
      </div>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <Link href="/" aria-label="Vai alla home Doflow" className="inline-flex">
            <Image src="/logo_doflow_nero.png" alt="Doflow" width={142} height={32} priority className="mb-10 h-auto w-36 dark:hidden" />
            <Image src="/logo_doflow_bianco.png" alt="Doflow" width={142} height={32} priority className="mb-10 hidden h-auto w-36 dark:block" />
          </Link>
          <header className="mb-7">
            <h1 className="text-3xl font-semibold tracking-tight">Accedi a Doflow</h1>
            <p className="mt-2 text-sm text-muted-foreground">Workspace operativo per commerciale, produzione e amministrazione.</p>
          </header>
          {children}
          <div className="mt-6 flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>Sessione protetta, autenticazione a più fattori e autorizzazioni verificate dal server.</p>
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#14204a_0%,#3030a8_48%,#7557df_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_25%),radial-gradient(circle_at_80%_70%,#8bdcff_0,transparent_30%)]" />
        <div className="relative flex items-center gap-2 text-sm font-medium"><LockKeyhole className="size-4" />Doflow Workspace</div>
        <div className="relative max-w-xl">
          <p className="text-4xl font-semibold leading-tight xl:text-5xl">Dal primo contatto alla consegna, tutto nello stesso flusso.</p>
          <p className="mt-4 max-w-lg text-base text-white/75">Dati commerciali, attività, progetti e amministrazione con autorizzazioni coerenti.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {FLOW.map(({ label, icon: Icon }) => (
              <div key={label} data-semantic-color-exception="brand-art" className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <Icon className="mb-5 size-5 text-white/85" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/60">Doflow · ambiente operativo protetto</p>
      </section>
    </main>
  )
}
