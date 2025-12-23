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
      <div className="grid md:grid-cols-[1.05fr_0.95fr]">
        {/* FORM */}
        <div className="p-8 md:p-12">
          {/* Logo ONLY (no box, no square) */}
          <div className="flex items-center">
            <Image
              src="/doflow_logo.svg"
              alt="Doflow"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
          </div>

          <div className="mt-7 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Accedi</h1>
            <p className="text-sm text-muted-foreground">
              Inserisci le credenziali per continuare.{" "}
              <span className="font-mono">Tenant: {tenantHost || "..."}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 max-w-md">
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
                className="h-11"
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
                className="h-11"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Accesso…" : "Login"}
            </Button>

            <p className="text-[11px] text-muted-foreground">
              By clicking continue, you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>

        {/* COVER / CAROUSEL (FULL COVER) */}
        <div className="relative hidden md:block min-h-[640px] bg-muted">
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
                priority={i === 0}
                sizes="(min-width: 768px) 45vw, 0vw"
                className="object-cover"
              />
              {/* overlay leggero per evitare “sparaflash” */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
            </div>
          ))}

          {/* dots */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full ring-1 ring-white/40 transition",
                  i === slide ? "bg-white" : "bg-white/30 hover:bg-white/50"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
