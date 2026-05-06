// apps/frontend/src/app/signup/page.tsx
// Self-service tenant signup — wizard 3-step
// Step 1: Account (email + password)
// Step 2: Company (name + slug live-validated + plan tier)
// Step 3: Review + accept terms + create

"use client";

import * as React from "react";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  Eye, EyeOff, Loader2, AlertCircle, Mail, Lock, Building2, Check,
  ArrowLeft, ArrowRight, Sparkles,
} from "lucide-react";

type SignupResponse = {
  tenant: { id: string; name: string; slug: string; planTier: string; schemaName: string };
  user: { id: string; email: string; role: string; tenantId: string; tenantSlug: string };
  token: string;
  nextStep: "onboarding" | "dashboard";
};

type SlugCheckResponse = { available: boolean; reason?: string };

type Plan = "STARTER" | "PRO" | "ENTERPRISE";

const PLANS: { id: Plan; name: string; price: string; tagline: string; features: string[]; popular?: boolean }[] = [
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a1628] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  // Step 1
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [fullName, setFullName] = React.useState("");

  // Pre-fill from Google OAuth redirect
  React.useEffect(() => {
    const ge = searchParams?.get("google_email");
    const gn = searchParams?.get("google_name");
    if (ge) setEmail(ge);
    if (gn) setFullName(gn);
  }, [searchParams]);

  // Step 2
  const [companyName, setCompanyName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<{ checking: boolean; result: SlugCheckResponse | null }>({
    checking: false, result: null,
  });
  const [planTier, setPlanTier] = React.useState<Plan>("STARTER");

  // Step 3
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  // Auto-fill slug from company name
  React.useEffect(() => {
    if (!slugTouched && companyName) {
      setSlug(slugify(companyName));
    }
  }, [companyName, slugTouched]);

  // Debounced slug availability check
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

  // Step validators
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
          email, password, fullName,
          companyName, slug, planTier,
          acceptTerms: "true",
        }),
      });
      if (!res?.token) throw new Error("Token mancante nella risposta");
      window.localStorage.setItem("doflow_token", res.token);
      // Redirect to onboarding wizard
      router.push("/onboarding");
    } catch (err: any) {
      setGeneralError(err?.message || "Errore durante la registrazione");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white relative overflow-hidden font-[Outfit,sans-serif]" data-testid="signup-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        .signup-bg::before, .signup-bg::after {
          content: ""; position: absolute; border-radius: 50%; filter: blur(120px); pointer-events: none;
        }
        .signup-bg::before { width:600px; height:600px; background:rgba(59,130,246,.15); top:-200px; right:-200px; }
        .signup-bg::after  { width:500px; height:500px; background:rgba(168,85,247,.12); bottom:-150px; left:-150px; }
        .signup-grid {
          background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
          background-size: 48px 48px;
        }
        .glass {
          background: rgba(255,255,255,.04); backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,.08);
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .anim-fade { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
        .input-mod {
          width:100%; height:48px; border-radius:12px; padding:0 16px 0 44px;
          background: rgba(255,255,255,.05); border:1.5px solid rgba(255,255,255,.1);
          color:#fff; font-size:15px; outline:none;
          transition:border-color .18s, background .18s, box-shadow .18s;
        }
        .input-mod::placeholder { color: rgba(255,255,255,.35); }
        .input-mod:focus { background: rgba(255,255,255,.07); border-color:#60a5fa; box-shadow: 0 0 0 4px rgba(96,165,250,.12); }
        .input-mod.err { border-color: #f87171; }
        .btn-primary {
          width:100%; height:48px; border-radius:12px; border:0; cursor:pointer;
          font-size:15px; font-weight:700; color:#0a1628;
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
          transition: transform .15s, box-shadow .15s, opacity .15s;
        }
        .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(96,165,250,.35); }
        .btn-primary:disabled { opacity:.45; cursor:not-allowed; }
        .btn-secondary {
          height:48px; padding: 0 22px; border-radius:12px; cursor:pointer;
          background: rgba(255,255,255,.06); border:1.5px solid rgba(255,255,255,.1);
          color:#fff; font-size:14px; font-weight:600;
          display:inline-flex; align-items:center; gap:8px;
          transition: background .15s, border-color .15s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.2); }
        .plan-card {
          padding: 22px; border-radius: 18px; cursor: pointer;
          background: rgba(255,255,255,.04); border:1.5px solid rgba(255,255,255,.08);
          transition: all .2s ease;
          position: relative; overflow: hidden;
        }
        .plan-card:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.16); transform: translateY(-2px); }
        .plan-card.selected {
          border-color: #60a5fa; background: rgba(96,165,250,.08);
          box-shadow: 0 0 0 1px #60a5fa, 0 12px 40px rgba(96,165,250,.18);
        }
        .step-pill {
          display:inline-flex; align-items:center; gap:8px;
          padding:6px 14px; border-radius:999px;
          background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08);
          font-size:12px; font-weight:600; color: rgba(255,255,255,.7);
        }
        .step-pill.active {
          background: linear-gradient(135deg, rgba(96,165,250,.2), rgba(168,85,247,.2));
          border-color: rgba(96,165,250,.4); color: #fff;
        }
        .step-pill.done {
          background: rgba(34,197,94,.15); border-color: rgba(34,197,94,.3); color: #86efac;
        }
      `}</style>

      <div className="signup-bg signup-grid absolute inset-0 -z-10" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-12 anim-fade">
          <Link href="/" data-testid="signup-logo-link">
            <Image src="/doflow_logo.svg" alt="Doflow" width={130} height={36} className="brightness-0 invert opacity-90" />
          </Link>
          <Link href="/login" className="text-sm text-white/60 hover:text-white transition" data-testid="signup-login-link">
            Hai già un account? <span className="font-semibold text-white">Accedi</span>
          </Link>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 mb-10 anim-fade">
          {[
            { n: 1, label: "Account" },
            { n: 2, label: "Azienda" },
            { n: 3, label: "Conferma" },
          ].map(({ n, label }) => (
            <React.Fragment key={n}>
              <div className={`step-pill ${step === n ? "active" : step > n ? "done" : ""}`} data-testid={`step-pill-${n}`}>
                {step > n ? <Check size={14} strokeWidth={3} /> : <span>{n}</span>}
                {label}
              </div>
              {n < 3 && <div className="w-8 h-px bg-white/10" />}
            </React.Fragment>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
          {/* MAIN PANEL */}
          <div className="anim-fade">
            <div className="glass rounded-3xl p-8 md:p-10">
              {step === 1 && (
                <div className="space-y-6" data-testid="signup-step-1">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">Crea il tuo account</h1>
                    <p className="text-white/55 text-sm">14 giorni gratis, zero carta richiesta. Annulli quando vuoi.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
                      const origin = apiBase.replace(/\/api\/?$/, "");
                      window.location.href = `${origin}/api/auth/google`;
                    }}
                    className="w-full h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition flex items-center justify-center gap-2 font-semibold text-sm"
                    data-testid="signup-google-btn"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    Continua con Google
                  </button>

                  <div className="flex items-center gap-3 text-xs text-white/40 font-medium">
                    <div className="flex-1 h-px bg-white/10" />
                    <span>oppure con email</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-2 block">Nome completo (opzionale)</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                        <input
                          type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                          className="input-mod" placeholder="Mario Rossi"
                          data-testid="signup-fullname-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-2 block">Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                        <input
                          type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())}
                          className="input-mod" placeholder="nome@azienda.it" autoFocus
                          data-testid="signup-email-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-2 block">Password * <span className="text-white/40 font-normal">(min 8 caratteri)</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                        <input
                          type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                          className="input-mod" placeholder="••••••••"
                          data-testid="signup-password-input"
                        />
                        <button type="button" onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                          aria-label="Toggle password" data-testid="signup-password-toggle">
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep(2)} disabled={!step1Valid} className="btn-primary"
                    data-testid="signup-step1-next-btn"
                  >
                    Continua <ArrowRight size={16} className="inline ml-1" />
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6" data-testid="signup-step-2">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">La tua azienda</h1>
                    <p className="text-white/55 text-sm">Lo slug sarà l'URL del tuo spazio: <code className="bg-white/8 px-1.5 py-0.5 rounded text-blue-300">{slug || "azienda"}.doflow.it</code></p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-2 block">Nome azienda *</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                        <input
                          type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                          className="input-mod" placeholder="Acme Srl" autoFocus
                          data-testid="signup-company-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-2 block">URL spazio (slug) *</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35 text-sm font-mono">/</span>
                        <input
                          type="text" value={slug}
                          onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                          className={`input-mod ${slugStatus.result && !slugStatus.result.available ? "err" : ""}`}
                          placeholder="acme-srl"
                          data-testid="signup-slug-input"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {slugStatus.checking && <Loader2 size={16} className="animate-spin text-white/40" data-testid="signup-slug-checking" />}
                          {!slugStatus.checking && slugStatus.result?.available && <Check size={18} className="text-green-400" data-testid="signup-slug-available" />}
                          {!slugStatus.checking && slugStatus.result && !slugStatus.result.available && <AlertCircle size={18} className="text-red-400" data-testid="signup-slug-unavailable" />}
                        </div>
                      </div>
                      {slugStatus.result && !slugStatus.result.available && (
                        <p className="text-xs text-red-400 mt-1.5" data-testid="signup-slug-error">{slugStatus.result.reason}</p>
                      )}
                      {slugStatus.result?.available && (
                        <p className="text-xs text-green-400 mt-1.5" data-testid="signup-slug-success">✓ Disponibile</p>
                      )}
                    </div>

                    {/* Plans */}
                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-3 block">Scegli un piano *</label>
                      <div className="grid sm:grid-cols-3 gap-3">
                        {PLANS.map((p) => (
                          <button
                            key={p.id} type="button" onClick={() => setPlanTier(p.id)}
                            className={`plan-card text-left ${planTier === p.id ? "selected" : ""}`}
                            data-testid={`signup-plan-${p.id.toLowerCase()}`}
                          >
                            {p.popular && (
                              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-blue-400 to-purple-400 text-[#0a1628] px-2 py-0.5 rounded-full">
                                Popular
                              </span>
                            )}
                            <div className="flex items-center gap-1 mb-1">
                              <span className="font-bold text-base">{p.name}</span>
                              {planTier === p.id && <Check size={14} className="text-blue-400" />}
                            </div>
                            <p className="text-xs text-white/45 mb-2">{p.tagline}</p>
                            <p className="text-xl font-extrabold mb-3">{p.price}</p>
                            <ul className="space-y-1">
                              {p.features.slice(0, 3).map((f) => (
                                <li key={f} className="text-xs text-white/55 flex items-center gap-1.5">
                                  <Check size={11} className="text-green-400 shrink-0" />{f}
                                </li>
                              ))}
                            </ul>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setStep(1)} className="btn-secondary" data-testid="signup-step2-back-btn">
                      <ArrowLeft size={16} /> Indietro
                    </button>
                    <button onClick={() => setStep(3)} disabled={!step2Valid} className="btn-primary flex-1" data-testid="signup-step2-next-btn">
                      Continua <ArrowRight size={16} className="inline ml-1" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6" data-testid="signup-step-3">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">Quasi fatto! 🎉</h1>
                    <p className="text-white/55 text-sm">Controlla i dati e crea il tuo account</p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl p-4 bg-white/4 border border-white/8">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Account</div>
                      <div className="text-sm text-white/85" data-testid="signup-summary-email">📧 {email}</div>
                      {fullName && <div className="text-sm text-white/85 mt-1">👤 {fullName}</div>}
                    </div>
                    <div className="rounded-2xl p-4 bg-white/4 border border-white/8">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Azienda</div>
                      <div className="text-sm text-white/85" data-testid="signup-summary-company">🏢 {companyName}</div>
                      <div className="text-xs text-blue-300 mt-1 font-mono">{slug}.doflow.it</div>
                    </div>
                    <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-500/8 to-purple-500/8 border border-blue-400/20">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-1 flex items-center gap-1">
                        <Sparkles size={11} /> Piano selezionato
                      </div>
                      <div className="text-base font-bold" data-testid="signup-summary-plan">{PLANS.find(p => p.id === planTier)?.name} — {PLANS.find(p => p.id === planTier)?.price}</div>
                      <div className="text-xs text-white/55 mt-1">14 giorni di trial gratuito sui moduli Pro</div>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer" data-testid="signup-terms-label">
                    <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded accent-blue-400" data-testid="signup-terms-checkbox"/>
                    <span className="text-xs text-white/65 leading-relaxed">
                      Accetto i <Link href="/terms" className="text-blue-400 hover:underline">Termini di Servizio</Link>
                      {" "}e la <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link> di Doflow.
                    </span>
                  </label>

                  {generalError && (
                    <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-400/30 px-4 py-3 text-sm text-red-300" data-testid="signup-error">
                      <AlertCircle size={15} className="shrink-0" /><span>{generalError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary" data-testid="signup-step3-back-btn">
                      <ArrowLeft size={16} /> Indietro
                    </button>
                    <button onClick={handleSubmit} disabled={!step3Valid || submitting} className="btn-primary flex-1" data-testid="signup-create-btn">
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Creazione in corso...</span>
                      ) : (
                        <>Crea il mio account <Sparkles size={16} className="inline ml-1" /></>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SIDE PANEL — Trust signals */}
          <div className="anim-fade space-y-4 hidden lg:block">
            <div className="glass rounded-3xl p-7">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-3">Cosa ottieni</div>
              <ul className="space-y-3">
                {[
                  "Onboarding guidato in stile Odoo",
                  "30+ moduli per ogni esigenza",
                  "Multi-tenant con isolamento dati",
                  "MFA e audit log completo",
                  "Setup in meno di 5 minuti",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-white/70">
                    <div className="w-5 h-5 rounded-md bg-blue-400/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={12} className="text-blue-400" />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass rounded-3xl p-7 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
              <div className="flex gap-1 mb-3">
                {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-400 text-base">★</span>)}
              </div>
              <p className="text-sm text-white/75 italic leading-relaxed mb-4">
                "Doflow ha sostituito 4 strumenti diversi. Il setup è stato istantaneo, il trial gratuito ci ha permesso di testare senza rischi."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center font-bold text-[#0a1628]">M</div>
                <div>
                  <div className="text-sm font-bold">Marco R.</div>
                  <div className="text-xs text-white/45">CEO · PMI italiana</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
