// Percorso: apps/frontend/src/components/login-form.tsx
// Refactored 1:1 dal Figma — logica auth invariata, solo stile aggiornato
// Figma tokens applicati:
//   - card bg: #ffffff, radius 24px, shadow-card
//   - button: #3f8cff, radius 14px, shadow-button
//   - input: border radius 14px, h-12
//   - font: Nunito Sans Bold/SemiBold
//   - text primary: #0a1629, muted: #7d8592
//   - bg body: #f4f9fd

"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

// ── CONFIGURAZIONE (invariata) ────────────────────────────────────────────────
const MAIN_DB_NAME = "public";

type JwtPayload = {
  email?: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
  tenantSlug?: string;
  authStage?: string;
  mfa_pending?: boolean;
};

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase().replace(/[^A-Z_]/g, "");
  if (["OWNER", "SUPERADMIN", "SUPER_ADMIN"].includes(r)) return "SUPER_ADMIN";
  return "USER";
}

function isMfaPending(payload?: any) {
  return payload?.mfa_pending === true || payload?.authStage === "MFA_PENDING";
}

const SLIDES = [
  {
    src: "/login-cover-1.webp",
    alt: "Gestione semplificata",
    quote: "La piattaforma all-in-one per gestire il tuo business.",
    author: "Doflow Team",
  },
  {
    src: "/login-cover-2.webp",
    alt: "Analytics avanzati",
    quote: "Tieni traccia di ogni lead e ottimizza le conversioni.",
    author: "Performance Analytics",
  },
  {
    src: "/login-cover-3.webp",
    alt: "Automazione workflow",
    quote: "Automatizza i processi ripetitivi e risparmia tempo prezioso.",
    author: "Workflow Engine",
  },
] as const;

