// apps/frontend/src/components/login-form.tsx
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

// --- LOGICA UTILS ---
const MAIN_DB_NAME = "public"; // Nome del DB principale dove risiede il SuperAdmin

type JwtPayload = {
  email?: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
  exp?: number;
};

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase().replace(/[^A-Z_]/g, "");
  if (["OWNER", "SUPERADMIN", "SUPER_ADMIN"].includes(r)) return "SUPER_ADMIN";
  if (r === "ADMIN") return "ADMIN";
  if (r === "MANAGER") return "MANAGER";
  return "USER";
}

function getTenantFromPayload(p: JwtPayload | null) {
  const t = (p?.tenantId ?? p?.tenant_id ?? MAIN_DB_NAME).toString().trim().toLowerCase();
  return t || MAIN_DB_NAME;
}

// Funzione per capire se siamo sul portale principale (app.doflow.it) o su un tenant
function getCurrentContext() {
  if (typeof window === 'undefined') return 'unknown';
  const host = window.location.hostname;
  
  if (host.includes('localhost')) return 'localhost';
  if (host.startsWith('app.') || host.startsWith('www.') || host === 'doflow.it') return 'portal';
  
  return 'tenant'; // Siamo su un sottodominio specifico (es. federicanerone.doflow.it)
}

// --- CONFIGURAZIONE SLIDER ---
const SLIDES = [
  { 
    src: "/login-cover-1.webp", 
    alt: "Gestione semplificata",
    quote: "La piattaforma all-in-one per gestire il tuo business.",
    author: "Doflow Team"
  },
  { 
    src: "/login-cover-2.webp", 
    alt: "Analytics avanzati",
    quote: "Tieni traccia di ogni lead e ottimizza le conversioni.",
    author: "Performance Analytics"
  },
  { 
    src: "/login-cover-3.webp", 
    alt: "Automazione workflow",
    quote: "Automatizza i processi ripetitivi e risparmia tempo prezioso.",
    author: "Workflow Engine"
  },
] as const;

