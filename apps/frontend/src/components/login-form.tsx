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
import { apiFetch } from "@/lib/api"

import { Eye, EyeOff } from "lucide-react"

type LoginOkResponse = { token: string }
type LoginErrorResponse = { error: string }
type LoginResponse = LoginOkResponse | LoginErrorResponse

const SLIDES = [
  { src: "/login-cover-1.webp", alt: "Doflow cover 1" },
  { src: "/login-cover-2.webp", alt: "Doflow cover 2" },
  { src: "/login-cover-3.webp", alt: "Doflow cover 3" },
] as const

type JwtPayload = { email?: string; role?: string; tenantId?: string; tenant_id?: string }

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase().replace(/[^A-Z_]/g, "")
  // accetta SUPER_ADMIN / SUPERADMIN / OWNER ecc
  if (r === "OWNER" || r === "SUPERADMIN" || r === "SUPER_ADMIN") return "SUPER_ADMIN"
  if (r === "ADMIN") return "ADMIN"
  if (r === "MANAGER") return "MANAGER"
  return "USER"
}

function getTenantFromPayload(p: JwtPayload | null) {
  const t = (p?.tenantId ?? p?.tenant_id ?? "public").toString().trim().toLowerCase()
  return t || "public"
}

export function LoginForm() {
  const router = useRouter()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [slide, setSlide] = React.useState(0)

  React.useEffect(() => {
    const id = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4500)
    return () => window.clearInterval(id)
  }, [])

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  setShowPassword(false);
  setError(null);
  setLoading(true);

  function parseJwtPayload(token: string): { tenantId?: string; role?: string } | null {
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json) as { tenantId?: string; role?: string };
    } catch {
      return null;
    }
  }

  try {
    // NB: niente auth qui, ovvio
    const data = await apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    });

    if ("error" in data) throw new Error(data.error);
    if (!("token" in data) || !data.token) throw new Error("Token mancante nella risposta");

    window.localStorage.setItem("doflow_token", data.token);

    const payload = parseJwtPayload(data.token);
    const role = (payload?.role || "").toUpperCase();
    const tenantId = (payload?.tenantId || "public").toLowerCase();

    // ✅ routing richiesto
    if (role === "SUPER_ADMIN") {
      router.push("/superadmin"); // vecchio pannello
      return;
    }

    // tutti gli altri: tenant dashboard diretta
    if (tenantId && tenantId !== "public") {
      router.push(`/${tenantId}/dashboard`);
      return;
    }

    // fallback
    router.push("/dashboard");
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "Errore di rete");
  } finally {
    setLoading(false);
  }
}


  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-[1.05fr_0.95fr]">
        <div className="p-8 md:p-12">
          <div className="flex items-center">
            <Image
              src="/doflow_logo.svg"
              alt="Doflow"
              width={96}
              height={96}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>

          <div className="mt-7 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Accedi</h1>
            <p className="text-sm text-muted-foreground">Inserisci le credenziali per continuare.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="es. nome@azienda.it"
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

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
