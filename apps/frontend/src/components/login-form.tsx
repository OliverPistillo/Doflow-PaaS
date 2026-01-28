"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; // Aggiunto useSearchParams
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
const MAIN_DB_NAME = "public"; // Il nome del db dove sta il SuperAdmin

// --- UTILS ---
type JwtPayload = { email?: string; role?: string; tenantId?: string; tenant_id?: string; };

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch { return null; }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase();
  if (r.includes("SUPER")) return "SUPER_ADMIN";
  return r;
}

function getTenantFromPayload(p: JwtPayload | null) {
  return (p?.tenantId ?? p?.tenant_id ?? MAIN_DB_NAME).toString().trim().toLowerCase();
}

// Helper per capire se siamo sul portale principale
function isMainPortal() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.startsWith('app.') || host.startsWith('www.') || host === 'doflow.it';
}

const loginSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(1, "Password richiesta"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams(); // Hook per leggere l'URL
  
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  // 1. EFFETTO "ACCHIAPPA TOKEN" (Magic Link)
  // Se arriviamo qui con ?accessToken=..., ci logghiamo automaticamente.
  React.useEffect(() => {
    const tokenFromUrl = searchParams.get("accessToken");
    if (tokenFromUrl) {
      console.log("🔄 Token ricevuto via URL. Login automatico...");
      setIsRedirecting(true); // Mostra loader
      window.localStorage.setItem("doflow_token", tokenFromUrl);
      
      // Puliamo l'URL e andiamo alla dashboard
      // Usiamo window.location per essere sicuri di ricaricare il contesto
      window.location.href = "/dashboard"; 
    }
  }, [searchParams]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);
    try {
      const onPortal = isMainPortal();
      
      // 2. HEADER TENANT: 
      // Se siamo sul portale (app.doflow.it), forziamo 'public'. 
      // Altrimenti il browser manda in automatico il sottodominio (es. federicanerone) tramite apiFetch
      const headers: Record<string, string> = {};
      if (onPortal) {
        headers['x-tenant-id'] = MAIN_DB_NAME;
      }

      console.log(`📡 Login request from ${window.location.hostname}. Target DB: ${onPortal ? MAIN_DB_NAME : 'Auto'}`);

      const data = await apiFetch<{ token: string, error?: string }>("/auth/login", {
        method: "POST",
        auth: false,
        headers,
        body: JSON.stringify(values),
      });

      if (!data) throw new Error("Nessuna risposta dal server");
      if (data.error) throw new Error(data.error);
      
      const token = data.token;
      
      // Analizziamo il token PRIMA di salvarlo o reindirizzare
      const payload = parseJwtPayload(token);
      const role = normalizeRole(payload?.role);
      const targetTenant = getTenantFromPayload(payload); 

      // --- LOGICA DI REINDIRIZZAMENTO ---

      // CASO A: SUPER ADMIN
      if (role === "SUPER_ADMIN") {
        window.localStorage.setItem("doflow_token", token);
        router.push("/superadmin");
        return;
      }

      // CASO B: SIAMO SUL DOMINIO SBAGLIATO? (Es. Federica su app.doflow.it)
      // Se sono sul portale MA il tenant dell'utente NON è public
      if (onPortal && targetTenant !== MAIN_DB_NAME) {
         setIsRedirecting(true);
         const protocol = window.location.protocol;
         // Prendi il dominio base (es da app.doflow.it -> doflow.it)
         const baseDomain = window.location.hostname.split('.').slice(1).join('.'); 
         
         // Costruisci il link verso il login del tenant
         // Invece di mandare alla dashboard, mandiamo alla pagina di LOGIN del tenant con il token
         // Così questo stesso file intercetterà il token nell'useEffect sopra.
         const targetUrl = `${protocol}//${targetTenant}.${baseDomain}/login?accessToken=${token}`;
         
         console.log("✈️ Redirect cross-domain verso:", targetUrl);
         window.location.href = targetUrl;
         return;
      }

      // CASO C: TUTTO NORMALE (Siamo già sul dominio giusto)
      window.localStorage.setItem("doflow_token", token);
      router.push("/dashboard");

    } catch (err: any) {
      console.error(err);
      setGeneralError(err.message || "Errore durante il login");
    }
  };

  // Se stiamo reindirizzando, mostra solo un loader pulito
  if (isRedirecting) {
    return (
      <Card className="h-[600px] flex items-center justify-center border-none shadow-none">
         <div className="flex flex-col items-center gap-4">
           <Loader2 className="h-10 w-10 animate-spin text-primary" />
           <p className="text-muted-foreground">Accesso al workspace in corso...</p>
         </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-none shadow-xl sm:border sm:border-border">
      <div className="grid lg:grid-cols-[1.5fr_1fr] h-full min-h-[600px]">
        {/* PARTE SINISTRA: FORM */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-card">
          <div className="w-full max-w-[350px] mx-auto space-y-6">
             
             {/* HEADER */}
             <div className="flex flex-col space-y-2 text-center sm:text-left">
               <div className="mb-4 flex justify-center sm:justify-start">
                  <Image src="/doflow_logo.svg" alt="Doflow" width={120} height={40} className="h-10 w-auto object-contain" priority />
               </div>
               <h1 className="text-2xl font-semibold tracking-tight">Bentornato</h1>
               <p className="text-sm text-muted-foreground">Inserisci le credenziali.</p>
             </div>

             {/* FORM */}
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
                     <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-muted-foreground">
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

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : null} 
                   {isSubmitting ? "Accesso..." : "Accedi"}
                </Button>
             </form>
          </div>
        </div>

        {/* PARTE DESTRA: IMMAGINE */}
        <div className="hidden lg:block bg-muted relative">
           <Image src="/login-cover-1.webp" alt="Cover" fill className="object-cover" priority />
           <div className="absolute inset-0 bg-black/20" />
        </div>
      </div>
    </Card>
  );
}