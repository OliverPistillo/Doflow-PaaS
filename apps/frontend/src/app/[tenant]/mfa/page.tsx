"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, RefreshCw, KeyRound, QrCode, Lock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type StartResp =
  | {
      mode: "challenge";
      method: "totp";
      email: string;
      remainingAttempts: number;
      lockedUntil: string | null;
    }
  | {
      mode: "setup";
      method: "totp";
      email: string;
      issuer: string;
      otpauthUrl: string | null;
      qrDataUrl: string | null;
    };

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function msUntil(iso: string | null) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, t - now);
}

function normalizeCode(v: string) {
  return v.replace(/[^\d]/g, "").slice(0, 6);
}

export default function TenantMfaPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const search = useSearchParams();

  const tenant = String(params?.tenant || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState<StartResp | null>(null);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // lock UI
  const [lockMs, setLockMs] = useState(0);

  const title = useMemo(() => {
    if (!start) return "Verifica MFA";
    return start.mode === "setup" ? "Attiva MFA" : "Verifica MFA";
  }, [start]);

  const locked = useMemo(() => lockMs > 0, [lockMs]);

  const nextParam = (search.get("next") || "").toLowerCase();
  const nextAfter = nextParam === "dashboard" ? `/${tenant}/dashboard` : `/${tenant}/dashboard`;

  const ensureHasPendingToken = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("doflow_token") : null;
    if (!token) {
      toast({
        title: "Sessione mancante",
        description: "Token non trovato. Effettua di nuovo il login.",
        variant: "destructive",
      });
      router.replace(tenant ? `/${tenant}/login` : "/login");
      return false;
    }
    return true;
  };

  const load = async () => {
    if (!ensureHasPendingToken()) return;

    setLoading(true);
    try {
      // BE prende userId dal token (mfa_pending) via auth middleware, quindi non serve inviare userId qui.
      const data = await apiFetch<StartResp>("/auth/mfa/start", { method: "POST" });
      setStart(data);

      // aggiorna lock state
      if (data.mode === "challenge") {
        const ms = msUntil(data.lockedUntil);
        setLockMs(ms);
      } else {
        setLockMs(0);
      }
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Impossibile avviare MFA",
        variant: "destructive",
      });
      setStart(null);
      setLockMs(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // countdown lock
  useEffect(() => {
    if (!lockMs) return;
    const t = setInterval(() => {
      setLockMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lockMs]);

  const submit = async () => {
    if (!ensureHasPendingToken()) return;

    if (!start) {
      toast({
        title: "MFA non pronta",
        description: "Riprova ad avviare MFA.",
        variant: "destructive",
      });
      return;
    }

    if (locked) {
      toast({
        title: "Temporaneamente bloccato",
        description: "Troppi tentativi. Riprova più tardi.",
        variant: "destructive",
      });
      return;
    }

    const clean = normalizeCode(code);
    if (!/^\d{6}$/.test(clean)) {
      toast({
        title: "Codice non valido",
        description: "Inserisci un codice a 6 cifre.",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      const res = await apiFetch<{ ok: boolean; token: string; user: any }>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: clean }),
      });

      // ✅ salva token FULL dove lo usa tutto il FE
      localStorage.setItem("doflow_token", res.token);

      toast({
        title: "OK",
        description: "Accesso verificato.",
      });

      router.replace(nextAfter);
    } catch (e: any) {
      const msg = e?.message || "Codice errato o scaduto.";

      toast({
        title: "MFA fallita",
        description: msg,
        variant: "destructive",
      });

      // ricarica lo stato (attempts/lock)
      await load();
    } finally {
      setVerifying(false);
    }
  };

  const lockLabel = useMemo(() => {
    if (!start || start.mode !== "challenge" || !start.lockedUntil) return null;
    if (!locked) return null;
    return `Bloccato fino a ${fmtDateTime(start.lockedUntil)}`;
  }, [start, locked]);

  const lockCountdown = useMemo(() => {
    if (!locked) return null;
    const s = Math.ceil(lockMs / 1000);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }, [locked, lockMs]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold">
            <ShieldCheck className="h-4 w-4" />
            DOFLOW SECURE ACCESS
          </div>
          <h1 className="mt-4 text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="mt-2 text-slate-500 font-medium">
            {start?.email ? (
              <>
                Utente: <span className="font-semibold text-slate-700">{start.email}</span>
              </>
            ) : (
              "Caricamento…"
            )}
          </p>
        </div>

        <Card className="p-6 rounded-2xl border border-slate-200 shadow-sm bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Avvio challenge…
            </div>
          ) : !start ? (
            <div className="text-center py-8 text-slate-500">
              Non è stato possibile avviare MFA.
              <div className="mt-4">
                <Button variant="outline" onClick={load}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Riprova
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {start.mode === "setup" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 border border-amber-200 text-amber-800">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-slate-900">Attivazione richiesta</div>
                      <div className="text-sm text-slate-700 mt-1">
                        Scansiona il QR con Google Authenticator (o compatibile), poi inserisci il codice a 6 cifre.
                      </div>
                    </div>
                  </div>

                  {start.qrDataUrl && (
                    <div className="mt-4 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={start.qrDataUrl}
                        alt="MFA QR Code"
                        className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2"
                      />
                    </div>
                  )}

                  {!start.qrDataUrl && start.otpauthUrl && (
                    <div className="mt-4 text-xs text-slate-600 break-all">
                      Se non vedi il QR, usa questo URL:
                      <div className="mt-2 font-mono bg-white border border-slate-200 rounded-lg p-3">
                        {start.otpauthUrl}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {start.mode === "challenge" && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div>Inserisci il codice dal tuo Authenticator.</div>
                  {typeof start.remainingAttempts === "number" && (
                    <div className="mt-1 text-xs text-slate-500">
                      Tentativi rimanenti: <span className="font-semibold">{start.remainingAttempts}</span>
                    </div>
                  )}

                  {locked && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                      <Lock className="h-4 w-4 mt-0.5" />
                      <div className="text-xs">
                        <div className="font-bold">Troppi tentativi.</div>
                        <div className="mt-1">
                          {lockLabel}
                          {lockCountdown ? (
                            <>
                              {" "}
                              — <span className="font-mono font-bold">{lockCountdown}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Codice (6 cifre)</label>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(normalizeCode(e.target.value))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="text-lg font-mono tracking-widest"
                    disabled={verifying || locked}
                  />
                  <Button
                    onClick={submit}
                    disabled={verifying || locked}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {verifying ? "Verifica…" : "Verifica"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={load} disabled={loading || verifying}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Rigenera
                </Button>
                <Button variant="ghost" onClick={() => router.replace(tenant ? `/${tenant}/login` : "/login")}>
                  Torna al login
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="text-center text-xs text-slate-400">
          Se perdi il dispositivo MFA, un superadmin può resettare MFA dall’OPS panel.
        </div>
      </div>
    </div>
  );
}
