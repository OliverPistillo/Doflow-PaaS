"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, RefreshCw, QrCode, Lock, CheckCircle2, ArrowLeft, Copy, Check } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

// Helper per decodificare il token JWT e leggere authStage
function parseJwtPayload(token: string) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function normalizeCode(v: string) {
  return v.replace(/[^\d]/g, "").slice(0, 6);
}

export default function TenantMfaPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const tenantSlug = String(params?.tenant || "").toLowerCase();

  // Stati applicativi
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"SETUP" | "VERIFY">("VERIFY");
  
  // Dati per Setup
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpUrl, setOtpUrl] = useState<string | null>(null);

  // Input Utente
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ==========================================
  // 1. INIT: Controlla Token e Stage
  // ==========================================
  useEffect(() => {
    initMfa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initMfa = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("doflow_token") : null;
    
    if (!token) {
      // Nessun token -> Login
      router.replace(tenantSlug ? `/${tenantSlug}/login` : "/login");
      return;
    }

    const payload = parseJwtPayload(token);
    const stage = payload?.authStage;

    if (stage === "FULL") {
      // Già autenticato -> Dashboard
      router.replace(tenantSlug ? `/${tenantSlug}/dashboard` : "/dashboard");
      return;
    }

    if (stage === "MFA_SETUP_NEEDED") {
      setMode("SETUP");
      await fetchSetupData();
    } else {
      // MFA_PENDING o fallback -> Verify
      setMode("VERIFY");
      setLoading(false);
    }
  };

  // ==========================================
  // 2. SETUP: Scarica QR dal Backend
  // ==========================================
  const fetchSetupData = async () => {
    try {
      // Chiama GET /auth/mfa/setup (JWT temporaneo viene inviato automaticamente da apiFetch se configurato)
      const res = await apiFetch<{ secret: string; qrCodeUrl: string; otpauthUrl: string }>("/auth/mfa/setup");
      setQrCode(res.qrCodeUrl);
      setSecret(res.secret);
      setOtpUrl(res.otpauthUrl);
    } catch (e: any) {
      toast({
        title: "Errore Setup",
        description: "Impossibile generare i dati MFA. " + (e.message || ""),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. ACTIONS
  // ==========================================
  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast({
        description: "Codice segreto copiato negli appunti.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Errore",
        description: "Impossibile copiare il codice.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) return;

    setSubmitting(true);
    try {
      let res: { token?: string; error?: string; status?: string };

      if (mode === "SETUP") {
        // SETUP: Inviamo codice + secret per confermare e salvare nel DB
        res = await apiFetch("/auth/mfa/confirm", {
          method: "POST",
          body: JSON.stringify({ code, secret }),
        });
      } else {
        // VERIFY: Inviamo solo codice (secret è già nel DB)
        res = await apiFetch("/auth/mfa/verify", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
      }

      if (res.token) {
        // Successo! Salviamo il token FULL
        localStorage.setItem("doflow_token", res.token);
        
        toast({
          title: "Accesso Effettuato",
          description: "Autenticazione MFA completata con successo.",
        });

        // Redirect intelligente
        const p = parseJwtPayload(res.token);
        const targetSlug = p?.tenantSlug || tenantSlug;
        
        if (targetSlug && targetSlug !== 'public') {
            window.location.href = `/${targetSlug}/dashboard`;
        } else {
            window.location.href = "/dashboard";
        }
      } else {
        throw new Error(res.error || "Errore sconosciuto");
      }
    } catch (e: any) {
      toast({
        title: "Codice non valido",
        description: e.message || "Riprova con un nuovo codice.",
        variant: "destructive",
      });
      setCode(""); // Pulisci input per riprovare
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen doflow-app-frame flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground animate-pulse">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
          <p>Caricamento sicurezza...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen doflow-app-frame flex items-center justify-center p-4 lg:p-6">
      <Card className="w-full max-w-md df-glass-panel rounded-[32px] p-8 lg:p-10 overflow-hidden relative">
        <div className="animate-fadeInUp space-y-6">
          {/* Header Icon */}
          <div className="flex flex-col items-center text-center space-y-4 mb-2">
            <div className="df-icon-bubble h-16 w-16">
              {mode === "SETUP" ? <QrCode className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {mode === "SETUP" ? "Configura MFA" : "Verifica Accesso"}
            </h1>
            <p className="text-sm text-muted-foreground px-2 leading-relaxed">
              {mode === "SETUP"
                ? "Per proteggere il tuo account, scansiona il QR code con la tua app Authenticator (Google/Microsoft)."
                : "Inserisci il codice a 6 cifre generato dalla tua app di autenticazione."}
            </p>
          </div>

          {/* QR Code Section (Solo SETUP) */}
          {mode === "SETUP" && qrCode && (
            <div className="flex flex-col items-center mb-2 animate-in fade-in zoom-in duration-300">
              <div className="border-4 border-white shadow-lg rounded-xl overflow-hidden bg-white">
                <Image src={qrCode} alt="QR Code" width={180} height={180} priority />
              </div>

              {/* Fallback Text */}
              <div className="mt-6 w-full">
                <p className="text-[11px] text-muted-foreground text-center mb-2 font-medium uppercase tracking-wider">Non riesci a scansionare? Usa il codice segreto:</p>
                <div className="flex items-center gap-2 p-2 bg-secondary/50 border border-border rounded-xl group transition-colors hover:bg-secondary">
                  <code className="flex-1 text-[12px] font-mono text-foreground px-2 truncate font-semibold">
                    {secret}
                  </code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                        onClick={handleCopySecret}
                        aria-label="Copia codice segreto"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {copied ? "Copiato!" : "Copia segreto"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 flex flex-col items-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => setCode(normalizeCode(v))}
                disabled={submitting}
                aria-label="Codice di verifica a 6 cifre"
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold shadow-button"
              disabled={submitting || code.length !== 6}
            >
              {submitting ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Verifica in corso...
                </>
              ) : mode === "SETUP" ? (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" /> Attiva e Accedi
                </>
              ) : (
                "Verifica Codice"
              )}
            </Button>
          </form>

          {/* Footer Actions */}
          <div className="mt-8 pt-6 border-t border-border text-center">
            <Button
              variant="link"
              className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              onClick={() => router.replace(tenantSlug ? `/${tenantSlug}/login` : "/login")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Torna al login
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
