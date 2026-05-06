// apps/frontend/src/app/onboarding/page.tsx
// First-login onboarding wizard (Odoo-style)
// Step 1: Sector selection (suggests modules)
// Step 2: Module selection by category (toggle cards, locked by tier)
// Step 3: Confirm + redirect to dashboard

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import {
  Loader2, Check, ArrowRight, ArrowLeft, Sparkles, Lock, AlertCircle,
  ShoppingCart, Wallet, Briefcase, Users, Megaphone, Headphones, Building2,
  Stethoscope, HardHat, UtensilsCrossed, Hotel, Scissors, Factory, Store,
  GraduationCap,
} from "lucide-react";

type PlatformModule = {
  key: string;
  name: string;
  description: string;
  category: string;
  minTier: "STARTER" | "PRO" | "ENTERPRISE";
  priceMonthly: number;
  isBeta: boolean;
};

type ModulesResponse = {
  active: { key: string; name: string; status: string }[];
  available: (PlatformModule & { isActive: boolean })[];
};

type PlanInfo = { tenantId: string; name: string; planTier: "STARTER" | "PRO" | "ENTERPRISE"; monthlyPrice: number };

// Sector → suggested module keys
const SECTORS = [
  { id: "generic", name: "Generico", icon: Briefcase, description: "Adatto a ogni business", suggested: ["crm.contacts","crm.deals","crm.quotes","fin.invoices","ops.tasks","ops.calendar"] },
  { id: "retail", name: "Retail / E-commerce", icon: Store, description: "Negozi fisici e online", suggested: ["crm.contacts","fin.invoices","fin.payments","inv.warehouse","inv.suppliers","mkt.campaigns"] },
  { id: "hospitality", name: "Hospitality", icon: Hotel, description: "Hotel, B&B, Airbnb", suggested: ["vert.hospitality.bookings","crm.contacts","fin.invoices","ops.calendar","ops.tasks","mkt.campaigns"] },
  { id: "restaurant", name: "Ristorazione", icon: UtensilsCrossed, description: "Ristoranti e bar", suggested: ["vert.hospitality.menu","inv.warehouse","inv.suppliers","fin.invoices","hr.employees","ops.calendar"] },
  { id: "beauty", name: "Centro Estetico", icon: Scissors, description: "Saloni, SPA, parrucchieri", suggested: ["vert.beauty","crm.contacts","ops.calendar","fin.invoices","mkt.campaigns","sup.tickets"] },
  { id: "manufacturing", name: "Manifattura", icon: Factory, description: "Produzione industriale", suggested: ["vert.manufacturing","inv.warehouse","inv.purchase-orders","inv.logistics","hr.employees","crm.deals"] },
  { id: "services", name: "Servizi / Consulenza", icon: Briefcase, description: "Studi e agenzie", suggested: ["crm.contacts","crm.deals","crm.quotes","ops.timesheet","ops.projects","fin.invoices"] },
  { id: "healthcare", name: "Sanità", icon: Stethoscope, description: "Studi medici, cliniche", suggested: ["crm.contacts","ops.calendar","fin.invoices","sup.tickets","hr.employees"] },
  { id: "construction", name: "Edilizia", icon: HardHat, description: "Imprese edili e cantieri", suggested: ["crm.deals","crm.quotes","ops.projects","ops.timesheet","inv.suppliers","fin.invoices"] },
  { id: "education", name: "Educazione", icon: GraduationCap, description: "Scuole, corsi, formatori", suggested: ["crm.contacts","ops.calendar","fin.invoices","fin.subscriptions","mkt.campaigns","sup.knowledge-base"] },
];

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  COMMERCIAL: { label: "Vendite & CRM", icon: ShoppingCart, color: "text-blue-400" },
  FINANCE: { label: "Finanza", icon: Wallet, color: "text-green-400" },
  OPERATIONS: { label: "Operations", icon: Briefcase, color: "text-purple-400" },
  HR: { label: "Risorse Umane", icon: Users, color: "text-pink-400" },
  MARKETING: { label: "Marketing", icon: Megaphone, color: "text-orange-400" },
  SERVICES: { label: "Servizi & Support", icon: Headphones, color: "text-cyan-400" },
  HEALTH: { label: "Verticali Salute", icon: Stethoscope, color: "text-rose-400" },
  CONSTRUCTION: { label: "Verticali Industriali", icon: HardHat, color: "text-yellow-400" },
};

