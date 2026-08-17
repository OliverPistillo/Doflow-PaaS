"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getTenantLoginUrl } from "@/lib/tenant-url";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  User,
  Building2,
  Check,
} from "lucide-react";

const registerSchema = z
  .object({
    name: z.string().min(2, "Inserisci il tuo nome"),
    company: z.string().min(2, "Inserisci il nome dell'azienda"),
    slug: z
      .string()
      .min(3, "Minimo 3 caratteri")
      .max(30, "Massimo 30 caratteri")
      .regex(/^[a-z0-9-]+$/, "Usa lettere minuscole, numeri e trattini"),
    email: z
      .string()
      .min(1, "L'email è obbligatoria")
      .email("Inserisci un'email valida"),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    googleSignupToken: z.string().optional(),
    acceptTerms: z.boolean().refine((v) => v === true, "Devi accettare i termini"),
  })
  .superRefine((data, ctx) => {
    if (!data.googleSignupToken && (data.password || "").length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimo 8 caratteri", path: ["password"] });
    }
    if (!data.googleSignupToken && data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le password non coincidono", path: ["confirmPassword"] });
    }
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

type RegisterPanelProps = {
  onMascotShyChange?: (shy: boolean) => void;
  onSwitchToLogin?: () => void;
};

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

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return {
    width: [0, 25, 50, 75, 100][score],
    color: ["transparent", "hsl(var(--destructive))", "hsl(var(--chart-3))", "hsl(var(--primary))", "var(--df-success)"][score],
  };
}

export function RegisterPanel({ onMascotShyChange, onSwitchToLogin }: RegisterPanelProps) {
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [slugMessage, setSlugMessage] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      company: "",
      slug: "",
      email: "",
      password: "",
      confirmPassword: "",
      googleSignupToken: "",
      acceptTerms: false,
    },
  });

  React.useEffect(() => {
    return () => onMascotShyChange?.(false);
  }, [onMascotShyChange]);

  React.useEffect(() => {
    onMascotShyChange?.(passwordFocused && !(showPwd || showConfirm));
  }, [passwordFocused, showPwd, showConfirm, onMascotShyChange]);

  React.useEffect(() => {
    const exchangeGoogleHandoff = async () => {
      const params = new URLSearchParams(window.location.search);
      const handoff = params.get("handoff");
      if (!handoff) return;
      window.history.replaceState({}, "", window.location.pathname);
      try {
        const result = await apiFetch<{
          kind: "google_signup";
          googleSignupToken: string;
          email: string;
          fullName?: string;
        }>("/auth/handoff/exchange", {
          method: "POST",
          auth: false,
          body: JSON.stringify({ handoff, tenantTarget: "public" }),
        });
        if (result.kind !== "google_signup") throw new Error();
        setValue("googleSignupToken", result.googleSignupToken);
        setValue("email", result.email);
        if (result.fullName) setValue("name", result.fullName);
      } catch {
        setGeneralError("La sessione Google è scaduta. Ripeti la registrazione.");
      }
    };
    void exchangeGoogleHandoff();
  }, [setValue]);

  const company = watch("company");
  const slug = watch("slug");
  const googleSignupToken = watch("googleSignupToken");
  React.useEffect(() => {
    if (slugEdited) return;
    const generated = String(company || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    setValue("slug", generated, { shouldValidate: generated.length >= 3 });
  }, [company, setValue, slugEdited]);

  React.useEffect(() => {
    const normalized = String(slug || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(normalized)) {
      setSlugStatus("idle");
      setSlugMessage("");
      return;
    }
    setSlugStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiFetch<{ available: boolean; reason?: string }>(
          `/auth/check-slug?slug=${encodeURIComponent(normalized)}`,
          { auth: false },
        );
        setSlugStatus(result.available ? "available" : "unavailable");
        setSlugMessage(result.available ? "Indirizzo disponibile" : result.reason || "Indirizzo non disponibile");
      } catch {
        setSlugStatus("idle");
        setSlugMessage("");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [slug]);

  const pwd = watch("password") || "";
  const strength = passwordStrength(pwd);

  const onSubmit = async (values: RegisterFormValues) => {
    setGeneralError(null);
    try {
      if (slugStatus !== "available") {
        setGeneralError("Scegli un indirizzo aziendale disponibile.");
        return;
      }
      const result = await apiFetch<{
        token: string;
        tenant: { slug: string };
      }>("/auth/signup-tenant", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          fullName: values.name,
          companyName: values.company,
          slug: values.slug.toLowerCase(),
          email: values.email,
          password: values.googleSignupToken ? undefined : values.password,
          googleSignupToken: values.googleSignupToken || undefined,
          acceptTerms: values.acceptTerms,
        }),
      });
      const handoff = await apiFetch<{ handoff: string }>("/auth/handoff", {
        method: "POST",
        auth: false,
        headers: { Authorization: `Bearer ${result.token}` },
        body: JSON.stringify({
          tenantTarget: result.tenant.slug,
          rememberMe: true,
          next: "onboarding",
        }),
      });
      setSuccess(true);
      window.location.href = getTenantLoginUrl(result.tenant.slug, handoff.handoff);
    } catch (err: any) {
      setGeneralError(err?.message || "Errore durante la registrazione.");
    }
  };

  if (success) {
    return (
      <div className="df-auth-success">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15">
          <Check size={24} aria-hidden="true" />
        </div>
        <p className="text-[16px] font-extrabold">Account creato con successo.</p>
        <p className="mt-1 text-[13px] opacity-80">Stiamo aprendo il tuo spazio aziendale.</p>
      </div>
    );
  }

  return (
    <div className="df-auth-form">
      <button
        type="button"
        className="df-auth-social"
        aria-label="Registrati con Google"
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
          <Label htmlFor="reg-name" className="df-auth-label">
            Nome e cognome
          </Label>
          <div className="df-auth-input-wrap">
            <input
              id="reg-name"
              type="text"
              placeholder="Mario Rossi"
              autoComplete="name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              className={cn("df-auth-input no-right", errors.name && "err")}
              {...register("name")}
              autoFocus
            />
            <User className="df-auth-field-icon" aria-hidden="true" />
          </div>
          {errors.name && <p role="alert" className="df-auth-help">{errors.name.message}</p>}
        </div>

        <div className="df-auth-field">
          <Label htmlFor="reg-company" className="df-auth-label">
            Azienda
          </Label>
          <div className="df-auth-input-wrap">
            <input
              id="reg-company"
              type="text"
              placeholder="Acme S.r.l."
              autoComplete="organization"
              disabled={isSubmitting}
              className="df-auth-input no-right"
              {...register("company")}
            />
            <Building2 className="df-auth-field-icon" aria-hidden="true" />
          </div>
          {errors.company && <p role="alert" className="df-auth-help">{errors.company.message}</p>}
        </div>

        <div className="df-auth-field">
          <Label htmlFor="reg-slug" className="df-auth-label">
            Indirizzo aziendale
          </Label>
          <div className="df-auth-input-wrap">
            <input
              id="reg-slug"
              type="text"
              placeholder="nome-azienda"
              autoComplete="off"
              disabled={isSubmitting}
              aria-invalid={!!errors.slug || slugStatus === "unavailable"}
              className={cn("df-auth-input no-right", (errors.slug || slugStatus === "unavailable") && "err")}
              {...register("slug", {
                onChange: (event) => {
                  event.target.value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                  setSlugEdited(true);
                },
              })}
            />
            <Building2 className="df-auth-field-icon" aria-hidden="true" />
          </div>
          <p className={cn(
            "text-[11px]",
            errors.slug || slugStatus === "unavailable"
              ? "df-auth-help"
              : slugStatus === "available"
                ? "text-emerald-400"
                : "text-muted-foreground",
          )}>
            {errors.slug?.message || slugMessage || "Sarà usato per il tuo spazio Doflow."}
          </p>
        </div>

        {!googleSignupToken && <div className="df-auth-field">
          <Label htmlFor="reg-email" className="df-auth-label">
            Email
          </Label>
          <div className="df-auth-input-wrap">
            <input
              id="reg-email"
              type="email"
              placeholder="nome@azienda.it"
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              className={cn("df-auth-input no-right", errors.email && "err")}
              {...register("email")}
            />
            <Mail className="df-auth-field-icon" aria-hidden="true" />
          </div>
          {errors.email && <p role="alert" className="df-auth-help">{errors.email.message}</p>}
        </div>}

        {!googleSignupToken && <div className="df-auth-field">
          <Label htmlFor="reg-password" className="df-auth-label">
            Password
          </Label>
          <div className="df-auth-input-wrap">
            <input
              id="reg-password"
              type={showPwd ? "text" : "password"}
              placeholder="Crea una password"
              autoComplete="new-password"
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
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Nascondi password" : "Mostra password"}
                  disabled={isSubmitting}
                  className="df-auth-password-toggle"
                >
                  {showPwd ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {showPwd ? "Nascondi password" : "Mostra password"}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="df-auth-strength" aria-hidden="true">
            <i className="df-auth-strength-bar" style={{ width: `${strength.width}%`, background: strength.color }} />
          </div>
          {errors.password && <p role="alert" className="df-auth-help">{errors.password.message}</p>}
        </div>}

        {!googleSignupToken && <div className="df-auth-field">
          <Label htmlFor="reg-confirm" className="df-auth-label">
            Conferma password
          </Label>
          <div className="df-auth-input-wrap">
            <input
              id="reg-confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="Ripeti password"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={!!errors.confirmPassword}
              className={cn("df-auth-input", errors.confirmPassword && "err")}
              {...register("confirmPassword")}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <Lock className="df-auth-field-icon" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Nascondi password" : "Mostra password"}
                  disabled={isSubmitting}
                  className="df-auth-password-toggle"
                >
                  {showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {showConfirm ? "Nascondi password" : "Mostra password"}
              </TooltipContent>
            </Tooltip>
          </div>
          {errors.confirmPassword && <p role="alert" className="df-auth-help">{errors.confirmPassword.message}</p>}
        </div>}

        <div className="df-auth-check-row">
          <Controller
            name="acceptTerms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="acceptTerms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={isSubmitting}
                className="mt-1"
              />
            )}
          />
          <Label htmlFor="acceptTerms" className="cursor-pointer text-[12.5px]">
            Accetto i <Link href="/terms" className="df-auth-link">Termini di Servizio</Link>{" "}
            e la <Link href="/privacy" className="df-auth-link">Privacy Policy</Link>.
          </Label>
        </div>
        {errors.acceptTerms && <p role="alert" className="df-auth-help -mt-2">{errors.acceptTerms.message}</p>}

        {generalError && (
          <div role="alert" className="df-auth-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{generalError}</span>
          </div>
        )}

        <button type="submit" disabled={isSubmitting || slugStatus === "checking"} className="df-auth-submit">
          <span className="df-auth-button-content">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creazione account...
              </>
            ) : (
              "Crea account"
            )}
          </span>
        </button>
      </form>

      <div className="df-auth-foot">
        Hai già un account?{" "}
        {onSwitchToLogin ? (
          <button type="button" className="df-auth-inline-action" onClick={onSwitchToLogin}>
            Accedi
          </button>
        ) : (
          <Link href="/login">Accedi</Link>
        )}
      </div>
    </div>
  );
}
