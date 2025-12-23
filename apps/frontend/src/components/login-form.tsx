// apps/frontend/src/components/login-form.tsx
"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type LoginOkResponse = { token: string }
type LoginErrorResponse = { error: string }
type LoginResponse = LoginOkResponse | LoginErrorResponse

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.doflow.it"

const SLIDES = [
  { src: "/login-cover-1.webp", alt: "Doflow cover 1" },
  { src: "/login-cover-2.webp", alt: "Doflow cover 2" },
  { src: "/login-cover-3.webp", alt: "Doflow cover 3" },
] as const

function getHost(): string {
  if (typeof window === "undefined") return ""
  return window.location.host
}

export function LoginForm() {
  const router = useRouter()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [tenantHost, setTenantHost] = React.useState("")
  const [slide, setSlide] = React.useState(0)

  React.useEffect(() => {
    setTenantHost(getHost())
  }, [])

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % SLIDES.length)
    }, 4500)
    return () => window.clearInterval(id)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      })

      const text = await res.text()

      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const json = JSON.parse(text) as Partial<LoginErrorResponse>
          if (json?.error) msg = json.error
        } catch {}
        throw new Error(msg)
      }

      const data = JSON.parse(text) as LoginResponse
      if ("error" in data) throw new Error(data.error)
      if (!("token" in data) || !data.token) throw new Error("Token mancante nella risposta")

      window.localStorage.setItem("doflow_token", data.token)
      router.push("/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore di rete")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-2">
        {/* FORM */}
        <div className="p-6 md:p-8">
          {/* Logo ONLY (no text) */}
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
              <Image
                src="/doflow_logo.svg"
                alt="Doflow"
                width={26}
                height={26}
                className="h-[26px] w-[26px]"
                priority
              />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Accedi</h1>
            <p className="text-sm text-muted-foreground">
              Inserisci le credenziali per continuare.{" "}
              <span className="font-mono">Tenant: {tenantHost || "..."}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nome@azienda.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => router.push("/forgot-password")}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Recupera password
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso…" : "Login"}
            </Button>

            <p className="text-[11px] text-muted-foreground">
              By clicking continue, you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>

        {/* COVER / CAROUSEL */}
        <div className="relative hidden md:block overflow-hidden bg-muted">
          {/* Background blur della slide corrente (riempie, ma sotto) */}
          <div className="absolute inset-0">
            {SLIDES.map((s, i) => (
              <Image
                key={`bg-${s.src}`}
                src={s.src}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 0vw"
                className={cn(
                  "object-cover blur-2xl scale-110 opacity-0 transition-opacity duration-700",
                  i === slide ? "opacity-40" : "opacity-0"
                )}
                priority={i === 0}
              />
            ))}
          </div>

          {/* Foreground: RISPOSTA ALLE “PROPORZIONI” -> object-contain (zero crop) */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="relative h-full w-full">
              {SLIDES.map((s, i) => (
                <div
                  key={s.src}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-700",
                    i === slide ? "opacity-100" : "opacity-0"
                  )}
                >
                  <Image
                    src={s.src}
                    alt={s.alt}
                    fill
                    sizes="(min-width: 768px) 50vw, 0vw"
                    className="object-contain"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Overlay leggero per “coerenza” */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />

          {/* Dots */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full border bg-background/70 px-3 py-2 backdrop-blur">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full ring-1 ring-foreground/20 transition",
                  i === slide ? "bg-foreground/70" : "bg-foreground/20 hover:bg-foreground/35"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
