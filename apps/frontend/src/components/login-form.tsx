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

// --- CONFIGURAZIONE ---
const MAIN_DB_NAME = "public";

type JwtPayload = {
  email?: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
  tenantSlug?: string;
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
  user?: { 
    tenantSlug?: string;
    tenant_id?: string;
    schema?: string;
    role?: string;
  }
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

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [slide, setSlide] = React.useState(0);

  // Stati per il redirect tenant
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

  // 1. ACCHIAPPA TOKEN (Gestione arrivo sul tenant corretto)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("accessToken"); // URLSearchParams decodifica automaticamente
    if (tokenFromUrl) {
      window.localStorage.removeItem("doflow_token");
      console.log("🔄 Token rilevato nell'URL. Login automatico...");
      window.localStorage.setItem("doflow_token", tokenFromUrl);
      
      // Redirect pulito per rimuovere il token dall'URL
      window.location.href = "/dashboard";
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  // Redirect automatico
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
      if (isAppHost) {
        headers['x-doflow-tenant-id'] = MAIN_DB_NAME;
      }

      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        headers, 
        body: JSON.stringify({
          ...values,
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
          targetTenant = (data.user.schema || data.user.tenantSlug || data.user.tenant_id || "public").toLowerCase();
      } else if (payload?.tenantSlug || payload?.tenantId || payload?.tenant_id) {
          targetTenant = (payload.tenantSlug || payload.tenantId || payload.tenant_id || "public").toLowerCase();
      }

      console.log(`🔍 Login Check: Ruolo [${role}], Tenant Rilevato [${targetTenant}]`);

      // 1. SUPERADMIN -> Sempre su /superadmin
      if (role === "SUPER_ADMIN") {
        window.localStorage.setItem("doflow_token", token);
        router.push("/superadmin");
        return;
      }

      // 2. REDIRECT TENANT DA APP/ADMIN
      if (isAppHost) {
        if (targetTenant !== "public" && /^[a-z0-9_]+$/i.test(targetTenant)) {
          
          // 🔥 FIX CRITICO: encodeURIComponent
          // Questo assicura che caratteri come '+' nel token non vengano persi nel redirect
          const safeToken = encodeURIComponent(token);
          const redirectUrl = `https://${targetTenant}.doflow.it/login?accessToken=${safeToken}`;
          
          setTenantRedirectUrl(redirectUrl);
          setTenantDialogMode("redirect");
          setShowTenantRedirect(true);
          return;
        } 
        
        console.warn("⚠️ Attenzione: Utente loggato su App ma il tenant risulta 'public'.");
        window.localStorage.setItem("doflow_token", token);
        router.push("/dashboard");
        return;
      }

      // 3. UTENTE GIÀ SUL TENANT
      window.localStorage.setItem("doflow_token", token);
      if (tenantSub) {
        router.push(`/${tenantSub}/dashboard`);
        return;
      }

      router.push("/dashboard");
      
    } catch (err: any) {
      setGeneralError(err?.message || "Si è verificato un errore imprevisto.");
    }
  };

  return (
    <>
      <AlertDialog open={showTenantRedirect} onOpenChange={setShowTenantRedirect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accesso al dominio aziendale</AlertDialogTitle>
            <AlertDialogDescription>
              {tenantDialogMode === "redirect" ? (
                <>
                  Accesso effettuato correttamente.
                  <br />
                  Ti stiamo reindirizzando al tuo spazio di lavoro aziendale.
                  <br />
                  {/* Nascondiamo l'URL brutto, mostriamo solo un'indicazione visiva */}
                  <div className="flex items-center gap-2 mt-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> 
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
            {/* Nascondiamo il bottone "OK" durante il redirect automatico per pulizia */}
            {!tenantRedirectUrl && (
                <AlertDialogAction onClick={() => setShowTenantRedirect(false)}>
                Ok
                </AlertDialogAction>
            )}
            {/* Bottone di emergenza se il redirect automatico fallisse */}
            {tenantRedirectUrl && (
                <AlertDialogAction onClick={() => window.location.href = tenantRedirectUrl!}>
                Vai ora
                </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mx-auto w-full max-w-[1100px] overflow-hidden border-none shadow-2xl sm:border sm:border-border">
        <div className="grid min-h-[650px] lg:grid-cols-2">
          <div className="flex flex-col justify-center bg-card p-8 md:p-12 lg:p-16">
            <div className="mx-auto w-full max-w-[350px] space-y-8">
              <div className="flex flex-col items-center space-y-2 text-center">
                <Image
                  src="/doflow_logo.svg"
                  alt="Doflow"
                  width={120}
                  height={40}
                  className="mb-4 h-10 w-auto object-contain"
                  priority
                />
                <h1 className="text-2xl font-bold tracking-tight">Bentornato</h1>
                <p className="text-sm text-muted-foreground">
                  Inserisci le tue credenziali per accedere.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@azienda.it"
                    disabled={isSubmitting}
                    className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-[11px] font-medium text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-primary hover:underline"
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
                      className={cn("pr-10", errors.password && "border-destructive")}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[11px] font-medium text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {generalError && (
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                    <AlertCircle size={16} />
                    <span>{generalError}</span>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> In corso...
                    </>
                  ) : (
                    "Accedi"
                  )}
                </Button>
              </form>

              <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
                Cliccando su Accedi, accetti i nostri{" "}
                <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
                  Termini
                </Link>{" "}
                e la{" "}
                <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="relative hidden lg:block bg-muted overflow-hidden">
            {SLIDES.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "absolute inset-0 transition-opacity duration-1000 ease-in-out",
                  i === slide ? "opacity-100 z-10" : "opacity-0 z-0",
                )}
              >
                <Image
                  src={s.src}
                  alt={s.alt}
                  fill
                  priority={i === 0}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-12 text-white w-full">
                  <blockquote className="text-lg font-medium leading-relaxed italic">
                    &ldquo;{s.quote}&rdquo;
                  </blockquote>
                  <p className="mt-4 text-sm font-semibold text-white/80">
                    — {s.author}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}