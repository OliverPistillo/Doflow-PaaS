// apps/frontend/src/components/login-form.tsx
// Design: split editorial allineato a Doflow UI Review v2
// Logica auth: 100% invariata

"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Eye, EyeOff, Loader2, AlertCircle, Mail, Lock } from "lucide-react";

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
  const r = String(role ?? "")
    .toUpperCase()
    .replace(/[^A-Z_]/g, "");
  if (["OWNER", "SUPERADMIN", "SUPER_ADMIN"].includes(r)) return "SUPER_ADMIN";
  return "USER";
}

function isMfaPending(payload?: any) {
  return payload?.mfa_pending === true || payload?.authStage === "MFA_PENDING";
}

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'email è obbligatoria")
    .email("Inserisci un'email valida"),
  password: z.string().min(1, "La password è obbligatoria"),
  rememberMe: z.boolean().optional(),
});
type LoginFormValues = z.infer<typeof loginSchema>;

type LoginResponse = {
  token: string;
  error?: string;
  message?: string;
  mfa?: { required?: boolean; pending?: boolean; redirect?: string };
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

const SLIDES = [
  {
    tag: "CRM & Pipeline",
    title: "Tutto il tuo business\nin un unico posto.",
    desc: "Gestisci lead, opportunità e clienti con una pipeline visuale. Zero fogli Excel, zero caos.",
  },
  {
    tag: "Fatturazione automatica",
    title: "Preventivi e fatture\nin pochi secondi.",
    desc: "Genera documenti professionali, invia via email e tieni traccia dei pagamenti in automatico.",
  },
  {
    tag: "Analytics in tempo reale",
    title: "Dati chiari,\ndecisioni migliori.",
    desc: "Dashboard in tempo reale su vendite, performance e KPI. Tutte le metriche che contano davvero.",
  },
];

const STATS = [
  { value: "3x", label: "più veloce" },
  { value: "99.9%", label: "uptime" },
  { value: "24/7", label: "supporto" },
];

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [showTenantRedirect, setShowTenantRedirect] = React.useState(false);
  const [tenantRedirectUrl, setTenantRedirectUrl] = React.useState<
    string | null
  >(null);
  const [tenantDialogMode, setTenantDialogMode] = React.useState<
    "redirect" | "info"
  >("redirect");
  const [slideIdx, setSlideIdx] = React.useState(0);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

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
        window.location.href = goMfa
          ? `/${tenantSlug}/mfa`
          : `/${tenantSlug}/dashboard`;
      } else {
        window.location.href = goMfa ? `/mfa` : `/dashboard`;
      }
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(
      () => setSlideIdx((s) => (s + 1) % SLIDES.length),
      5000,
    );
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!showTenantRedirect || !tenantRedirectUrl) return;
    const t = setTimeout(() => {
      window.location.href = tenantRedirectUrl;
    }, 2000);
    return () => clearTimeout(t);
  }, [showTenantRedirect, tenantRedirectUrl]);

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
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          realm,
          tenantSlug: tenantSub ?? undefined,
        }),
      });
      if (data?.error) throw new Error(data.error || data.message);
      if (!data?.token) throw new Error("Token di accesso mancante");
      const token = data.token;
      const payload = parseJwtPayload(token);
      const role = normalizeRole(payload?.role);
      let targetTenant = "public";
      if (data.user?.schema || data.user?.tenantSlug || data.user?.tenant_id) {
        targetTenant = (
          data.user.schema ||
          data.user.tenantSlug ||
          data.user.tenant_id ||
          "public"
        ).toLowerCase();
      } else if (
        payload?.tenantSlug ||
        payload?.tenantId ||
        payload?.tenant_id
      ) {
        targetTenant = (
          payload.tenantSlug ||
          payload.tenantId ||
          payload.tenant_id ||
          "public"
        ).toLowerCase();
      }
      const mfaRequired = data?.mfa?.required === true || isMfaPending(payload);
      if (mfaRequired) {
        window.localStorage.setItem("doflow_token", token);
        if (isAppHost) {
          if (targetTenant !== "public" && /^[a-z0-9_]+$/i.test(targetTenant)) {
            setTenantRedirectUrl(
              `https://${targetTenant}.doflow.it/login?accessToken=${encodeURIComponent(token)}&next=mfa`,
            );
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
          setTenantRedirectUrl(
            `https://${targetTenant}.doflow.it/login?accessToken=${encodeURIComponent(token)}`,
          );
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

  const slide = SLIDES[slideIdx];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dfUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .df-a{animation:dfUp .45s ease both}
        .df-a1{animation-delay:.04s}.df-a2{animation-delay:.09s}.df-a3{animation-delay:.13s}
        .df-a4{animation-delay:.17s}.df-a5{animation-delay:.21s}.df-a6{animation-delay:.25s}.df-a7{animation-delay:.29s}
        @keyframes dfSlide { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
        .df-slide-anim{animation:dfSlide .5s ease both}
        .df-dot {
          height: 6px; border-radius: 999px; background: rgba(255,255,255,.2);
          transition: all .3s ease;
        }
        .df-dot.active {
          background: #fff; box-shadow: 0 0 8px rgba(255,255,255,.4);
        }
      `}} />

      {/* TENANT DIALOG */}
      <AlertDialog
        open={showTenantRedirect}
        onOpenChange={setShowTenantRedirect}
      >
        <AlertDialogContent className="max-w-[400px] df-glass-panel rounded-2xl p-6 border shadow-xl">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <AlertDialogTitle className="text-center text-[19px] font-bold tracking-tight">
              Reindirizzamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[14px] text-muted-foreground leading-relaxed mt-2">
              Stiamo preparando l'accesso al tuo workspace aziendale. Attendere
              prego...
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen doflow-app-frame flex items-center justify-center p-4 lg:p-6">
        <div className="w-full max-w-[1200px] df-glass-panel rounded-[32px] overflow-hidden">
          <div className="grid lg:grid-cols-2 min-h-[640px]">
            {/* LEFT — form area */}
            <div className="flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-20 relative z-10 bg-background/50 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none">
              <div className="w-full max-w-[400px] mx-auto space-y-6">
                <div className="df-a df-a1">
                  <Image
                    src="/doflow_logo.svg"
                    alt="Doflow"
                    width={110}
                    height={30}
                    className="h-7 w-auto dark:invert"
                  />
                </div>

                <div className="df-a df-a2 space-y-1">
                  <h1 className="text-3xl font-bold tracking-tight mb-2">
                    Bentornato
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Accedi per gestire il tuo workspace.
                  </p>
                </div>

                <div className="df-a df-a3 space-y-3">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-background border border-input shadow-sm text-sm font-medium hover:bg-secondary/50 transition-colors"
                    aria-label="Accedi con Google"
                    data-testid="login-google-btn"
                    onClick={() => {
                      const origin =
                        typeof window !== "undefined"
                          ? window.location.origin
                          : "";
                      window.location.href = `${origin}/api/auth/google`;
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
                      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
                    </svg>
                    Continua con Google
                  </button>
                  <div className="relative flex items-center py-4">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground uppercase tracking-widest">oppure con email</span>
                    <div className="flex-grow border-t border-border"></div>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-4"
                  noValidate
                >
                  <div className="df-a df-a4 grid gap-1.5">
                    <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                      <input
                        id="email"
                        type="email"
                        placeholder="nome@azienda.it"
                        disabled={isSubmitting}
                        className={cn(
                          "w-full h-11 pl-9 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
                          errors.email ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-input hover:border-muted-foreground/30"
                        )}
                        {...register("email")}
                        autoFocus
                      />
                    </div>
                    {errors.email && (
                      <p role="alert" className="text-[11px] text-destructive font-medium">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="df-a df-a5 grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Dimenticata?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="La tua password"
                        disabled={isSubmitting}
                        className={cn(
                          "w-full h-11 pl-9 pr-10 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
                          errors.password ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-input hover:border-muted-foreground/30"
                        )}
                        {...register("password")}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex">
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                              disabled={isSubmitting}
                              className="focus:outline-none p-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {showPassword ? "Nascondi password" : "Mostra password"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {errors.password && (
                      <p role="alert" className="text-[11px] text-destructive font-medium">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="df-a df-a5 flex items-center gap-2 mt-2">
                    <Controller
                      name="rememberMe"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="rememberMe"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      )}
                    />
                    <Label
                      htmlFor="rememberMe"
                      className="text-[13px] text-muted-foreground font-normal cursor-pointer select-none"
                    >
                      Ricordami per 30 giorni
                    </Label>
                  </div>

                  {generalError && (
                    <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive border border-destructive/20">
                      <AlertCircle size={15} className="shrink-0" aria-hidden />
                      <span>{generalError}</span>
                    </div>
                  )}

                  <div className="df-a df-a6 pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:bg-primary/90 transition-all hover:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                          Accesso in corso...
                        </>
                      ) : (
                        "Accedi"
                      )}
                    </button>
                  </div>
                </form>

                <div className="df-a df-a7 space-y-3 text-center mt-6">
                  <p className="text-[13px] text-muted-foreground">
                    Non hai un account?{" "}
                    <Link
                      href="/register"
                      className="font-semibold text-foreground hover:underline"
                    >
                      Registrati gratis
                    </Link>
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    Accedendo accetti i{" "}
                    <Link
                      href="/terms"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Termini
                    </Link>{" "}
                    e la{" "}
                    <Link
                      href="/privacy"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT — premium hero card */}
            <div className="hidden lg:flex relative overflow-hidden flex-col justify-center p-10 xl:p-14 df-page-hero rounded-none border-0 rounded-r-[32px]">
              <div className="absolute top-10 right-10 z-10">
                <Image
                  src="/doflow_logo.svg"
                  alt="Doflow"
                  width={130}
                  height={36}
                  className="h-9 w-auto brightness-0 invert opacity-80"
                />
              </div>
              <div className="max-w-[420px] mx-auto w-full space-y-12 relative z-10 mt-10">
                {/* Feature card */}
                <div className="space-y-6">
                  <div className="df-glass-panel rounded-2xl p-8 df-slide-anim border-0 bg-black/10" key={slideIdx}>
                    <span className="df-page-eyebrow mb-5">
                      {slide.tag}
                    </span>
                    <h2 className="text-[28px] font-bold text-white mb-4 whitespace-pre-line leading-[1.25] tracking-[-0.02em]">
                      {slide.title}
                    </h2>
                    <p className="text-[15px] text-white/70 leading-[1.6]">
                      {slide.desc}
                    </p>
                  </div>

                  {/* Dots */}
                  <div className="flex gap-2 items-center px-1">
                    {SLIDES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSlideIdx(i)}
                        aria-label={`Slide ${i + 1}`}
                        className={cn("df-dot", i === slideIdx && "active")}
                        style={{ width: i === slideIdx ? 22 : 6 }}
                      />
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div>
                  <p className="text-[11px] font-semibold tracking-wider uppercase text-white/50 mb-3">
                    I numeri di Doflow
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {STATS.map((s) => (
                      <div key={s.label} className="df-glass-panel border-0 bg-black/10 rounded-xl p-5 text-center">
                        <p className="text-2xl font-bold text-white leading-none">
                          {s.value}
                        </p>
                        <p className="text-[12px] text-white/60 mt-2">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}