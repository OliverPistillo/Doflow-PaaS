// apps/frontend/src/app/register/page.tsx
// Stesso layout della login — form sx / brand panel dx

"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dfUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .df-a{animation:dfUp .45s ease both}
        .df-a1{animation-delay:.04s}.df-a2{animation-delay:.09s}.df-a3{animation-delay:.13s}
        .df-a4{animation-delay:.17s}.df-a5{animation-delay:.21s}.df-a6{animation-delay:.25s}.df-a7{animation-delay:.29s}
        @keyframes dfSlide { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
        .df-slide-anim{animation:dfSlide .5s ease both}
        .df-dot {
          height: 6px; border-radius: 999px; background: rgba(255,255,255,.2);
          transition: all .3s ease;
        }
        .df-dot.active {
          background: #fff; box-shadow: 0 0 8px rgba(255,255,255,.4);
        }
        .dfr-success{
          border-radius:16px;padding:20px;text-align:center;
          background:#DCFCE7;border:1px solid #86efac;
        }
      `}} />

      <div className="min-h-screen doflow-app-frame flex items-center justify-center p-4 lg:p-6">
        <div className="w-full max-w-[1200px] df-glass-panel rounded-[32px] overflow-hidden">
          <div className="grid lg:grid-cols-2 min-h-[640px]">

            {/* LEFT: form */}
            <div className="flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-20 relative z-10 bg-background/50 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none">
              <div className="w-full max-w-[400px] mx-auto space-y-6">

                <div className="df-a df-a1">
                  <Image src="/doflow_logo.svg" alt="Doflow" width={110} height={30} className="h-7 w-auto dark:invert" priority/>
                </div>

                <div className="df-a df-a2 space-y-1">
                  <h1 className="text-3xl font-bold tracking-tight mb-2">Crea il tuo account</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">14 giorni gratis, nessuna carta richiesta.</p>
                </div>

                {success ? (
                  <div className="dfr-success df-a df-a3">
                    <p className="text-[20px] mb-1">🎉</p>
                    <p className="font-bold text-green-800 text-[15px]">Account creato con successo!</p>
                    <p className="text-[13px] text-green-600 mt-1">Ti stiamo reindirizzando al login...</p>
                  </div>
                ) : (
                  <>
                    {/* Social */}
                    <div className="df-a df-a3 space-y-3">
                      <div style={{display:"flex",gap:10}}>
                        <button type="button" className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-background border border-input shadow-sm text-sm font-medium hover:bg-secondary/50 transition-colors" aria-label="Registrati con Google">
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
                            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                            <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
                          </svg>
                          Google
                        </button>
                      </div>
                      <div className="relative flex items-center py-6">
                        <div className="flex-grow border-t border-border"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground uppercase tracking-widest">oppure registrati con email</span>
                        <div className="flex-grow border-t border-border"></div>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

                      {/* Nome + Azienda */}
                      <div className="df-a df-a4 grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="name" className="text-[13px] font-medium">Nome *</Label>
                          <div className="relative">
                            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                            <input id="name" type="text" placeholder="Mario Rossi" disabled={isSubmitting}
                              className={cn("w-full h-11 pl-9 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all", errors.name ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-input hover:border-muted-foreground/30")} {...register("name")}
                              autoFocus />
                          </div>
                          {errors.name && <p role="alert" className="text-[11px] text-destructive font-medium">{errors.name.message}</p>}
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="company" className="text-[13px] font-medium">Azienda</Label>
                          <div className="relative">
                            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                            <input id="company" type="text" placeholder="Acme Srl" disabled={isSubmitting}
                              className="w-full h-11 pl-9 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all border-input hover:border-muted-foreground/30" {...register("company")}/>
                          </div>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="df-a df-a5 grid gap-1.5">
                        <Label htmlFor="reg-email" className="text-[13px] font-medium">Email *</Label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                          <input id="reg-email" type="email" placeholder="nome@azienda.it" disabled={isSubmitting}
                            className={cn("w-full h-11 pl-9 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all", errors.email ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-input hover:border-muted-foreground/30")} {...register("email")}/>
                        </div>
                        {errors.email && <p role="alert" className="text-[11px] text-destructive font-medium">{errors.email.message}</p>}
                      </div>

                      {/* Password */}
                      <div className="df-a df-a6 grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="reg-password" className="text-[13px] font-medium">Password *</Label>
                          <div className="relative">
                            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                            <input id="reg-password" type={showPwd ? "text" : "password"} placeholder="Min. 8 caratteri"
                              disabled={isSubmitting} className={cn("w-full h-11 pl-9 pr-10 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all", errors.password ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-input hover:border-muted-foreground/30")} {...register("password")}/>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex">
                                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                                    aria-label={showPwd ? "Nascondi password" : "Mostra password"}
                                    disabled={isSubmitting}
                                    className="focus:outline-none p-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring">
                                    {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                                  </button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {showPwd ? "Nascondi password" : "Mostra password"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {errors.password && <p role="alert" className="text-[11px] text-destructive font-medium">{errors.password.message}</p>}
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="confirmPassword" className="text-[13px] font-medium">Conferma *</Label>
                          <div className="relative">
                            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                            <input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Ripeti password"
                              disabled={isSubmitting} className={cn("w-full h-11 pl-9 pr-10 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all", errors.confirmPassword ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-input hover:border-muted-foreground/30")} {...register("confirmPassword")}/>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex">
                                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    aria-label={showConfirm ? "Nascondi password" : "Mostra password"}
                                    disabled={isSubmitting}
                                    className="focus:outline-none p-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring">
                                    {showConfirm ? <EyeOff size={15}/> : <Eye size={15}/>}
                                  </button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {showConfirm ? "Nascondi password" : "Mostra password"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {errors.confirmPassword && <p role="alert" className="text-[11px] text-destructive font-medium">{errors.confirmPassword.message}</p>}
                        </div>
                      </div>

                      {/* Accept terms */}
                      <div className="df-a df-a7 flex items-start gap-2 pt-2">
                        <Controller
                          name="acceptTerms"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="acceptTerms"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isSubmitting}
                              className="mt-0.5"
                            />
                          )}
                        />
                        <Label htmlFor="acceptTerms" className="text-[12.5px] text-muted-foreground cursor-pointer leading-relaxed">
                          Accetto i{" "}
                          <Link href="/terms" className="font-semibold text-foreground hover:underline">Termini di Servizio</Link>
                          {" "}e la{" "}
                          <Link href="/privacy" className="font-semibold text-foreground hover:underline">Privacy Policy</Link>
                        </Label>
                      </div>
                      {errors.acceptTerms && <p role="alert" className="text-[11px] text-destructive font-medium -mt-2">{errors.acceptTerms.message}</p>}

                      {generalError && (
                        <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive border border-destructive/20">
                          <AlertCircle size={15} className="shrink-0" aria-hidden/><span>{generalError}</span>
                        </div>
                      )}

                      <div className="df-a df-a6 pt-2">
                        <button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:bg-primary/90 transition-all hover:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none">
                          {isSubmitting
                            ? <>
                                <Loader2 className="h-4 w-4 animate-spin"/>Creazione account...
                              </>
                            : "Crea account gratuito"}
                        </button>
                      </div>
                    </form>

                    <p className="df-a df-a7 space-y-3 text-center mt-6 text-[13px] text-muted-foreground">
                      Hai già un account?{" "}
                      <Link href="/login" className="font-semibold text-foreground hover:underline">Accedi</Link>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — premium hero card */}
            <div className="hidden lg:flex relative overflow-hidden flex-col justify-center p-10 xl:p-14 df-page-hero rounded-none border-0 rounded-r-[32px]">
              <div className="absolute top-10 right-10 z-10">
                <Image src="/doflow_logo.svg" alt="Doflow" width={130} height={36} className="h-9 w-auto brightness-0 invert opacity-80"/>
              </div>

              <div className="max-w-[420px] mx-auto w-full space-y-12 relative z-10 mt-10">
                <div className="space-y-6">
                  <div className="df-glass-panel rounded-2xl p-8 border-0 bg-black/10">
                    <span className="df-page-eyebrow mb-5">
                      Incluso nella prova gratuita
                    </span>
                    <div className="space-y-4">
                      {BULLETS.map((b,i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center bg-white/10 text-white">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <p className="text-[15px] text-white/70 leading-[1.6]">{b}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="df-glass-panel border-0 bg-black/10 rounded-2xl p-6 mt-6">
                    <p className="text-[15px] italic text-white/70 leading-relaxed mb-4">
                      &ldquo;{TESTIMONIAL.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0">
                        {TESTIMONIAL.author[0]}
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-white">{TESTIMONIAL.author}</p>
                        <p className="text-[12px] text-white/50">{TESTIMONIAL.role}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[12px] text-white/40 text-center">
                    Unisciti a centinaia di aziende italiane che usano Doflow ogni giorno.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
