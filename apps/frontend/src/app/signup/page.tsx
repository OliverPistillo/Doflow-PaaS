// apps/frontend/src/app/signup/page.tsx
// Self-service tenant signup — wizard 3-step, refreshed with nuovo login auth shell.

"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Building2,
  Check,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  User,
} from "lucide-react";

type SignupResponse = {
  tenant: { id: string; name: string; slug: string; planTier: string; schemaName: string };
  user: { id: string; email: string; role: string; tenantId: string; tenantSlug: string };
  token: string;
  nextStep: "onboarding" | "dashboard";
};

type SlugCheckResponse = { available: boolean; reason?: string };

type Plan = "STARTER" | "PRO" | "ENTERPRISE";

const PLANS: {
  id: Plan;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  popular?: boolean;
}[] = [
  { id: "STARTER", name: "Starter", price: "Gratis", tagline: "Per iniziare", features: ["5 utenti", "5 GB storage", "Moduli base", "Supporto email"] },
  { id: "PRO", name: "Pro", price: "€99/mese", tagline: "Per crescere", popular: true, features: ["25 utenti", "25 GB storage", "Tutti i moduli Pro", "Supporto prioritario", "Automazioni avanzate"] },
  { id: "ENTERPRISE", name: "Enterprise", price: "€299/mese", tagline: "Per scalare", features: ["Utenti illimitati", "100 GB storage", "Tutti i moduli", "Account manager", "SLA personalizzato", "API senza limiti"] },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 30);
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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="df-auth-page flex min-h-screen items-center justify-center">
          <Loader2 className="animate-spin" aria-label="Caricamento" />
        </div>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [fullName, setFullName] = React.useState("");

  React.useEffect(() => {
    const ge = searchParams?.get("google_email");
    const gn = searchParams?.get("google_name");
    if (ge) setEmail(ge);
    if (gn) setFullName(gn);
  }, [searchParams]);

  const [companyName, setCompanyName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<{ checking: boolean; result: SlugCheckResponse | null }>({
    checking: false,
    result: null,
  });
  const [planTier, setPlanTier] = React.useState<Plan>("STARTER");
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slugTouched && companyName) {
      setSlug(slugify(companyName));
    }
  }, [companyName, slugTouched]);

  React.useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus({ checking: false, result: null });
      return;
    }
    setSlugStatus({ checking: true, result: null });
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch<SlugCheckResponse>(`/auth/check-slug?slug=${encodeURIComponent(slug)}`, { auth: false });
        setSlugStatus({ checking: false, result: r });
      } catch {
        setSlugStatus({ checking: false, result: { available: false, reason: "Errore di rete" } });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  const step1Valid = /\S+@\S+\.\S+/.test(email) && password.length >= 8;
  const step2Valid = companyName.length >= 2 && slug.length >= 3 && slugStatus.result?.available === true;
  const step3Valid = acceptTerms;

  async function handleSubmit() {
    setGeneralError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<SignupResponse>("/auth/signup-tenant", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          email,
          password,
          fullName,
          companyName,
          slug,
          planTier,
          acceptTerms: "true",
        }),
      });
      if (!res?.token) throw new Error("Token mancante nella risposta");
      window.localStorage.setItem("doflow_token", res.token);
      router.push("/onboarding");
    } catch (err: any) {
      setGeneralError(err?.message || "Errore durante la registrazione");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      mode="register"
      title="Crea il tuo spazio Doflow."
      description="Account, azienda e piano: tre passaggi, niente carta richiesta."
      cardClassName="df-auth-card-wide"
      registerHref="/signup"
      mascotShy={passwordFocused && !showPwd}
      brandDescription="Configura il tuo tenant in pochi minuti e parti con CRM, moduli e onboarding guidato. Il caos, invece, resta fuori."
    >
      <div data-testid="signup-page">
        <div className="df-auth-stepper" aria-label="Avanzamento registrazione">
          {[
            { n: 1, label: "Account" },
            { n: 2, label: "Azienda" },
            { n: 3, label: "Conferma" },
          ].map(({ n, label }) => (
            <React.Fragment key={n}>
              <div className={`df-auth-step-pill ${step === n ? "active" : step > n ? "done" : ""}`} data-testid={`step-pill-${n}`}>
                {step > n ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <span>{n}</span>}
                {label}
              </div>
              {n < 3 && <div className="df-auth-step-line" />}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="df-auth-form" data-testid="signup-step-1">
            <button
              type="button"
              onClick={() => {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
                const origin = apiBase.replace(/\/api\/?$/, "");
                window.location.href = `${origin}/api/auth/google`;
              }}
              className="df-auth-social"
              data-testid="signup-google-btn"
            >
              <GoogleIcon />
              Continua con Google
            </button>

            <div className="df-auth-divider">oppure con email</div>

            <div className="df-auth-field">
              <Label htmlFor="signup-fullname" className="df-auth-label">
                Nome completo <span className="font-normal opacity-60">opzionale</span>
              </Label>
              <div className="df-auth-input-wrap">
                <input
                  id="signup-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="df-auth-input no-right"
                  placeholder="Mario Rossi"
                  autoComplete="name"
                  data-testid="signup-fullname-input"
                />
                <User className="df-auth-field-icon" aria-hidden="true" />
              </div>
            </div>

            <div className="df-auth-field">
              <Label htmlFor="signup-email" className="df-auth-label">
                Email
              </Label>
              <div className="df-auth-input-wrap">
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  className="df-auth-input no-right"
                  placeholder="nome@azienda.it"
                  autoComplete="email"
                  autoFocus
                  data-testid="signup-email-input"
                />
                <Mail className="df-auth-field-icon" aria-hidden="true" />
              </div>
            </div>

            <div className="df-auth-field">
              <Label htmlFor="signup-password" className="df-auth-label">
                Password <span className="font-normal opacity-60">min 8 caratteri</span>
              </Label>
              <div className="df-auth-input-wrap">
                <input
                  id="signup-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  className="df-auth-input"
                  placeholder="Password"
                  autoComplete="new-password"
                  data-testid="signup-password-input"
                />
                <Lock className="df-auth-field-icon" aria-hidden="true" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="df-auth-password-toggle"
                      aria-label={showPwd ? "Nascondi password" : "Mostra password"}
                      data-testid="signup-password-toggle"
                    >
                      {showPwd ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {showPwd ? "Nascondi password" : "Mostra password"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="df-auth-submit"
              data-testid="signup-step1-next-btn"
            >
              <span className="df-auth-button-content">
                Continua <ArrowRight size={16} aria-hidden="true" />
              </span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="df-auth-form" data-testid="signup-step-2">
            <div className="df-auth-form-grid">
              <div className="df-auth-field">
                <Label htmlFor="signup-company" className="df-auth-label">
                  Nome azienda
                </Label>
                <div className="df-auth-input-wrap">
                  <input
                    id="signup-company"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="df-auth-input no-right"
                    placeholder="Acme S.r.l."
                    data-testid="signup-company-input"
                  />
                  <Building2 className="df-auth-field-icon" aria-hidden="true" />
                </div>
              </div>

              <div className="df-auth-field">
                <Label htmlFor="signup-slug" className="df-auth-label">
                  Dominio aziendale
                </Label>
                <div className="df-auth-input-wrap">
                  <input
                    id="signup-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                    className="df-auth-input"
                    placeholder="acme-srl"
                    aria-invalid={slugStatus.result && !slugStatus.result.available ? true : undefined}
                    data-testid="signup-slug-input"
                  />
                  <Building2 className="df-auth-field-icon" aria-hidden="true" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {slugStatus.checking && <Loader2 size={16} className="animate-spin opacity-60" data-testid="signup-slug-checking" />}
                    {!slugStatus.checking && slugStatus.result?.available && <Check size={18} className="text-emerald-300" data-testid="signup-slug-available" />}
                    {!slugStatus.checking && slugStatus.result && !slugStatus.result.available && <AlertCircle size={18} className="text-red-300" data-testid="signup-slug-unavailable" />}
                  </div>
                </div>
                {slugStatus.result && !slugStatus.result.available && (
                  <p className="df-auth-help" data-testid="signup-slug-error">{slugStatus.result.reason}</p>
                )}
                {slugStatus.result?.available && (
                  <p className="text-xs font-semibold text-emerald-300" data-testid="signup-slug-success">✓ Disponibile</p>
                )}
              </div>
            </div>

            <div className="df-auth-field">
              <Label className="df-auth-label">Scegli un piano</Label>
              <div className="df-auth-plan-grid">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanTier(p.id)}
                    className={`df-auth-plan-card ${planTier === p.id ? "selected" : ""}`}
                    data-testid={`signup-plan-${p.id.toLowerCase()}`}
                  >
                    {p.popular && <span className="df-auth-plan-badge">Popular</span>}
                    <div className="mb-1 flex items-center gap-1">
                      <span className="text-base font-extrabold">{p.name}</span>
                      {planTier === p.id && <Check size={14} className="text-[hsl(var(--primary))]" aria-hidden="true" />}
                    </div>
                    <p className="mb-2 text-xs opacity-55">{p.tagline}</p>
                    <p className="mb-3 text-xl font-black">{p.price}</p>
                    <ul className="space-y-1">
                      {p.features.slice(0, 3).map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs opacity-70">
                          <Check size={11} className="shrink-0 text-emerald-300" aria-hidden="true" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setStep(1)} className="df-auth-secondary-button" data-testid="signup-step2-back-btn">
                <ArrowLeft size={16} aria-hidden="true" /> Indietro
              </button>
              <button onClick={() => setStep(3)} disabled={!step2Valid} className="df-auth-submit flex-1" data-testid="signup-step2-next-btn">
                <span className="df-auth-button-content">
                  Continua <ArrowRight size={16} aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="df-auth-form" data-testid="signup-step-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="df-auth-summary-card">
                <div className="df-auth-summary-label">Account</div>
                <div className="text-sm font-semibold" data-testid="signup-summary-email">📧 {email}</div>
                {fullName && <div className="mt-1 text-sm opacity-75">👤 {fullName}</div>}
              </div>
              <div className="df-auth-summary-card">
                <div className="df-auth-summary-label">Azienda</div>
                <div className="text-sm font-semibold" data-testid="signup-summary-company">🏢 {companyName}</div>
                <div className="mt-1 font-mono text-xs text-[hsl(var(--primary))]">{slug}.doflow.it</div>
              </div>
              <div className="df-auth-summary-card">
                <div className="df-auth-summary-label flex items-center gap-1 text-[hsl(var(--primary))]">
                  <Sparkles size={11} aria-hidden="true" /> Piano
                </div>
                <div className="text-sm font-extrabold" data-testid="signup-summary-plan">
                  {PLANS.find((p) => p.id === planTier)?.name} — {PLANS.find((p) => p.id === planTier)?.price}
                </div>
                <div className="mt-1 text-xs opacity-65">Trial gratuito sui moduli Pro</div>
              </div>
            </div>

            <div className="df-auth-check-row" data-testid="signup-terms-label">
              <Checkbox
                id="signup-terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                className="mt-1"
                data-testid="signup-terms-checkbox"
              />
              <Label htmlFor="signup-terms" className="cursor-pointer text-[12.5px]">
                Accetto i <Link href="/terms" className="df-auth-link">Termini di Servizio</Link>{" "}
                e la <Link href="/privacy" className="df-auth-link">Privacy Policy</Link> di Doflow.
              </Label>
            </div>

            {generalError && (
              <div role="alert" className="df-auth-error" data-testid="signup-error">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{generalError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setStep(2)} disabled={submitting} className="df-auth-secondary-button" data-testid="signup-step3-back-btn">
                <ArrowLeft size={16} aria-hidden="true" /> Indietro
              </button>
              <button onClick={handleSubmit} disabled={!step3Valid || submitting} className="df-auth-submit flex-1" data-testid="signup-create-btn">
                <span className="df-auth-button-content">
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Creazione in corso...
                    </>
                  ) : (
                    <>
                      Crea il mio account <Sparkles size={16} aria-hidden="true" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