const TIER_RANK: Record<string, number> = { STARTER: 0, PRO: 1, ENTERPRISE: 2 };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [plan, setPlan] = React.useState<PlanInfo | null>(null);
  const [modules, setModules] = React.useState<(PlatformModule & { isActive: boolean })[]>([]);
  const [selectedSector, setSelectedSector] = React.useState<string | null>(null);
  const [selectedModules, setSelectedModules] = React.useState<Set<string>>(new Set());

  // Fetch plan + modules at start
  React.useEffect(() => {
    (async () => {
      try {
        // Token check
        const token = window.localStorage.getItem("doflow_token");
        if (!token) { router.push("/login"); return; }

        const [planRes, modsRes] = await Promise.all([
          apiFetch<PlanInfo>("/tenant/self-service/plan"),
          apiFetch<ModulesResponse>("/tenant/self-service/modules"),
        ]);
        setPlan(planRes);
        setModules(modsRes.available);
        // Pre-select active (trial) modules
        setSelectedModules(new Set(modsRes.active.map(m => m.key)));
      } catch (err: any) {
        setError(err?.message || "Errore caricamento dati");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Sector-based pre-selection
  function applySector(sectorId: string) {
    setSelectedSector(sectorId);
    const sector = SECTORS.find(s => s.id === sectorId);
    if (!sector) return;
    const userTierRank = TIER_RANK[plan?.planTier || "STARTER"];
    // Auto-select all suggested modules that user can access
    const newSet = new Set<string>(selectedModules);
    for (const key of sector.suggested) {
      const mod = modules.find(m => m.key === key);
      if (mod && TIER_RANK[mod.minTier] <= userTierRank) {
        newSet.add(key);
      }
    }
    setSelectedModules(newSet);
  }

  function toggleModule(key: string) {
    const mod = modules.find(m => m.key === key);
    if (!mod) return;
    const userTierRank = TIER_RANK[plan?.planTier || "STARTER"];
    if (TIER_RANK[mod.minTier] > userTierRank) return; // locked
    const next = new Set(selectedModules);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedModules(next);
  }

  async function completeOnboarding() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/tenant/self-service/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          sector: selectedSector,
          selectedModules: Array.from(selectedModules),
        }),
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio");
    } finally {
      setSubmitting(false);
    }
  }

  // Group modules by category for step 2
  const modulesByCategory = React.useMemo(() => {
    const grouped: Record<string, (PlatformModule & { isActive: boolean })[]> = {};
    for (const m of modules) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    }
    return grouped;
  }, [modules]);

  const userTierRank = TIER_RANK[plan?.planTier || "STARTER"];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white relative overflow-hidden font-[Outfit,sans-serif]" data-testid="onboarding-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        .ob-bg::before, .ob-bg::after {
          content:""; position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none;
        }
        .ob-bg::before { width:600px; height:600px; background:rgba(59,130,246,.12); top:-200px; right:-200px; }
        .ob-bg::after  { width:500px; height:500px; background:rgba(168,85,247,.10); bottom:-150px; left:-150px; }
        .ob-grid {
          background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
          background-size: 48px 48px;
        }
        .glass { background: rgba(255,255,255,.04); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.08); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .anim-fade { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
        .sector-card, .mod-card {
          padding: 18px; border-radius: 16px; cursor: pointer; text-align: left;
          background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.08);
          transition: all .2s; position: relative; overflow: hidden;
        }
        .sector-card:hover, .mod-card:hover:not(.locked) {
          background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.18); transform: translateY(-2px);
        }
        .sector-card.selected, .mod-card.selected {
          border-color: #60a5fa; background: rgba(96,165,250,.1);
          box-shadow: 0 0 0 1px #60a5fa, 0 8px 30px rgba(96,165,250,.15);
        }
        .mod-card.locked { opacity: .5; cursor: not-allowed; }
        .btn-primary {
          height:48px; padding: 0 28px; border-radius:12px; border:0; cursor:pointer;
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
          transition: background .15s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,.1); }
        .tier-badge {
          font-size: 10px; font-weight: 700; letter-spacing: .05em;
          padding: 2px 8px; border-radius: 999px; text-transform: uppercase;
        }
        .tier-STARTER { background: rgba(34,197,94,.15); color: #86efac; }
        .tier-PRO { background: rgba(96,165,250,.15); color: #93c5fd; }
        .tier-ENTERPRISE { background: rgba(168,85,247,.15); color: #c4b5fd; }
      `}</style>

      <div className="ob-bg ob-grid absolute inset-0 -z-10" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 anim-fade">
          <Image src="/doflow_logo.svg" alt="Doflow" width={120} height={32} className="brightness-0 invert opacity-90" />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/40">Piano:</span>
            <span className={`tier-badge tier-${plan?.planTier}`} data-testid="onboarding-plan-badge">{plan?.planTier}</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 mb-10 anim-fade">
          {[
            { n: 1, label: "Settore" },
            { n: 2, label: "Moduli" },
            { n: 3, label: "Conferma" },
          ].map(({ n, label }, idx) => (
            <React.Fragment key={n}>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
                step === n ? "bg-blue-400/20 border border-blue-400/40 text-white" :
                step > n ? "bg-green-400/15 border border-green-400/30 text-green-300" :
                "bg-white/5 border border-white/10 text-white/50"
              }`} data-testid={`onb-step-${n}`}>
                {step > n ? <Check size={12} strokeWidth={3} /> : <span>{n}</span>}
                {label}
              </div>
              {idx < 2 && <div className="w-8 h-px bg-white/10" />}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-400/30 px-4 py-3 text-sm text-red-300" data-testid="onboarding-error">
            <AlertCircle size={15} />{error}
          </div>
        )}

        {/* STEP 1 — SECTOR */}
        {step === 1 && (
          <div className="anim-fade" data-testid="onboarding-step-1">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-3">Benvenuto in Doflow! 👋</h1>
              <p className="text-white/55 text-base max-w-2xl mx-auto">
                In che settore opera la tua azienda? Useremo questa info per pre-selezionare i moduli più utili per te.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 max-w-6xl mx-auto">
              {SECTORS.map(s => {
                const Icon = s.icon;
                const sel = selectedSector === s.id;
                return (
                  <button key={s.id} onClick={() => applySector(s.id)}
                    className={`sector-card ${sel ? "selected" : ""}`}
                    data-testid={`onb-sector-${s.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-400/15 flex items-center justify-center">
                        <Icon size={20} className="text-blue-400" />
                      </div>
                      {sel && <Check size={16} className="text-blue-400" />}
                    </div>
                    <div className="font-bold text-base mb-1">{s.name}</div>
                    <div className="text-xs text-white/45">{s.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center mt-10">
              <button onClick={() => setStep(2)} disabled={!selectedSector} className="btn-primary" data-testid="onb-step1-next-btn">
                Continua <ArrowRight size={16} className="inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — MODULES */}
        {step === 2 && (
          <div className="anim-fade" data-testid="onboarding-step-2">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Scegli le tue funzioni</h1>
              <p className="text-white/55 text-sm max-w-2xl mx-auto">
                Hai selezionato <span className="font-bold text-white">{selectedModules.size}</span> moduli.
                Quelli con lucchetto richiedono un piano superiore al tuo ({plan?.planTier}).
              </p>
            </div>

            <div className="space-y-8 max-w-6xl mx-auto">
              {Object.entries(modulesByCategory).map(([cat, mods]) => {
                const meta = CATEGORY_META[cat] || { label: cat, icon: Briefcase, color: "text-white/60" };
                const Icon = meta.icon;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-4">
                      <Icon className={meta.color} size={18} />
                      <h3 className="text-lg font-bold">{meta.label}</h3>
                      <div className="flex-1 h-px bg-white/8" />
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {mods.map(m => {
                        const locked = TIER_RANK[m.minTier] > userTierRank;
                        const sel = selectedModules.has(m.key);
                        return (
                          <button key={m.key} onClick={() => toggleModule(m.key)}
                            disabled={locked}
                            className={`mod-card ${sel ? "selected" : ""} ${locked ? "locked" : ""}`}
                            data-testid={`onb-mod-${m.key}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-bold text-sm">{m.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {m.isBeta && <span className="tier-badge tier-PRO">Beta</span>}
                                <span className={`tier-badge tier-${m.minTier}`}>{m.minTier}</span>
                                {locked ? <Lock size={13} className="text-white/30" /> : sel ? <Check size={14} className="text-blue-400" /> : null}
                              </div>
                            </div>
                            <p className="text-xs text-white/50 leading-relaxed mb-2">{m.description}</p>
                            {m.priceMonthly > 0 && (
                              <p className="text-xs text-white/40">
                                {m.priceMonthly === 0 ? "Gratis" : `+€${m.priceMonthly}/mese`}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between gap-3 mt-10 max-w-6xl mx-auto">
              <button onClick={() => setStep(1)} className="btn-secondary" data-testid="onb-step2-back-btn">
                <ArrowLeft size={16} /> Indietro
              </button>
              <button onClick={() => setStep(3)} disabled={selectedModules.size === 0} className="btn-primary" data-testid="onb-step2-next-btn">
                Continua ({selectedModules.size} moduli) <ArrowRight size={16} className="inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — CONFIRM */}
        {step === 3 && (
          <div className="anim-fade max-w-3xl mx-auto" data-testid="onboarding-step-3">
            <div className="text-center mb-8">
              <Sparkles size={32} className="mx-auto text-blue-400 mb-3" />
              <h1 className="text-3xl font-bold mb-2">Tutto pronto!</h1>
              <p className="text-white/55 text-sm">Ecco il riepilogo della tua configurazione</p>
            </div>

            <div className="glass rounded-3xl p-8 space-y-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Settore</div>
                <div className="text-base font-bold" data-testid="onb-summary-sector">{SECTORS.find(s => s.id === selectedSector)?.name}</div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Moduli attivi ({selectedModules.size})</div>
                <div className="flex flex-wrap gap-2" data-testid="onb-summary-modules">
                  {Array.from(selectedModules).map(key => {
                    const mod = modules.find(m => m.key === key);
                    if (!mod) return null;
                    return (
                      <span key={key} className="px-3 py-1.5 rounded-lg bg-blue-400/10 border border-blue-400/20 text-xs font-semibold">
                        {mod.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-500/8 to-purple-500/8 border border-blue-400/20">
                <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles size={12} /> Bonus benvenuto
                </div>
                <div className="text-sm text-white/85">
                  14 giorni di trial gratuito sui moduli Pro inclusi. Nessuna carta richiesta.
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3 mt-8">
              <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary" data-testid="onb-step3-back-btn">
                <ArrowLeft size={16} /> Indietro
              </button>
              <button onClick={completeOnboarding} disabled={submitting} className="btn-primary" data-testid="onb-complete-btn">
                {submitting ? (
                  <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Salvataggio...</span>
                ) : (
                  <>Inizia ad usare Doflow <ArrowRight size={16} className="inline ml-1" /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