// --- SCHEMA DI VALIDAZIONE ---
const loginSchema = z.object({
  email: z.string().min(1, "L'email è obbligatoria").email("Inserisci un'email valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type LoginResponse = { token: string } | { error: string; message?: string };

// --- COMPONENTE ---
export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = React.useState(false); // Stato per il loader durante redirect
  const [slide, setSlide] = React.useState(0);

  // 1. ACCHIAPPA TOKEN (Gestione redirect cross-domain)
  React.useEffect(() => {
    // Leggiamo i parametri URL manualmente per evitare dipendenze da Suspense
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("accessToken");

    if (tokenFromUrl) {
      console.log("🔄 Token rilevato nell'URL. Login automatico...");
      setIsRedirecting(true); // Mostra loader
      window.localStorage.setItem("doflow_token", tokenFromUrl);
      
      // Puliamo l'URL e andiamo alla dashboard
      router.replace("/dashboard");
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    const id = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => window.clearInterval(id);
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);
    setShowPassword(false);

    try {
      const context = getCurrentContext();
      
      // 2. HEADER LOGIC
      // Se siamo sul portale (app.doflow.it), forziamo la ricerca in 'public'.
      // Altrimenti lasciamo che apiFetch usi il sottodominio corrente.
      const headers: Record<string, string> = {};
      if (context === 'portal' || context === 'localhost') {
        headers['x-tenant-id'] = MAIN_DB_NAME;
      }

      console.log(`Login attempt from: ${context}. Target DB: ${headers['x-tenant-id'] || 'Auto'}`);

      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        headers, // Iniettiamo l'header calcolato
        body: JSON.stringify(values),
      });

      if (!data) throw new Error("Nessuna risposta dal server");

      if ("error" in data && data.error) {
        throw new Error(data.error || data.message || "Credenziali non valide");
      }

      if (!("token" in data) || !data.token) {
        throw new Error("Token di accesso mancante");
      }

      const token = data.token;
      
      // Analisi Token
      const payload = parseJwtPayload(token);
      const role = normalizeRole(payload?.role);
      const userTenant = getTenantFromPayload(payload);

      // --- 3. ROUTING INTELLIGENTE ---

      // CASO A: SUPER ADMIN (Resta qui e va a /superadmin)
      if (role === "SUPER_ADMIN") {
        window.localStorage.setItem("doflow_token", token);
        router.push("/superadmin");
        return;
      }

      // CASO B: Utente normale che si logga dal portale SBAGLIATO
      // (Es. Federica su app.doflow.it invece che su federicanerone.doflow.it)
      if ((context === 'portal' || context === 'localhost') && userTenant !== MAIN_DB_NAME) {
         
         // Se siamo in localhost, simuliamo il redirect (non possiamo cambiare sottodominio facilmente)
         if (context === 'localhost') {
            window.localStorage.setItem("doflow_token", token);
            router.push(`/${userTenant}/dashboard`);
            return;
         }

         // Redirect VERO verso il sottodominio corretto
         setIsRedirecting(true);
         const protocol = window.location.protocol;
         const baseDomain = window.location.hostname.replace('app.', ''); // ottiene doflow.it
         
         // Mandiamo a /login con il token, così l'useEffect sopra lo cattura
         const targetUrl = `${protocol}//${userTenant}.${baseDomain}/login?accessToken=${token}`;
         
         console.log("✈️ Redirect verso tenant:", targetUrl);
         window.location.href = targetUrl;
         return;
      }

      // CASO C: Login Standard (Siamo già sul dominio giusto)
      window.localStorage.setItem("doflow_token", token);
      
      // Path-based routing di sicurezza
      if (userTenant && userTenant !== "public") {
        router.push(`/${userTenant}/dashboard`);
      } else {
        router.push("/dashboard");
      }

    } catch (err: unknown) {
      console.error("Login error:", err);
      // Messaggio più utile se l'utente sbaglia portale
      const msg = err instanceof Error ? err.message : "Errore imprevisto";
      if (msg.includes("User not found") && getCurrentContext() === 'portal') {
          setGeneralError("Utente non trovato. Sei sicuro di essere sul portale giusto?");
      } else {
          setGeneralError(msg);
      }
    }
  };

  // Loader a tutto schermo durante il redirect
  if (isRedirecting) {
    return (
      <Card className="h-[600px] flex items-center justify-center border-none shadow-none">
         <div className="flex flex-col items-center gap-4">
           <Loader2 className="h-10 w-10 animate-spin text-primary" />
           <p className="text-muted-foreground font-medium">Accesso al tuo workspace...</p>
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
            
            <div className="flex flex-col space-y-2 text-center sm:text-left">
              <div className="mb-4 flex justify-center sm:justify-start">
                <Image
                  src="/doflow_logo.svg"
                  alt="Doflow"
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Bentornato</h1>
              <p className="text-sm text-muted-foreground">
                Inserisci le tue credenziali per accedere al workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@azienda.it"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline underline-offset-4"
                    tabIndex={-1}
                  >
                    Password dimenticata?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className={cn("pr-10", errors.password && "border-destructive focus-visible:ring-destructive")}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isSubmitting}
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {generalError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive animate-in zoom-in-95">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-medium" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Accesso in corso...
                  </>
                ) : (
                  "Accedi"
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground px-4">
              Cliccando su Accedi, accetti i nostri{" "}
              <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
                Termini di Servizio
              </Link>{" "}
              e la{" "}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
                Privacy Policy
              </Link>.
            </p>
          </div>
        </div>

        {/* PARTE DESTRA: SLIDER IMMAGINI */}
        <div className="relative hidden lg:block bg-muted overflow-hidden">
          {SLIDES.map((s, i) => (
            <div
              key={s.src}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000 ease-in-out",
                i === slide ? "opacity-100 z-10" : "opacity-0 z-0"
              )}
            >
              <Image
                src={s.src}
                alt={s.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 40vw, 0vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <div className="absolute bottom-0 left-0 p-10 text-white space-y-2">
                <blockquote className="text-lg font-medium leading-relaxed">
                  &ldquo;{s.quote}&rdquo;
                </blockquote>
                <div className="text-sm text-white/80 font-semibold">
                  {s.author}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}