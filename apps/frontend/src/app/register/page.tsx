// apps/frontend/src/app/register/page.tsx
// Stesso layout della login — form sx / brand panel dx

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
import { Eye, EyeOff, Loader2, AlertCircle, Mail, Lock, User, Building2 } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Inserisci il tuo nome"),
  company: z.string().optional(),
  email: z.string().min(1, "L'email è obbligatoria").email("Inserisci un'email valida"),
  password: z.string().min(8, "Minimo 8 caratteri"),
  confirmPassword: z.string().min(1, "Conferma la password"),
  acceptTerms: z.boolean().refine(v => v === true, "Devi accettare i termini"),
}).refine(d => d.password === d.confirmPassword, {
  message: "Le password non coincidono",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const BULLETS = [
  "14 giorni di prova gratuita, nessuna carta richiesta",
  "Setup in meno di 5 minuti",
  "Supporto dedicato incluso",
  "Cancella in qualsiasi momento",
];

const TESTIMONIAL = {
  quote: "Doflow ha ridotto di 3 volte il tempo che passavamo su preventivi e fatture. Ora gestiamo tutto da un unico posto.",
  author: "Marco R.",
  role: "CEO · PMI italiana",
};

export default function RegisterPage() {
  const router = useRouter();
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", company: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setGeneralError(null);
    try {
      await apiFetch("/auth/register", {
        method: "POST", auth: false,
        body: JSON.stringify({ name: values.name, company: values.company, email: values.email, password: values.password }),
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setGeneralError(err?.message || "Errore durante la registrazione.");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap');
        .dfr-wrap * { font-family:'Urbanist',sans-serif; }
        @keyframes dfrUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .dfr-a{animation:dfrUp .45s ease both}
        .dfr-a1{animation-delay:.04s}.dfr-a2{animation-delay:.08s}.dfr-a3{animation-delay:.12s}
        .dfr-a4{animation-delay:.16s}.dfr-a5{animation-delay:.20s}.dfr-a6{animation-delay:.24s}
        .dfr-a7{animation-delay:.28s}.dfr-a8{animation-delay:.32s}
        .dfr-input{
          display:block;width:100%;height:44px;border-radius:12px;
          border:1.5px solid #e5e7eb;background:#f9fafb;
          font-size:14px;font-family:'Urbanist',sans-serif;
          padding:0 44px 0 40px;outline:none;color:#111827;
          transition:border-color .18s,background .18s,box-shadow .18s;
        }
        .dfr-input::placeholder{color:#9ca3af}
        .dfr-input:focus{background:#fff;border-color:#1a2332;box-shadow:0 0 0 3px rgba(26,35,50,.09)}
        .dfr-input.err{border-color:#ef4444}
        .dfr-input.err:focus{box-shadow:0 0 0 3px rgba(239,68,68,.1)}
        .dfr-input-no-icon{padding-left:14px}
        .dfr-primary{
          width:100%;height:44px;border-radius:12px;border:none;cursor:pointer;
          font-size:14px;font-weight:700;font-family:'Urbanist',sans-serif;
          color:#fff;background:#1a2332;
          box-shadow:0 4px 14px rgba(26,35,50,.3);
          transition:all .2s;
        }
        .dfr-primary:hover:not(:disabled){background:#243045;transform:translateY(-1px);box-shadow:0 6px 20px rgba(26,35,50,.35)}
        .dfr-primary:active:not(:disabled){transform:translateY(0)}
        .dfr-primary:disabled{opacity:.6;cursor:not-allowed}
        .dfr-social{
          flex:1;height:42px;border-radius:12px;border:1.5px solid #e5e7eb;
          background:#fff;cursor:pointer;display:flex;align-items:center;
          justify-content:center;gap:7px;font-size:13px;font-weight:600;
          font-family:'Urbanist',sans-serif;color:#374151;
          transition:border-color .15s,background .15s;
        }
        .dfr-social:hover{border-color:#d1d5db;background:#f9fafb}
        .dfr-divider{display:flex;align-items:center;gap:10px;color:#9ca3af;font-size:12px;font-weight:500}
        .dfr-divider::before,.dfr-divider::after{content:'';flex:1;height:1px;background:#e5e7eb}
        .dfr-grid-bg{
          background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
          background-size:36px 36px;
        }
        .dfr-bullet{display:flex;align-items:flex-start;gap:10px}
        .dfr-check{
          width:20px;height:20px;border-radius:6px;flex-shrink:0;margin-top:1px;
          display:flex;align-items:center;justify-content:center;
          background:rgba(59,130,246,.15);
        }
        .dfr-testimonial{
          background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);
          border-radius:18px;padding:24px;backdrop-filter:blur(10px);
        }
        .dfr-success{
          border-radius:16px;padding:20px;text-align:center;
          background:#f0fdf4;border:1.5px solid #86efac;
        }
      `}</style>

      <div className="dfr-wrap flex min-h-screen items-center justify-center bg-[#edf0f4] p-4 md:p-8">
        <div className="w-full max-w-[1060px] overflow-hidden rounded-[26px]"
          style={{boxShadow:"0 24px 80px rgba(0,0,0,.16),0 4px 16px rgba(0,0,0,.08)"}}>
          <div className="grid lg:grid-cols-[480px_1fr]">

            {/* LEFT: form */}
            <div className="flex flex-col justify-center bg-white px-8 py-10 md:px-10 lg:px-12">
              <div className="mx-auto w-full max-w-[380px] space-y-5">

                <div className="dfr-a dfr-a1">
                  <Image src="/doflow_logo.svg" alt="Doflow" width={120} height={32} className="h-8 w-auto" priority/>
                </div>

                <div className="dfr-a dfr-a2 space-y-1">
                  <h1 className="text-[24px] font-bold tracking-tight text-gray-900">Crea il tuo account</h1>
                  <p className="text-[13.5px] text-gray-500">14 giorni gratis, nessuna carta richiesta.</p>
                </div>

                {success ? (
                  <div className="dfr-success dfr-a dfr-a3">
                    <p className="text-[20px] mb-1">🎉</p>
                    <p className="font-bold text-green-800 text-[15px]">Account creato con successo!</p>
                    <p className="text-[13px] text-green-600 mt-1">Ti stiamo reindirizzando al login...</p>
                  </div>
                ) : (
                  <>
                    {/* Social */}
                    <div className="dfr-a dfr-a3 space-y-3">
                      <div style={{display:"flex",gap:10}}>
                        <button type="button" className="dfr-social" aria-label="Registrati con Google">
                          <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z" fill="#4285F4"/>
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                          </svg>
                          Google
                        </button>
                        <button type="button" className="dfr-social" aria-label="Registrati con GitHub">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                          </svg>
                          GitHub
                        </button>
                      </div>
                      <div className="dfr-divider">oppure registrati con email</div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>

                      {/* Nome + Azienda */}
                      <div className="dfr-a dfr-a4" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div className="grid gap-1.5">
                          <Label htmlFor="name" className="text-[13px] font-semibold text-gray-700">Nome *</Label>
                          <div style={{position:"relative"}}>
                            <User size={14} aria-hidden style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}/>
                            <input id="name" type="text" placeholder="Mario Rossi" disabled={isSubmitting}
                              className={cn("dfr-input", errors.name && "err")} {...register("name")}/>
                          </div>
                          {errors.name && <p role="alert" className="text-[11px] text-red-500 font-medium">{errors.name.message}</p>}
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="company" className="text-[13px] font-semibold text-gray-700">Azienda</Label>
                          <div style={{position:"relative"}}>
                            <Building2 size={14} aria-hidden style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}/>
                            <input id="company" type="text" placeholder="Acme Srl" disabled={isSubmitting}
                              className="dfr-input" {...register("company")}/>
                          </div>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="dfr-a dfr-a5 grid gap-1.5">
                        <Label htmlFor="reg-email" className="text-[13px] font-semibold text-gray-700">Email *</Label>
                        <div style={{position:"relative"}}>
                          <Mail size={14} aria-hidden style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}/>
                          <input id="reg-email" type="email" placeholder="nome@azienda.it" disabled={isSubmitting}
                            className={cn("dfr-input", errors.email && "err")} {...register("email")}/>
                        </div>
                        {errors.email && <p role="alert" className="text-[11px] text-red-500 font-medium">{errors.email.message}</p>}
                      </div>

                      {/* Password */}
                      <div className="dfr-a dfr-a6" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div className="grid gap-1.5">
                          <Label htmlFor="reg-password" className="text-[13px] font-semibold text-gray-700">Password *</Label>
                          <div style={{position:"relative"}}>
                            <Lock size={14} aria-hidden style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}/>
                            <input id="reg-password" type={showPwd ? "text" : "password"} placeholder="Min. 8 caratteri"
                              disabled={isSubmitting} className={cn("dfr-input", errors.password && "err")} {...register("password")}/>
                            <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label="Toggle password"
                              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}>
                              {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                            </button>
                          </div>
                          {errors.password && <p role="alert" className="text-[11px] text-red-500 font-medium">{errors.password.message}</p>}
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="confirmPassword" className="text-[13px] font-semibold text-gray-700">Conferma *</Label>
                          <div style={{position:"relative"}}>
                            <Lock size={14} aria-hidden style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",pointerEvents:"none"}}/>
                            <input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Ripeti password"
                              disabled={isSubmitting} className={cn("dfr-input", errors.confirmPassword && "err")} {...register("confirmPassword")}/>
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label="Toggle confirm"
                              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}>
                              {showConfirm ? <EyeOff size={15}/> : <Eye size={15}/>}
                            </button>
                          </div>
                          {errors.confirmPassword && <p role="alert" className="text-[11px] text-red-500 font-medium">{errors.confirmPassword.message}</p>}
                        </div>
                      </div>

                      {/* Accept terms */}
                      <div className="dfr-a dfr-a7" style={{display:"flex",alignItems:"flex-start",gap:10}}>
                        <input type="checkbox" id="acceptTerms"
                          style={{width:16,height:16,borderRadius:4,accentColor:"#1a2332",cursor:"pointer",flexShrink:0,marginTop:2}}
                          {...register("acceptTerms")}/>
                        <Label htmlFor="acceptTerms" className="text-[12.5px] text-gray-500 cursor-pointer leading-relaxed">
                          Accetto i{" "}
                          <Link href="/terms" className="font-semibold text-[#1a2332] hover:underline">Termini di Servizio</Link>
                          {" "}e la{" "}
                          <Link href="/privacy" className="font-semibold text-[#1a2332] hover:underline">Privacy Policy</Link>
                        </Label>
                      </div>
                      {errors.acceptTerms && <p role="alert" className="text-[11px] text-red-500 font-medium -mt-2">{errors.acceptTerms.message}</p>}

                      {generalError && (
                        <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 border border-red-100">
                          <AlertCircle size={14} className="shrink-0"/><span>{generalError}</span>
                        </div>
                      )}

                      <div className="dfr-a dfr-a8">
                        <button type="submit" disabled={isSubmitting} className="dfr-primary">
                          {isSubmitting
                            ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                                <Loader2 className="h-4 w-4 animate-spin"/>Creazione account...
                              </span>
                            : "Crea account gratuito"}
                        </button>
                      </div>
                    </form>

                    <p className="text-center text-[13px] text-gray-500 dfr-a dfr-a8">
                      Hai già un account?{" "}
                      <Link href="/login" className="font-semibold text-[#1a2332] hover:underline">Accedi</Link>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT */}
            <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10"
              style={{background:"#1a2332",minHeight:"640px"}}>
              <div className="absolute inset-0 dfr-grid-bg"/>
              <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
                style={{background:"radial-gradient(circle at 80% 10%,rgba(59,130,246,.22) 0%,transparent 60%)"}}/>
              <div className="absolute bottom-0 left-0 w-96 h-64 pointer-events-none"
                style={{background:"radial-gradient(circle at 20% 90%,rgba(99,102,241,.15) 0%,transparent 60%)"}}/>

              <div className="relative z-10">
                <Image src="/doflow_logo.svg" alt="Doflow" width={90} height={24}
                  className="h-6 w-auto brightness-0 invert opacity-75"/>
              </div>

              <div className="relative z-10 space-y-6">
                <div>
                  <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:8}}>
                    Incluso nella prova gratuita
                  </p>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {BULLETS.map((b,i) => (
                      <div key={i} className="dfr-bullet">
                        <div className="dfr-check">
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <p style={{fontSize:14,color:"rgba(255,255,255,.75)",lineHeight:1.5}}>{b}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dfr-testimonial">
                  <p style={{fontSize:14,lineHeight:1.7,color:"rgba(255,255,255,.7)",fontStyle:"italic",marginBottom:16}}>
                    &ldquo;{TESTIMONIAL.quote}&rdquo;
                  </p>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(59,130,246,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#93c5fd",flexShrink:0}}>
                      {TESTIMONIAL.author[0]}
                    </div>
                    <div>
                      <p style={{fontSize:13,fontWeight:700,color:"#fff"}}>{TESTIMONIAL.author}</p>
                      <p style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{TESTIMONIAL.role}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10">
                <p style={{fontSize:12,color:"rgba(255,255,255,.3)",textAlign:"center"}}>
                  Unisciti a centinaia di aziende italiane che usano Doflow ogni giorno.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}