// apps/frontend/src/components/login-form.tsx
// Design: split editorial allineato a Doflow UI Review v2
// Logica auth: 100% invariata

"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Eye, EyeOff, Loader2, AlertCircle, Mail, Lock } from "lucide-react";

const MAIN_DB_NAME = "public";

type JwtPayload = {
  email?: string; role?: string; tenantId?: string;
  tenant_id?: string; tenantSlug?: string; authStage?: string; mfa_pending?: boolean;
};

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch { return null; }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase().replace(/[^A-Z_]/g, "");
  if (["OWNER", "SUPERADMIN", "SUPER_ADMIN"].includes(r)) return "SUPER_ADMIN";
  return "USER";
}

function isMfaPending(payload?: any) {
  return payload?.mfa_pending === true || payload?.authStage === "MFA_PENDING";
}

const loginSchema = z.object({
  email: z.string().min(1, "L'email è obbligatoria").email("Inserisci un'email valida"),
  password: z.string().min(1, "La password è obbligatoria"),
  rememberMe: z.boolean().optional(),
});
type LoginFormValues = z.infer<typeof loginSchema>;

type LoginResponse = {
  token: string; error?: string; message?: string;
  mfa?: { required?: boolean; pending?: boolean; redirect?: string };
  user?: { tenantSlug?: string; tenant_id?: string; schema?: string; role?: string };
};

function getHostContext() {
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "app.doflow.it";
  const isAppHost = host.startsWith("app.") || host.startsWith("admin.") || host === "doflow.it" || host.includes("localhost");
  const subdomain = host.endsWith(".doflow.it") ? host.replace(".doflow.it", "").split(".")[0] : null;
  const tenantSub = !isAppHost && subdomain && !["app","admin","api","www"].includes(subdomain) ? subdomain : null;
  return { host, isAppHost, tenantSub };
}

const SLIDES = [
  { tag: "CRM & Pipeline", title: "Tutto il tuo business\nin un unico posto.", desc: "Gestisci lead, opportunità e clienti con una pipeline visuale. Zero fogli Excel, zero caos." },
  { tag: "Fatturazione automatica", title: "Preventivi e fatture\nin pochi secondi.", desc: "Genera documenti professionali, invia via email e tieni traccia dei pagamenti in automatico." },
  { tag: "Analytics in tempo reale", title: "Dati chiari,\ndecisioni migliori.", desc: "Dashboard in tempo reale su vendite, performance e KPI. Tutte le metriche che contano davvero." },
];

