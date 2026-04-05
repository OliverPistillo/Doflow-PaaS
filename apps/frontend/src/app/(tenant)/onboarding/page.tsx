// Percorso: apps/frontend/src/app/(tenant)/onboarding/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import {
  Compass, CheckCircle2, Building2, Users, Puzzle,
  ArrowRight, ArrowLeft, Rocket, Sparkles, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type Step = { id: string; title: string; description: string; icon: React.ComponentType<{ className?: string }> };

const STEPS: Step[] = [
  { id: "welcome",  title: "Benvenuto!",        description: "Configuriamo il tuo spazio di lavoro in pochi passi.",           icon: Compass },
  { id: "company",  title: "La tua Azienda",    description: "Inserisci le informazioni base della tua azienda.",              icon: Building2 },
  { id: "team",     title: "Invita il Team",     description: "Aggiungi i primi membri del tuo team.",                          icon: Users },
  { id: "modules",  title: "Scegli i Moduli",   description: "Attiva i moduli che ti servono — potrai cambiarli in qualsiasi momento.", icon: Puzzle },
  { id: "done",     title: "Tutto pronto!",      description: "Il tuo workspace è configurato. Inizia a lavorare!",             icon: Rocket },
];

type ModuleInfo = { key: string; name: string; category: string; isActive: boolean; isBeta: boolean };

export default function OnboardingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [companyVat, setCompanyVat] = useState("");
  const [teamEmails, setTeamEmails] = useState("");
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ available: ModuleInfo[] }>("/tenant/self-service/modules");
        if (res?.available) setModules(res.available);
      } catch { /* silent */ }
    })();
  }, []);

  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const current = STEPS[step];
  const CurrentIcon = current.icon;

  const handleFinish = () => {
    toast({ title: "Onboarding completato!", description: "Buon lavoro con DoFlow." });
    router.push("/dashboard");
  };

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Passo {step + 1} di {STEPS.length}
            </p>
            <span className="text-xs font-bold text-foreground tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {/* Step dots */}
          <div className="flex justify-between mt-3">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < step ? "bg-primary text-primary-foreground" :
                  i === step ? "bg-primary/20 text-primary border-2 border-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-[10px] text-muted-foreground hidden sm:block">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <CurrentIcon className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">{current.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{current.description}</p>
              </div>
            </div>

            {/* ── Step: Welcome ─────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-sm text-foreground">Questo wizard ti guiderà nella configurazione iniziale del tuo spazio di lavoro. Ci vorranno meno di 2 minuti.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Building2, label: "Profilo azienda" },
                    { icon: Users, label: "Invita il team" },
                    { icon: Puzzle, label: "Attiva moduli" },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-xl bg-muted/50 text-center">
                      <item.icon className="h-6 w-6 mx-auto text-primary mb-2" />
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step: Company ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div><Label>Nome Azienda</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="La Mia Azienda S.r.l." /></div>
                <div><Label>Partita IVA (opzionale)</Label><Input value={companyVat} onChange={e => setCompanyVat(e.target.value)} placeholder="IT01234567890" /></div>
                <p className="text-xs text-muted-foreground">Potrai modificare queste informazioni in qualsiasi momento da Impostazioni → Azienda.</p>
              </div>
            )}

            {/* ── Step: Team ───────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>Email dei colleghi (una per riga)</Label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5 min-h-[120px]"
                    value={teamEmails}
                    onChange={e => setTeamEmails(e.target.value)}
                    placeholder={"mario.rossi@azienda.it\nlucia.bianchi@azienda.it"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Riceveranno un invito via email con le credenziali di accesso. Puoi anche saltare questo passaggio e invitarli dopo.</p>
              </div>
            )}

            {/* ── Step: Modules ─────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {modules.map(mod => (
                  <div key={mod.key} className={`p-3 rounded-xl border transition-colors ${mod.isActive ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${mod.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <Puzzle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{mod.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{mod.category}</span>
                            {mod.isBeta && <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">Beta</Badge>}
                          </div>
                        </div>
                      </div>
                      {mod.isActive && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </div>
                  </div>
                ))}
                {modules.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">I moduli saranno configurati dal tuo amministratore.</p>}
              </div>
            )}

            {/* ── Step: Done ───────────────────────────────── */}
            {step === 4 && (
              <div className="text-center py-6">
                <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-10 w-10 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Il tuo workspace è pronto!</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">Tutto configurato. Puoi iniziare a utilizzare DoFlow. Se hai bisogno di aiuto, visita la sezione Supporto.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" />Indietro
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Avanti<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleFinish}>
              <Rocket className="h-4 w-4 mr-2" />Vai alla Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
