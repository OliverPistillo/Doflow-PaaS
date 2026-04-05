"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, RefreshCw, QrCode, Lock, CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  // 3. SUBMIT: Confirm o Verify
  // ==========================================
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-500 animate-pulse">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
          <p>Caricamento sicurezza...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-xl border-slate-200 bg-white">
        
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
          <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
            {mode === "SETUP" ? <QrCode className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "SETUP" ? "Configura MFA" : "Verifica Accesso"}
          </h1>
          <p className="text-sm text-slate-500 px-4">
            {mode === "SETUP" 
              ? "Per proteggere il tuo account, scansiona il QR code con la tua app Authenticator (Google/Microsoft)."
              : "Inserisci il codice a 6 cifre generato dalla tua app di autenticazione."}
          </p>
        </div>

        {/* QR Code Section (Solo SETUP) */}
        {mode === "SETUP" && qrCode && (
          <div className="flex flex-col items-center mb-6 animate-in fade-in zoom-in duration-300">
            <div className="border-4 border-white shadow-lg rounded-xl overflow-hidden">
              <Image src={qrCode} alt="QR Code" width={180} height={180} priority />
            </div>
            
            {/* Fallback Text */}
            <details className="mt-4 text-xs text-slate-400 cursor-pointer text-center w-full">
              <summary className="hover:text-indigo-600 transition-colors">Non riesci a scansionare?</summary>
              <div className="mt-2 p-3 bg-slate-100 rounded border border-slate-200 font-mono break-all select-all text-slate-600">
                {secret}
              </div>
            </details>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Lock className="h-5 w-5" />
              </div>
              <Input
                className="pl-10 text-center text-2xl tracking-[0.5em] font-mono h-14 border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                autoFocus
                disabled={submitting}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? (
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
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
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <Button 
            variant="link" 
            className="text-xs text-slate-400 hover:text-slate-600" 
            onClick={() => router.replace(tenantSlug ? `/${tenantSlug}/login` : "/login")}
          >
            Torna al login
          </Button>
        </div>
      </Card>
    </div>
  );
}