const STATS = [
  { value: "3x", label: "più veloce" },
  { value: "99.9%", label: "uptime" },
  { value: "24/7", label: "supporto" },
];

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [showTenantRedirect, setShowTenantRedirect] = React.useState(false);
  const [tenantRedirectUrl, setTenantRedirectUrl] = React.useState<string | null>(null);
  const [tenantDialogMode, setTenantDialogMode] = React.useState<"redirect" | "info">("redirect");
  const [slideIdx, setSlideIdx] = React.useState(0);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("accessToken");
    if (tokenFromUrl) {
      window.localStorage.removeItem("doflow_token");
      window.localStorage.setItem("doflow_token", tokenFromUrl);
      const payload = parseJwtPayload(tokenFromUrl);
      const tenantSlug = payload?.tenantSlug || payload?.tenantId;
      const next = (params.get("next") || "").toLowerCase();
      const goMfa = next === "mfa" || isMfaPending(payload);
      if (tenantSlug && tenantSlug !== "public") {
        window.location.href = goMfa ? `/${tenantSlug}/mfa` : `/${tenantSlug}/dashboard`;
      } else {
        window.location.href = goMfa ? `/mfa` : `/dashboard`;
      }
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setSlideIdx((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!showTenantRedirect || !tenantRedirectUrl) return;
    const t = setTimeout(() => { window.location.href = tenantRedirectUrl; }, 2000);
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
        method: "POST", auth: false, headers,
        body: JSON.stringify({ email: values.email, password: values.password, realm, tenantSlug: tenantSub ?? undefined }),
      });
      if (data?.error) throw new Error(data.error || data.message);
      if (!data?.token) throw new Error("Token di accesso mancante");
      const token = data.token;
      const payload = parseJwtPayload(token);
      const role = normalizeRole(payload?.role);
      let targetTenant = "public";
      if (data.user?.schema || data.user?.tenantSlug || data.user?.tenant_id) {
        targetTenant = (data.user.schema || data.user.tenantSlug || data.user.tenant_id || "public").toLowerCase();
      } else if (payload?.tenantSlug || payload?.tenantId || payload?.tenant_id) {
        targetTenant = (payload.tenantSlug || payload.tenantId || payload.tenant_id || "public").toLowerCase();
      }
      const mfaRequired = data?.mfa?.required === true || isMfaPending(payload);
      if (mfaRequired) {
        window.localStorage.setItem("doflow_token", token);
        if (isAppHost) {
          if (targetTenant !== "public" && /^[a-z0-9_]+$/i.test(targetTenant)) {
            setTenantRedirectUrl(`https://${targetTenant}.doflow.it/login?accessToken=${encodeURIComponent(token)}&next=mfa`);
            setTenantDialogMode("redirect"); setShowTenantRedirect(true); return;
          }
          router.push(`/mfa`); return;
        }
        router.push(tenantSub ? `/${tenantSub}/mfa` : `/mfa`); return;
      }
      if (role === "SUPER_ADMIN") { window.localStorage.setItem("doflow_token", token); router.push("/superadmin"); return; }
      if (isAppHost) {
        if (targetTenant !== "public" && /^[a-z0-9_]+$/i.test(targetTenant)) {
          setTenantRedirectUrl(`https://${targetTenant}.doflow.it/login?accessToken=${encodeURIComponent(token)}`);
          setTenantDialogMode("redirect"); setShowTenantRedirect(true); return;
        }
        window.localStorage.setItem("doflow_token", token); router.push("/dashboard"); return;
      }
      window.localStorage.setItem("doflow_token", token);
      router.push(tenantSub ? `/${tenantSub}/dashboard` : "/dashboard");
    } catch (err: any) {
      setGeneralError(err?.message || "Si è verificato un errore imprevisto.");
    }
  };

  const slide = SLIDES[slideIdx];

  return (
    <>
      <style>{`
        .df-wrap * { font-family:var(--font-sans); }
        @keyframes dfUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .df-a{animation:dfUp .45s ease both}
        .df-a1{animation-delay:.04s}.df-a2{animation-delay:.09s}.df-a3{animation-delay:.13s}
        .df-a4{animation-delay:.17s}.df-a5{animation-delay:.21s}.df-a6{animation-delay:.25s}.df-a7{animation-delay:.29s}
        @keyframes dfSlide { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
        .df-slide-anim{animation:dfSlide .5s ease both}
        .df-input{
          display:block;width:100%;height:44px;border-radius:12px;
          border:1px solid var(--df-line-2);background:var(--df-surface);
          font-size:14px;font-family:var(--font-sans);
          padding:0 44px 0 40px;outline:none;
          transition:border-color .18s,background .18s,box-shadow .18s;
          color:var(--df-ink);
        }
        .df-input::placeholder{color:var(--df-muted-2)}
        .df-input:focus{background:#fff;border-color:var(--df-accent);box-shadow:0 0 0 3px rgba(91,91,214,.12)}
        .df-input.err{border-color:#ef4444}
        .df-input.err:focus{box-shadow:0 0 0 3px rgba(239,68,68,.1)}
        .df-primary{
          width:100%;height:44px;border-radius:12px;border:none;cursor:pointer;
          font-size:14px;font-weight:600;font-family:var(--font-sans);
          color:#fff;background:var(--df-accent);
          box-shadow:var(--shadow-button);
          transition:all .2s;letter-spacing:.01em;
        }
        .df-primary:hover:not(:disabled){background:#4E4EC8;transform:translateY(-1px);box-shadow:0 12px 28px -16px rgba(91,91,214,.75)}
        .df-primary:active:not(:disabled){transform:translateY(0)}
        .df-primary:disabled{opacity:.6;cursor:not-allowed}
        .df-social{
          flex:1;height:42px;border-radius:12px;border:1px solid var(--df-line);
          background:var(--df-surface);cursor:pointer;display:flex;align-items:center;
          justify-content:center;gap:7px;font-size:13px;font-weight:600;
          font-family:var(--font-sans);color:var(--df-ink-2);
          transition:border-color .15s,background .15s;
        }
        .df-social:hover{border-color:var(--df-line-2);background:var(--df-surface-2)}
        .df-divider{display:flex;align-items:center;gap:10px;color:var(--df-muted-2);font-size:11px;font-family:var(--font-mono);font-weight:500;text-transform:uppercase;letter-spacing:.12em}
        .df-divider::before,.df-divider::after{content:'';flex:1;height:1px;background:var(--df-line)}
        .df-grid-bg{
          background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
          background-size:36px 36px;
        }
        .df-stat{
          background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);
          border-radius:14px;padding:14px 10px;text-align:center;
          backdrop-filter:blur(8px);
        }
        .df-card{
          background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
          border-radius:20px;padding:28px;backdrop-filter:blur(10px);
        }
        .df-dot{
          border-radius:999px;cursor:pointer;
          border:none;background:rgba(255,255,255,.25);
          transition:all .3s;height:5px;
        }
        .df-dot.active{background:#60a5fa;width:22px!important}

        /* ── Wave animation ── */
        @keyframes dfWave1 {
          0%   { d: path("M0,60 C120,20 240,100 360,60 C480,20 600,100 720,60 C840,20 960,100 1080,60 L1080,200 L0,200 Z"); }
          50%  { d: path("M0,80 C120,40 240,120 360,80 C480,40 600,120 720,80 C840,40 960,120 1080,80 L1080,200 L0,200 Z"); }
          100% { d: path("M0,60 C120,20 240,100 360,60 C480,20 600,100 720,60 C840,20 960,100 1080,60 L1080,200 L0,200 Z"); }
        }
        @keyframes dfWave2 {
          0%   { d: path("M0,80 C150,40 300,120 450,80 C600,40 750,120 900,80 C1000,50 1060,90 1080,80 L1080,200 L0,200 Z"); }
          50%  { d: path("M0,50 C150,90 300,30 450,70 C600,110 750,30 900,70 C1000,100 1060,50 1080,60 L1080,200 L0,200 Z"); }
          100% { d: path("M0,80 C150,40 300,120 450,80 C600,40 750,120 900,80 C1000,50 1060,90 1080,80 L1080,200 L0,200 Z"); }
        }
        @keyframes dfWave3 {
          0%   { d: path("M0,90 C180,50 360,130 540,90 C720,50 900,130 1080,90 L1080,200 L0,200 Z"); }
          50%  { d: path("M0,70 C180,110 360,30 540,70 C720,110 900,30 1080,70 L1080,200 L0,200 Z"); }
          100% { d: path("M0,90 C180,50 360,130 540,90 C720,50 900,130 1080,90 L1080,200 L0,200 Z"); }
        }
        @keyframes dfFlow {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .df-wave-svg { position:absolute; bottom:0; left:0; width:200%; height:160px; }
        .df-wave1 path { animation: dfWave1 6s ease-in-out infinite; }
        .df-wave2 path { animation: dfWave2 9s ease-in-out infinite; }
        .df-wave3 path { animation: dfWave3 12s ease-in-out infinite; }
        .df-wave-wrap { animation: dfFlow 20s linear infinite; }
      `}</style>

      <AlertDialog open={showTenantRedirect} onOpenChange={setShowTenantRedirect}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-bold">Accesso al dominio aziendale</AlertDialogTitle>
            <AlertDialogDescription className="text-[15px]">
              {tenantDialogMode === "redirect" ? (
                <>Accesso effettuato. Ti stiamo reindirizzando al tuo spazio aziendale.
                  <div className="flex items-center gap-2 mt-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin"/><span>Reindirizzamento in corso...</span>
                  </div>
                </>
              ) : <>Questo account appartiene a un tenant aziendale. Accedi dal dominio della tua azienda.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!tenantRedirectUrl && <AlertDialogAction onClick={() => setShowTenantRedirect(false)}>Ok</AlertDialogAction>}
            {tenantRedirectUrl && <AlertDialogAction onClick={() => window.location.href = tenantRedirectUrl!}>Vai ora</AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="df-wrap flex min-h-screen items-center justify-center bg-background p-6 md:p-10">
        <div className="w-full max-w-[1060px]">
          <div className="grid lg:grid-cols-[420px_1fr] lg:gap-8 items-center">

            {/* LEFT */}
            <div className="flex flex-col justify-center px-4 py-10 md:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-[360px] space-y-6">

                <div className="df-a df-a1">
                  <Image src="/doflow_logo.svg" alt="Doflow" width={160} height={44} className="h-11 w-auto" priority/>
                </div>

                <div className="df-a df-a2 space-y-1">
                  <h1 className="text-[30px] font-extrabold tracking-[-0.035em] text-foreground">Accedi al tuo account</h1>
                  <p className="text-[15px] text-muted-foreground">Inserisci le tue credenziali per continuare.</p>
                </div>

                {/* Google OAuth */}
                <div className="df-a df-a3 space-y-3">
                  <button
                    type="button"
                    className="df-social"
                    aria-label="Accedi con Google"
                    data-testid="login-google-btn"
                    style={{width:"100%"}}
                    onClick={() => {
                      const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
                      const origin = apiBase.replace(/\/api\/?$/, "");
                      window.location.href = `${origin}/api/auth/google`;
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    Continua con Google
                  </button>
                  <div className="df-divider">oppure continua con email</div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

                  {/* Email */}
                  <div className="df-a df-a4 grid gap-1.5">
                    <Label htmlFor="email" className="text-[13px] font-medium text-foreground">Indirizzo Email</Label>
                    <div style={{position:"relative"}}>
                      <Mail size={15} aria-hidden style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}/>
                      <input id="email" type="email" placeholder="nome@azienda.it" disabled={isSubmitting}
                        className={cn("df-input", errors.email && "err")} {...register("email")}/>
                    </div>
                    {errors.email && <p role="alert" className="text-[12px] text-red-500 font-medium">{errors.email.message}</p>}
                  </div>

                  {/* Password */}
                  <div className="df-a df-a5 grid gap-1.5">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <Label htmlFor="password" className="text-[13px] font-medium text-foreground">Password</Label>
                      <Link href="/forgot-password" className="text-[12px] font-semibold text-primary hover:underline">
                        Password dimenticata?
                      </Link>
                    </div>
                    <div style={{position:"relative"}}>
                      <Lock size={15} aria-hidden style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}/>
                      <input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                        disabled={isSubmitting} className={cn("df-input", errors.password && "err")} {...register("password")}/>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isSubmitting}
                        aria-label={showPassword ? "Nascondi" : "Mostra"}
                        style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}>
                        {showPassword ? <EyeOff size={16} aria-hidden/> : <Eye size={16} aria-hidden/>}
                      </button>
                    </div>
                    {errors.password && <p role="alert" className="text-[12px] text-red-500 font-medium">{errors.password.message}</p>}
                  </div>

                  {/* Remember me */}
                  <div className="df-a df-a5" style={{display:"flex",alignItems:"center",gap:10}}>
                    <input type="checkbox" id="rememberMe"
                      style={{width:16,height:16,borderRadius:4,accentColor:"#5B5BD6",cursor:"pointer",flexShrink:0}}
                      {...register("rememberMe")}/>
                    <Label htmlFor="rememberMe" className="text-[13px] text-muted-foreground cursor-pointer select-none">
                      Ricordami per 30 giorni
                    </Label>
                  </div>

                  {generalError && (
                    <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 border border-red-100">
                      <AlertCircle size={15} className="shrink-0" aria-hidden/><span>{generalError}</span>
                    </div>
                  )}

                  <div className="df-a df-a6">
                    <button type="submit" disabled={isSubmitting} className="df-primary">
                      {isSubmitting
                        ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden/>Accesso in corso...
                          </span>
                        : "Accedi"}
                    </button>
                  </div>
                </form>

                <div className="df-a df-a7 space-y-3 text-center">
                  <p className="text-[13px] text-gray-500">
                    Non hai un account?{" "}
                    <Link href="/register" className="font-semibold text-foreground hover:underline">Registrati gratis</Link>
                  </p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Accedendo accetti i{" "}
                    <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Termini</Link>
                    {" "}e la{" "}
                    <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT — floating card */}
            <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 rounded-[24px]"
              style={{background:"linear-gradient(135deg, #1B1B22 0%, #2E2A48 50%, #5B5BD6 130%)",minHeight:"740px",boxShadow:"var(--shadow-lg)"}}>
              <div className="absolute inset-0 df-grid-bg"/>
              <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
                style={{background:"radial-gradient(circle at 80% 10%,rgba(138,108,241,.22) 0%,transparent 60%)"}}/>
              <div className="absolute bottom-0 left-0 w-96 h-64 pointer-events-none"
                style={{background:"radial-gradient(circle at 20% 90%,rgba(91,91,214,.16) 0%,transparent 60%)"}}/>
              {/* Frame overlay */}
              <div className="absolute inset-[10px] rounded-[20px] pointer-events-none"
                style={{border:"1.5px solid rgba(255,255,255,.1)",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.04)"}}/>

              {/* Wave animation at bottom */}
              <div className="absolute bottom-0 left-0 w-full overflow-hidden z-0" style={{height:160}}>
                <div className="df-wave-wrap" style={{width:"200%",height:"100%",position:"relative"}}>
                  <svg className="df-wave-svg df-wave3" viewBox="0 0 1080 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0,90 C180,50 360,130 540,90 C720,50 900,130 1080,90 L1080,160 L0,160 Z" fill="rgba(138,108,241,.07)"/>
                  </svg>
                  <svg className="df-wave-svg df-wave2" viewBox="0 0 1080 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0,80 C150,40 300,120 450,80 C600,40 750,120 900,80 C1000,50 1060,90 1080,80 L1080,160 L0,160 Z" fill="rgba(91,91,214,.08)"/>
                  </svg>
                  <svg className="df-wave-svg df-wave1" viewBox="0 0 1080 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0,60 C120,20 240,100 360,60 C480,20 600,100 720,60 C840,20 960,100 1080,60 L1080,160 L0,160 Z" fill="rgba(236,236,251,.09)"/>
                  </svg>
                </div>
              </div>

              {/* Logo */}
              <div className="relative z-10">
                <Image src="/doflow_logo.svg" alt="Doflow" width={130} height={36}
                  className="h-9 w-auto brightness-0 invert opacity-80"/>
              </div>

              {/* Feature card */}
              <div className="relative z-10 space-y-5">
                <div className="df-card df-slide-anim" key={slideIdx}>
                  <span style={{
                    display:"inline-block",fontSize:11,fontWeight:700,letterSpacing:"0.08em",
                    textTransform:"uppercase",padding:"4px 12px",borderRadius:999,
                    background:"rgba(255,255,255,.12)",color:"#ECECFB",marginBottom:16
                  }}>{slide.tag}</span>
                  <h2 style={{fontSize:26,fontWeight:800,color:"#fff",lineHeight:1.25,marginBottom:12,whiteSpace:"pre-line"}}>
                    {slide.title}
                  </h2>
                  <p style={{fontSize:14,lineHeight:1.65,color:"rgba(255,255,255,.55)"}}>
                    {slide.desc}
                  </p>
                </div>

                {/* Dots */}
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {SLIDES.map((_,i) => (
                    <button key={i} onClick={() => setSlideIdx(i)} aria-label={`Slide ${i+1}`}
                      className={cn("df-dot", i === slideIdx && "active")}
                      style={{width: i === slideIdx ? 22 : 6}}/>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="relative z-10">
                <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:12}}>
                  Perché scegliere Doflow
                </p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                  {STATS.map(s => (
                    <div key={s.label} className="df-stat">
                      <p style={{fontSize:22,fontWeight:800,color:"#fff",lineHeight:1}}>{s.value}</p>
                      <p style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}