"use client";

import * as React from "react";
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
  getTenantLoginUrl,
  isInternalDoflowTenant,
  normalizeTenantSlug,
} from "@/lib/tenant-url";

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

  if (["SUPERADMIN", "SUPER_ADMIN"].includes(r)) return "SUPER_ADMIN";
  if (["OWNER", "ADMIN"].includes(r)) return "ADMIN";
  if (r === "MANAGER") return "MANAGER";

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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

type LoginPanelProps = {
  onMascotShyChange?: (shy: boolean) => void;
  onSwitchToRegister?: () => void;
};

export function LoginPanel({ onMascotShyChange, onSwitchToRegister }: LoginPanelProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [showTenantRedirect, setShowTenantRedirect] = React.useState(false);
  const [tenantRedirectUrl, setTenantRedirectUrl] = React.useState<string | null>(null);
  const [tenantDialogMode, setTenantDialogMode] = React.useState<"redirect" | "info">("redirect");

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
    return () => onMascotShyChange?.(false);
  }, [onMascotShyChange]);

  React.useEffect(() => {
    onMascotShyChange?.(passwordFocused && !showPassword);
  }, [passwordFocused, showPassword, onMascotShyChange]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("accessToken");
    if (tokenFromUrl) {
      window.localStorage.removeItem("doflow_token");
      window.localStorage.setItem("doflow_token", tokenFromUrl);
      const payload = parseJwtPayload(tokenFromUrl);
      const tenantSlug = normalizeTenantSlug(payload?.tenantSlug || payload?.tenantId || payload?.tenant_id);
      const next = (params.get("next") || "").toLowerCase();
      const goMfa = next === "mfa" || isMfaPending(payload);
      if (tenantSlug && tenantSlug !== "public") {
        const tenantPath = isInternalDoflowTenant(tenantSlug) ? "" : `/${tenantSlug}`;
        window.location.href = goMfa
          ? `${tenantPath}/mfa`
          : `${tenantPath}/dashboard`;
      } else {
        window.location.href = goMfa ? `/mfa` : `/dashboard`;
      }
    }
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
      } else if (payload?.tenantSlug || payload?.tenantId || payload?.tenant_id) {
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
            if (isInternalDoflowTenant(targetTenant)) {
              router.push("/mfa");
              return;
            }
            setTenantRedirectUrl(getTenantLoginUrl(targetTenant, token, "mfa"));
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
          if (isInternalDoflowTenant(targetTenant)) {
            window.localStorage.setItem("doflow_token", token);
            router.push("/dashboard");
            return;
          }
          setTenantRedirectUrl(getTenantLoginUrl(targetTenant, token));
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
      <AlertDialog open={showTenantRedirect} onOpenChange={setShowTenantRedirect}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-bold">
              Accesso al dominio aziendale
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px]">
              {tenantDialogMode === "redirect" ? (
                <>
                  Accesso effettuato. Ti stiamo reindirizzando al tuo spazio aziendale.
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Reindirizzamento in corso...</span>
                  </div>
                </>
              ) : (
                <>Questo account appartiene a un tenant aziendale. Accedi dal dominio della tua azienda.</>
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
              <AlertDialogAction onClick={() => (window.location.href = tenantRedirectUrl!)}>
                Vai ora
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="df-auth-form">
        <button
          type="button"
          className="df-auth-social"
          aria-label="Accedi con Google"
          data-testid="login-google-btn"
          onClick={() => {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
            const origin = apiBase.replace(/\/api\/?$/, "");
            window.location.href = `${origin}/api/auth/google`;
          }}
        >
          <GoogleIcon />
          Continua con Google
        </button>

        <div className="df-auth-divider">oppure</div>

        <form onSubmit={handleSubmit(onSubmit)} className="df-auth-form" noValidate>
          <div className="df-auth-field">
            <Label htmlFor="email" className="df-auth-label">
              Email
            </Label>
            <div className="df-auth-input-wrap">
              <input
                id="email"
                type="email"
                placeholder="nome@azienda.it"
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                className={cn("df-auth-input no-right", errors.email && "err")}
                {...register("email")}
                autoFocus
              />
              <Mail className="df-auth-field-icon" aria-hidden="true" />
            </div>
            {errors.email && (
              <p role="alert" className="df-auth-help">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="df-auth-field">
            <div className="df-auth-row">
              <Label htmlFor="password" className="df-auth-label">
                Password
              </Label>
              <Link href="/forgot-password" className="df-auth-link text-[12px]">
                Password dimenticata?
              </Link>
            </div>
            <div className="df-auth-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-invalid={!!errors.password}
                className={cn("df-auth-input", errors.password && "err")}
                {...register("password")}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <Lock className="df-auth-field-icon" aria-hidden="true" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isSubmitting}
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    className="df-auth-password-toggle"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {showPassword ? "Nascondi password" : "Mostra password"}
                </TooltipContent>
              </Tooltip>
            </div>
            {errors.password && (
              <p role="alert" className="df-auth-help">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="df-auth-row">
            <div className="df-auth-check-row">
              <Controller
                name="rememberMe"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="rememberMe"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={isSubmitting}
                  />
                )}
              />
              <Label htmlFor="rememberMe" className="cursor-pointer text-[13px]">
                Ricordami
              </Label>
            </div>
          </div>

          {generalError && (
            <div role="alert" className="df-auth-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{generalError}</span>
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="df-auth-submit">
            <span className="df-auth-button-content">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Accesso in corso...
                </>
              ) : (
                "Accedi al flusso"
              )}
            </span>
          </button>
        </form>

        <div className="df-auth-foot">
          Non hai un account?{" "}
          {onSwitchToRegister ? (
            <button type="button" className="df-auth-inline-action" onClick={onSwitchToRegister}>
              Creane uno
            </button>
          ) : (
            <Link href="/register">Creane uno</Link>
          )}
        </div>
      </div>
    </>
  );
}
