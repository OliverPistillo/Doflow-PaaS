"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

// --- CONFIGURAZIONE ---
const MAIN_DB_NAME = "public"; 
const DOMAIN_ROOT = "doflow.it"; // Il tuo dominio principale

// --- UTILS ---
type JwtPayload = { email?: string; role?: string; tenantId?: string; tenant_id?: string; };

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch { return null; }
}

function getTenantFromPayload(p: JwtPayload | null) {
  return (p?.tenantId ?? p?.tenant_id ?? MAIN_DB_NAME).toString().trim().toLowerCase();
}

// Funzione che determina il contesto
function getDomainContext() {
  if (typeof window === 'undefined') return 'unknown';
  const host = window.location.hostname;

  if (host.startsWith('admin.')) return 'admin_portal';
  // Consideriamo portale generico app., www. o il dominio nudo
  if (host.startsWith('app.') || host.startsWith('www.') || host === DOMAIN_ROOT) return 'generic_portal';
  
  // Se siamo in localhost
  if (host.includes('localhost')) return 'localhost';

  return 'tenant_specific';
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [slide, setSlide] = React.useState(0);

  // 1. ACCHIAPPA TOKEN (Gestione redirect cross-domain)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("accessToken");
    if (tokenFromUrl) {
      console.log("🔄 Token rilevato nell'URL. Login automatico...");
      setIsRedirecting(true);
      window.localStorage.setItem("doflow_token", tokenFromUrl);
      
      // PULIZIA TOTALE: Ricarica la pagina per assicurarsi che lo stato sia pulito
      window.location.href = "/dashboard";
    }
  }, []);

  // Slider
  React.useEffect(() => {
    const id = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => window.clearInterval(id);
  }, []);

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);
    try {
      const context = getDomainContext();
      
      // HEADER: Se siamo su portali di sistema, forziamo public.
      const headers: Record<string, string> = {};
      if (context === 'admin_portal' || context === 'generic_portal') {
        headers['x-tenant-id'] = MAIN_DB_NAME;
      }

      console.log(`🔐 Login Context: ${context}. Header inviato: ${headers['x-tenant-id'] || 'Auto'}`);

      const data = await apiFetch<{ token: string, error?: string }>("/auth/login", {
        method: "POST",
        auth: false,
        headers,
        body: JSON.stringify(values),
      });

      if (!data || !data.token) throw new Error(data?.error || "Credenziali non valide");
      
      const token = data.token;
      const payload = parseJwtPayload(token);
      const userTenant = getTenantFromPayload(payload);
      const userRole = payload?.role;

      console.log(`👤 Utente loggato. Ruolo: ${userRole}, Tenant: ${userTenant}`);

      // --- LOGICA DI REINDIRIZZAMENTO ---

      // A. SUPERADMIN -> Deve andare su admin.doflow.it
      if (userRole === "SUPER_ADMIN" || userRole === "OWNER") {
         // Se non siamo già su admin (e non siamo in localhost)
         if (context !== 'admin_portal' && context !== 'localhost') {
            setIsRedirecting(true);
            const protocol = window.location.protocol;
            // Redirect a admin.doflow.it
            window.location.href = `${protocol}//admin.${DOMAIN_ROOT}/superadmin?accessToken=${token}`;
            return;
         }
         window.localStorage.setItem("doflow_token", token);
         router.push("/superadmin");
         return;
      }

      // B. UTENTE TENANT (Federica) -> Deve andare sul suo sottodominio
      // Se NON siamo sul dominio del tenant (e non siamo in localhost)
      if (context !== 'tenant_specific' && context !== 'localhost') {
         // Controlliamo che il tenant non sia 'public' (caso raro)
         if (userTenant !== MAIN_DB_NAME) {
             setIsRedirecting(true);
             const protocol = window.location.protocol;
             
             const targetUrl = `${protocol}//${userTenant}.${DOMAIN_ROOT}/login?accessToken=${token}`;
             console.log(`✈️ Redirect necessario. Destinazione: ${targetUrl}`);
             
             window.location.href = targetUrl;
             return;
         }
      }

      // C. SIAMO GIA' NEL POSTO GIUSTO (O in Localhost)
      console.log("✅ Login standard sul dominio corrente.");
      window.localStorage.setItem("doflow_token", token);
      
      if (context === 'localhost' && userTenant !== MAIN_DB_NAME) {
          router.push(`/${userTenant}/dashboard`); // Path routing per dev
      } else {
          router.push("/dashboard");
      }

    } catch (err: any) {
      console.error(err);
      setGeneralError(err.message || "Errore login");
    }
  };

  if (isRedirecting) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
         <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
         <p className="text-gray-500">Accesso al workspace in corso...</p>
      </div>
    )
  }

  // ... (TUTTO IL RESTO DELL'UI RIMANE UGUALE: Card, Form, Slider) ...
  // Copia la parte return (...) dal codice precedente, è identica.
  return (
    <Card className="overflow-hidden border-none shadow-xl sm:border sm:border-border">
      <div className="grid lg:grid-cols-[1.5fr_1fr] h-full min-h-[600px]">
        <div className="p-8 md:p-12 flex flex-col justify-center bg-card">
          <div className="w-full max-w-[350px] mx-auto space-y-6">
             <div className="flex flex-col space-y-2 text-center sm:text-left">
               <div className="mb-4 flex justify-center sm:justify-start">
                  <Image src="/doflow_logo.svg" alt="Doflow" width={120} height={40} className="h-10 w-auto object-contain" priority />
               </div>
               <h1 className="text-2xl font-semibold tracking-tight">Bentornato</h1>
               <p className="text-sm text-muted-foreground">Accedi al workspace.</p>
             </div>

             <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                   <Label>Email</Label>
                   <Input type="email" placeholder="nome@azienda.it" {...register("email")} />
                   {errors.email && <p className="text-xs text-destructive">{errors.email.message as string}</p>}
                </div>
                <div className="space-y-2">
                   <Label>Password</Label>
                   <div className="relative">
                     <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...register("password")} />
                     <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                     </button>
                   </div>
                   {errors.password && <p className="text-xs text-destructive">{errors.password.message as string}</p>}
                </div>

                {generalError && (
                  <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                     <AlertCircle className="w-4 h-4"/> {generalError}
                  </div>
                )}

                <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : "Accedi"}
                </Button>
             </form>
          </div>
        </div>
        <div className="hidden lg:block bg-muted relative">
           <Image src="/login-cover-1.webp" alt="Cover" fill className="object-cover" priority />
           <div className="absolute inset-0 bg-black/20" />
        </div>
      </div>
    </Card>
  );
}

const SLIDES = [
  { src: "/login-cover-1.webp", alt: "Cover 1" },
  { src: "/login-cover-2.webp", alt: "Cover 2" },
  { src: "/login-cover-3.webp", alt: "Cover 3" },
] as const;