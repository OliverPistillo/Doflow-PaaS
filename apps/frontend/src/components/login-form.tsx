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
// CAMBIA QUI SE IL TUO DB PRINCIPALE SI CHIAMA 'doflow' INVECE DI 'public'
const MAIN_TENANT = "public"; 

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
  return r; // USER, ADMIN, MANAGER
}

function getTenantFromPayload(p: JwtPayload | null) {
  return (p?.tenantId ?? p?.tenant_id ?? MAIN_TENANT).toString().trim().toLowerCase();
}

// Capisce su che dominio siamo ORA
function getCurrentContext() {
  if (typeof window === 'undefined') return MAIN_TENANT;
  const host = window.location.hostname;
  const parts = host.split('.');
  
  if (host.includes('localhost')) return 'localhost';
  // Se siamo su app.doflow.it o www.doflow.it -> siamo sul portale
  if (parts[0] === 'app' || parts[0] === 'www') return 'portal';
  
  return parts[0]; // es: federicanerone
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

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);
    try {
      const currentContext = getCurrentContext();
      
      // 1. DECIDIAMO L'HEADER X-TENANT-ID
      // Se siamo su localhost o app.doflow.it -> usiamo MAIN_TENANT (public)
      // Se siamo su federicanerone.doflow.it -> usiamo federicanerone
      let headerTenant = currentContext;
      if (currentContext === 'portal' || currentContext === 'localhost') {
        headerTenant = MAIN_TENANT; 
      }

      console.log("Tentativo login su DB:", headerTenant);

      const data = await apiFetch<{ token: string, error?: string }>("/auth/login", {
        method: "POST",
        auth: false,
        headers: { 'x-tenant-id': headerTenant }, // FORZIAMO IL TENANT
        body: JSON.stringify(values),
      });

      if (!data) throw new Error("Errore di rete");
      if (data.error) throw new Error(data.error);
      
      const token = data.token;
      // Salviamo il token subito nel dominio corrente per sicurezza
      window.localStorage.setItem("doflow_token", token);

      // 2. ANALIZZIAMO CHI SI È LOGGATO
      const payload = parseJwtPayload(token);
      const role = normalizeRole(payload?.role);
      const targetTenant = getTenantFromPayload(payload); // Es: "federicanerone"

      // CASO A: SUPER ADMIN
      if (role === "SUPER_ADMIN") {
        router.push("/superadmin");
        return;
      }

      // CASO B: UTENTE NORMALE (Federica)
      // Dobbiamo capire se siamo sul dominio giusto o no
      
      // Se siamo su app.doflow.it MA l'utente appartiene a 'federicanerone'
      if ((currentContext === 'portal' || currentContext === 'localhost') && targetTenant !== MAIN_TENANT) {
         
         // Se siamo in localhost, simula il redirect (router push semplice)
         if (window.location.hostname.includes('localhost')) {
            router.push(`/${targetTenant}/dashboard`);
            return;
         }

         // Redirect VERO verso il sottodominio con passaggio token
         const protocol = window.location.protocol;
         const baseDomain = window.location.hostname.replace('app.', ''); // ottiene doflow.it
         const newUrl = `${protocol}//${targetTenant}.${baseDomain}/dashboard?accessToken=${token}`;
         
         window.location.href = newUrl;
         return;
      }

      // Se siamo già sul dominio giusto
      router.push("/dashboard");

    } catch (err: any) {
      console.error(err);
      setGeneralError(err.message || "Errore login");
    }
  };

  return (
    <Card className="overflow-hidden border-none shadow-xl sm:border sm:border-border">
      <div className="grid lg:grid-cols-[1.5fr_1fr] h-full min-h-[600px]">
        {/* PARTE SINISTRA: FORM */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-card">
          <div className="w-full max-w-[350px] mx-auto space-y-6">
             <div className="flex flex-col space-y-2 text-center sm:text-left">
               <h1 className="text-2xl font-semibold tracking-tight">Accedi</h1>
               <p className="text-sm text-muted-foreground">Inserisci le credenziali.</p>
             </div>

             <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                   <Label>Email</Label>
                   <Input type="email" {...register("email")} />
                   {errors.email && <p className="text-xs text-red-500">{errors.email.message as string}</p>}
                </div>
                <div className="space-y-2">
                   <Label>Password</Label>
                   <div className="relative">
                     <Input type={showPassword ? "text" : "password"} {...register("password")} />
                     <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2">
                        {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                     </button>
                   </div>
                   {errors.password && <p className="text-xs text-red-500">{errors.password.message as string}</p>}
                </div>

                {generalError && (
                  <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                     <AlertCircle className="w-4 h-4"/> {generalError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="animate-spin w-4 h-4"/> : "Login"}
                </Button>
             </form>
          </div>
        </div>

        {/* PARTE DESTRA: FOTO STATICA (Semplificata per ora per evitare errori) */}
        <div className="hidden lg:block bg-muted relative">
           <Image src="/login-cover-1.webp" alt="Cover" fill className="object-cover" priority />
        </div>
      </div>
    </Card>
  );
}