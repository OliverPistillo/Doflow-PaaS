// apps/frontend/src/components/login-form.tsx
// Design: split-panel (form sx / brand panel dx #1a2332)
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
        @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap');
        .df-wrap * { font-family:'Urbanist',sans-serif; }
        @keyframes dfUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .df-a{animation:dfUp .45s ease both}
        .df-a1{animation-delay:.04s}.df-a2{animation-delay:.09s}.df-a3{animation-delay:.13s}
        .df-a4{animation-delay:.17s}.df-a5{animation-delay:.21s}.df-a6{animation-delay:.25s}.df-a7{animation-delay:.29s}
        @keyframes dfSlide { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
        .df-slide-anim{animation:dfSlide .5s ease both}
        .df-input{
          display:block;width:100%;height:44px;border-radius:12px;
          border:1.5px solid #e5e7eb;background:#f9fafb;
          font-size:14px;font-family:'Urbanist',sans-serif;
          padding:0 44px 0 40px;outline:none;
          transition:border-color .18s,background .18s,box-shadow .18s;
          color:#111827;
        }
        .df-input::placeholder{color:#9ca3af}
        .df-input:focus{background:#fff;border-color:#1a2332;box-shadow:0 0 0 3px rgba(26,35,50,.09)}
        .df-input.err{border-color:#ef4444}
        .df-input.err:focus{box-shadow:0 0 0 3px rgba(239,68,68,.1)}
        .df-primary{
          width:100%;height:44px;border-radius:12px;border:none;cursor:pointer;
          font-size:14px;font-weight:700;font-family:'Urbanist',sans-serif;
          color:#fff;background:#1a2332;
          box-shadow:0 4px 14px rgba(26,35,50,.3);
          transition:all .2s;letter-spacing:.01em;
        }
        .df-primary:hover:not(:disabled){background:#243045;transform:translateY(-1px);box-shadow:0 6px 20px rgba(26,35,50,.35)}
        .df-primary:active:not(:disabled){transform:translateY(0)}
        .df-primary:disabled{opacity:.6;cursor:not-allowed}
        .df-social{
          flex:1;height:42px;border-radius:12px;border:1.5px solid #e5e7eb;
          background:#fff;cursor:pointer;display:flex;align-items:center;
          justify-content:center;gap:7px;font-size:13px;font-weight:600;
          font-family:'Urbanist',sans-serif;color:#374151;
          transition:border-color .15s,background .15s;
        }
        .df-social:hover{border-color:#d1d5db;background:#f9fafb}
        .df-divider{display:flex;align-items:center;gap:10px;color:#9ca3af;font-size:12px;font-weight:500}
        .df-divider::before,.df-divider::after{content:'';flex:1;height:1px;background:#e5e7eb}
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

      <div className="df-wrap flex min-h-screen items-center justify-center bg-[#edf0f4] p-4 md:p-8">
        <div className="w-full max-w-[1060px] overflow-hidden rounded-[26px]"
          style={{boxShadow:"0 24px 80px rgba(0,0,0,.16),0 4px 16px rgba(0,0,0,.08)"}}>
          <div className="grid lg:grid-cols-[460px_1fr]">

            {/* LEFT */}
            <div className="flex flex-col justify-center bg-white px-8 py-10 md:px-10 lg:px-12">
              <div className="mx-auto w-full max-w-[360px] space-y-6">

                <div className="df-a df-a1">
                  <Image src="/doflow_logo.svg" alt="Doflow" width={120} height={32} className="h-8 w-auto" priority/>
                </div>

                <div className="df-a df-a2 space-y-1">
                  <h1 className="text-[24px] font-bold tracking-tight text-gray-900">Accedi al tuo account</h1>
                  <p className="text-[13.5px] text-gray-500">Inserisci le tue credenziali per continuare.</p>
                </div>

                {/* Social */}
                <div className="df-a df-a3 space-y-3">
                  <div style={{display:"flex",gap:"10px"}}>
                    <button type="button" className="df-social" aria-label="Accedi con Google">
                      <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                      </svg>
                      Google
                    </button>
                    <button type="button" className="df-social" aria-label="Accedi con GitHub">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                      </svg>
                      GitHub
                    </button>
                  </div>
                  <div className="df-divider">oppure continua con email</div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

                  {/* Email */}
                  <div className="df-a df-a4 grid gap-1.5">
                    <Label htmlFor="email" className="text-[13px] font-semibold text-gray-700">Indirizzo Email</Label>
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
                      <Label htmlFor="password" className="text-[13px] font-semibold text-gray-700">Password</Label>
                      <Link href="/forgot-password" className="text-[12px] font-semibold text-[#1a2332] hover:underline">
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
                      style={{width:16,height:16,borderRadius:4,accentColor:"#1a2332",cursor:"pointer",flexShrink:0}}
                      {...register("rememberMe")}/>
                    <Label htmlFor="rememberMe" className="text-[13px] text-gray-600 cursor-pointer select-none">
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
                    <Link href="/register" className="font-semibold text-[#1a2332] hover:underline">Registrati gratis</Link>
                  </p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Accedendo accetti i{" "}
                    <Link href="/terms" className="underline underline-offset-2 hover:text-gray-600">Termini</Link>
                    {" "}e la{" "}
                    <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-600">Privacy Policy</Link>.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10"
              style={{background:"#1a2332",minHeight:"740px"}}>
              <div className="absolute inset-0 df-grid-bg"/>
              <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
                style={{background:"radial-gradient(circle at 80% 10%,rgba(59,130,246,.22) 0%,transparent 60%)"}}/>
              <div className="absolute bottom-0 left-0 w-96 h-64 pointer-events-none"
                style={{background:"radial-gradient(circle at 20% 90%,rgba(99,102,241,.15) 0%,transparent 60%)"}}/>

              {/* Top: small logo */}
              <div className="relative z-10">
                <Image src="/doflow_logo.svg" alt="Doflow" width={90} height={24}
                  className="h-6 w-auto brightness-0 invert opacity-75"/>
              </div>

              {/* Center: big logo hero */}
              <div className="relative z-10 flex flex-col items-center justify-center py-4">
                <div style={{
                  width:160,height:160,borderRadius:"32px",
                  background:"rgba(255,255,255,.06)",
                  border:"1px solid rgba(255,255,255,.1)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  backdropFilter:"blur(12px)",
                  boxShadow:"0 0 60px rgba(59,130,246,.15), inset 0 1px 0 rgba(255,255,255,.1)",
                  marginBottom:20,
                }}>
                  <Image src="/doflow_logo.svg" alt="Doflow" width={90} height={90}
                    className="w-20 h-20 brightness-0 invert opacity-90"/>
                </div>
                <p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.4)",letterSpacing:"0.05em"}}>
                  doflow
                </p>
              </div>

              {/* Feature card */}
              <div className="relative z-10 space-y-5">
                <div className="df-card df-slide-anim" key={slideIdx}>
                  <span style={{
                    display:"inline-block",fontSize:11,fontWeight:700,letterSpacing:"0.08em",
                    textTransform:"uppercase",padding:"4px 12px",borderRadius:999,
                    background:"rgba(59,130,246,.18)",color:"#93c5fd",marginBottom:16
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