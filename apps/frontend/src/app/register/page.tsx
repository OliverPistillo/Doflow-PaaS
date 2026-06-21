// apps/frontend/src/app/register/page.tsx
// Visual update from nuovo login; keeps /auth/register flow intact.

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
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
    company: z.string().optional(),
    email: z
      .string()
      .min(1, "L'email è obbligatoria")
      .email("Inserisci un'email valida"),
    password: z.string().min(8, "Minimo 8 caratteri"),
    confirmPassword: z.string().min(1, "Conferma la password"),
    acceptTerms: z.boolean().refine((v) => v === true, "Devi accettare i termini"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

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

export default function RegisterPage() {
  const router = useRouter();
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  React.useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push("/login"), 2200);
    return () => clearTimeout(t);
  }, [success, router]);

  const pwd = watch("password") || "";
  const strength = passwordStrength(pwd);

  const onSubmit = async (values: RegisterFormValues) => {
    setGeneralError(null);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          name: values.name,
          company: values.company,
          email: values.email,
          password: values.password,
        }),
      });
      setSuccess(true);
    } catch (err: any) {
      setGeneralError(err?.message || "Errore durante la registrazione.");
    }
  };

  return (
    <AuthShell
      mode="register"
      title="Crea il tuo account."
      description="Bastano pochi secondi per iniziare a far fluire i progetti."
      mascotShy={passwordFocused && !(showPwd || showConfirm)}
    >
      {success ? (
        <div className="df-auth-success">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15">
            <Check size={24} aria-hidden="true" />
          </div>
          <p className="text-[16px] font-extrabold">Account creato con successo.</p>
          <p className="mt-1 text-[13px] opacity-80">Ti portiamo al login tra un istante.</p>
        </div>
      ) : (
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
                Azienda <span className="font-normal opacity-60">opzionale</span>
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
            </div>

            <div className="df-auth-field">
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
            </div>

            <div className="df-auth-field">
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
            </div>

            <div className="df-auth-field">
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
            </div>

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

            <button type="submit" disabled={isSubmitting} className="df-auth-submit">
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
            Hai già un account? <Link href="/login">Accedi</Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