const loginSchema = z.object({
  email: z.string().min(1, "L'email è obbligatoria").email("Inserisci un'email valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type LoginResponse = {
  token: string;
  error?: string;
  message?: string;
  mfa?: {
    required?: boolean;
    pending?: boolean;
    redirect?: string;
  };
  user?: {
    tenantSlug?: string;
    tenant_id?: string;
    schema?: string;
    role?: string;
  };
};

function getHostContext() {
  const host =
    typeof window !== "undefined"
      ? window.location.hostname.toLowerCase()
      : "app.doflow.it";

  const isAppHost =
    host.startsWith("app.") ||
    host.startsWith("admin.") ||
    host === "doflow.it" ||
    host.includes("localhost");

  const subdomain = host.endsWith(".doflow.it")
    ? host.replace(".doflow.it", "").split(".")[0]
    : null;

  const tenantSub =
    !isAppHost &&
    subdomain &&
    !["app", "admin", "api", "www"].includes(subdomain)
      ? subdomain
      : null;

  return { host, isAppHost, tenantSub };
}

// ── LoginForm Component ───────────────────────────────────────────────────────

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [slide, setSlide] = React.useState(0);
  const [showTenantRedirect, setShowTenantRedirect] = React.useState(false);
  const [tenantRedirectUrl, setTenantRedirectUrl] = React.useState<string | null>(null);
  const [tenantDialogMode, setTenantDialogMode] = React.useState<"redirect" | "info">("redirect");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // ── Effetti (invariati) ───────────────────────────────────────────────────
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("accessToken");
    if (tokenFromUrl) {
      window.localStorage.removeItem("doflow_token");
      window.localStorage.setItem("doflow_token", tokenFromUrl);
      const payload = parseJwtPayload(tokenFromUrl);
      const tenantSlug = payload?.tenantSlug || payload?.tenantId;
      const next = (params.get("next") || "").toLowerCase();
      const goMfa = next === "mfa" || isMfaPending(payload);
      if (tenantSlug && tenantSlug !== "public") {
        window.location.href = goMfa ? `/${tenantSlug}/mfa` : `/${tenantSlug}/dashboard`;
      } else {
        window.location.href = goMfa ? `/mfa` : `/dashboard`;
      }
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!showTenantRedirect || !tenantRedirectUrl) return;
    const t = setTimeout(() => {
      window.location.href = tenantRedirectUrl;
    }, 2000);
    return () => clearTimeout(t);
  }, [showTenantRedirect, tenantRedirectUrl]);

  // ── Submit (invariato) ────────────────────────────────────────────────────
  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);
    const { isAppHost, tenantSub } = getHostContext();
    const realm = isAppHost ? "platform" : "tenant";

    try {
      const headers: Record<string, string> = {};
      if (isAppHost) headers["x-doflow-tenant-id"] = MAIN_DB_NAME;

      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        headers,
        body: JSON.stringify({ ...values, realm, tenantSlug: tenantSub ?? undefined }),
      });

      if (data?.error) throw new Error(data.error || data.message);
      if (!data?.token) throw new Error("Token di accesso mancante");

      const token = data.token;
      const payload = parseJwtPayload(token);
      const role = normalizeRole(payload?.role);

      let targetTenant = "public";
      if (data.user?.schema || data.user?.tenantSlug || data.user?.tenant_id) {
        targetTenant = (data.user.schema || data.user.tenantSlug || data.user.tenant_id || "public").toLowerCase();
      } else if (payload?.tenantSlug || payload?.tenantId || payload?.tenant_id) {
        targetTenant = (payload.tenantSlug || payload.tenantId || payload.tenant_id || "public").toLowerCase();
      }

      const mfaRequired = data?.mfa?.required === true || isMfaPending(payload);
      if (mfaRequired) {
        window.localStorage.setItem("doflow_token", token);
        if (isAppHost) {
          if (targetTenant !== "public" && /^[a-z0-9_]+$/i.test(targetTenant)) {
            const safeToken = encodeURIComponent(token);
            setTenantRedirectUrl(`https://${targetTenant}.doflow.it/login?accessToken=${safeToken}&next=mfa`);
            setTenantDialogMode("redirect");
            setShowTenantRedirect(true);
            return;
          }
          router.push(`/mfa`);
          return;
        }
        router.push(tenantSub ? `/${tenantSub}/mfa` : `/mfa`);
        return;
      }

      if (role === "SUPER_ADMIN") {
        window.localStorage.setItem("doflow_token", token);
        router.push("/superadmin");
        return;
      }

      if (isAppHost) {
        if (targetTenant !== "public" && /^[a-z0-9_]+$/i.test(targetTenant)) {
          const safeToken = encodeURIComponent(token);
          setTenantRedirectUrl(`https://${targetTenant}.doflow.it/login?accessToken=${safeToken}`);
          setTenantDialogMode("redirect");
          setShowTenantRedirect(true);
          return;
        }
        window.localStorage.setItem("doflow_token", token);
        router.push("/dashboard");
        return;
      }

      window.localStorage.setItem("doflow_token", token);
      router.push(tenantSub ? `/${tenantSub}/dashboard` : "/dashboard");
    } catch (err: any) {
      setGeneralError(err?.message || "Si è verificato un errore imprevisto.");
    }
  };

  return (
    <>
      {/* ── Redirect Dialog ─────────────────────────────────────────────── */}
      <AlertDialog open={showTenantRedirect} onOpenChange={setShowTenantRedirect}>
        <AlertDialogContent className="rounded-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-bold">
              Accesso al dominio aziendale
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[16px]">
              {tenantDialogMode === "redirect" ? (
                <>
                  Accesso effettuato correttamente.
                  <br />
                  Ti stiamo reindirizzando al tuo spazio di lavoro aziendale.
                  <div className="flex items-center gap-2 mt-4 p-3 bg-figma-gray rounded-nav text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Reindirizzamento in corso...</span>
                  </div>
                </>
              ) : (
                <>
                  Questo account appartiene a un tenant aziendale.
                  <br />
                  Per continuare, accedi dal dominio della tua azienda.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!tenantRedirectUrl && (
              <AlertDialogAction onClick={() => setShowTenantRedirect(false)}>
                Ok
              </AlertDialogAction>
            )}
            {tenantRedirectUrl && (
              <AlertDialogAction onClick={() => window.location.href = tenantRedirectUrl!}>
                Vai ora
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Login Card ──────────────────────────────────────────────────── */}
      {/*
        Figma: Card at root = elm/card/main
          • bg: #ffffff
          • border-radius: 24px  (rounded-card)
          • shadow: 0px 6px 58px rgba(196,203,214,0.10)  (shadow-card)
          • no visible border
      */}
      <Card className="mx-auto w-full max-w-[1100px] overflow-hidden border-none">
        <div className="grid min-h-[680px] lg:grid-cols-2">

          {/* ── Form Panel ──────────────────────────────────────────────── */}
          <div className="flex flex-col justify-center bg-card px-8 py-12 md:px-12 lg:px-16">
            <div className="mx-auto w-full max-w-[360px] space-y-8">

              {/* Brand */}
              <div className="flex flex-col items-center space-y-3 text-center">
                <Image
                  src="/doflow_logo.svg"
                  alt="Doflow"
                  width={120}
                  height={40}
                  className="mb-2 h-10 w-auto object-contain"
                  priority
                />
                {/* Figma: Bold 22px #0a1629 */}
                <h1 className="text-[22px] font-bold tracking-tight text-foreground">
                  Bentornato
                </h1>
                {/* Figma: Regular 16px #7d8592 */}
                <p className="text-[16px] text-muted-foreground">
                  Inserisci le tue credenziali per accedere.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

                {/* Email */}
                <div className="grid gap-2">
                  <Label
                    htmlFor="email"
                    className="text-[14px] font-bold text-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@azienda.it"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className={cn(
                      errors.email && "border-destructive focus-visible:ring-destructive"
                    )}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p
                      id="email-error"
                      role="alert"
                      className="text-[12px] font-semibold text-destructive"
                    >
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-[14px] font-bold text-foreground"
                    >
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-[14px] font-semibold text-primary hover:underline"
                    >
                      Dimenticata?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      className={cn(
                        "pr-12",
                        errors.password && "border-destructive focus-visible:ring-destructive"
                      )}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isSubmitting}
                      aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    >
                      {showPassword
                        ? <EyeOff size={18} aria-hidden="true" />
                        : <Eye size={18} aria-hidden="true" />
                      }
                    </button>
                  </div>
                  {errors.password && (
                    <p
                      id="password-error"
                      role="alert"
                      className="text-[12px] font-semibold text-destructive"
                    >
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Error banner */}
                {generalError && (
                  <div
                    role="alert"
                    className="flex items-center gap-3 rounded-nav bg-destructive/10 px-4 py-3 text-[14px] text-destructive border border-destructive/20"
                  >
                    <AlertCircle size={16} aria-hidden="true" className="shrink-0" />
                    <span>{generalError}</span>
                  </div>
                )}

                {/* Submit — Figma: elm/button/mainbutton h-12 shadow-button */}
                <Button
                  type="submit"
                  className="w-full"
                  size="default"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      In corso...
                    </>
                  ) : (
                    "Accedi"
                  )}
                </Button>
              </form>

              {/* Legal */}
              <p className="text-center text-[12px] text-muted-foreground leading-relaxed">
                Cliccando su Accedi, accetti i nostri{" "}
                <Link href="/terms" className="underline underline-offset-4 hover:text-primary font-semibold">
                  Termini
                </Link>{" "}
                e la{" "}
                <Link href="/privacy" className="underline underline-offset-4 hover:text-primary font-semibold">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>

          {/* ── Slider Panel ────────────────────────────────────────────── */}
          {/*
            Figma: right panel is a rich visual area
            bg-figma-gray matches the body background for seamless bleed
          */}
          <div className="relative hidden lg:block bg-figma-blue overflow-hidden">
            {SLIDES.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "absolute inset-0 transition-opacity duration-1000 ease-in-out",
                  i === slide ? "opacity-100 z-10" : "opacity-0 z-0"
                )}
                aria-hidden={i !== slide}
              >
                <Image
                  src={s.src}
                  alt={s.alt}
                  fill
                  priority={i === 0}
                  className="object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Quote */}
                <div className="absolute bottom-0 left-0 p-12 text-white w-full">
                  <blockquote className="text-[18px] font-semibold leading-relaxed italic">
                    &ldquo;{s.quote}&rdquo;
                  </blockquote>
                  <p className="mt-4 text-[14px] font-bold text-white/80">
                    — {s.author}
                  </p>

                  {/* Slide dots */}
                  <div className="flex items-center gap-2 mt-6" role="tablist" aria-label="Slide indicators">
                    {SLIDES.map((_, di) => (
                      <button
                        key={di}
                        role="tab"
                        aria-selected={di === slide}
                        aria-label={`Slide ${di + 1}`}
                        onClick={() => setSlide(di)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          di === slide ? "w-6 bg-white" : "w-1.5 bg-white/40"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}