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
  const t = (p?.tenantId ?? p?.tenant_id ?? "public").toString().trim().toLowerCase();
  return t || "public";
}

// Helper per capire su quale dominio siamo ORA
function getCurrentSubdomain() {
  if (typeof window === 'undefined') return 'public';
  const host = window.location.hostname;
  const parts = host.split('.');
  
  // Se siamo in locale, gestiamo localhost come public (o doflow se preferisci)
  if (host.includes('localhost')) return 'public'; 

  // Se il dominio è "app" o "www", siamo nel portale principale
  if (parts[0] === 'app' || parts[0] === 'www') {
    return 'global_portal'; // Etichetta speciale per capire che siamo sul portale
  }

  // Altrimenti restituisci il sottodominio (es. "federicanerone")
  return parts[0];
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
  const [slide, setSlide] = React.useState(0);

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
      const subdomain = getCurrentSubdomain();
      
      // LOGICA CHIAVE:
      // Se siamo sul "global_portal" (app.doflow.it), diciamo al backend di cercare nel DB 'public'.
      // Se siamo su "federicanerone.doflow.it", cerchiamo nel DB 'federicanerone'.
      // Se il SuperAdmin è su 'doflow' invece che 'public', cambia 'public' con 'doflow' qui sotto.
      const loginTenantContext = subdomain === 'global_portal' ? 'public' : subdomain;

      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        headers: {
          // Forziamo il contesto corretto per la ricerca dell'utente
          'x-tenant-id': loginTenantContext
        },
        body: JSON.stringify(values),
      });

      if (!data) throw new Error("Nessuna risposta dal server");
      if ("error" in data && data.error) throw new Error(data.error || "Credenziali non valide");
      if (!("token" in data) || !data.token) throw new Error("Token mancante");

      // Login OK
      const token = data.token;
      window.localStorage.setItem("doflow_token", token);

      // Decodifica Token per capire CHI si è loggato
      const payload = parseJwtPayload(token);
      const role = normalizeRole(payload?.role);
      const userTenantId = getTenantFromPayload(payload); // Es: "federicanerone" o "public"

      // --- LOGICA DI REINDIRIZZAMENTO ---

      // CASO 1: È un SUPER ADMIN
      if (role === "SUPER_ADMIN") {
        router.push("/superadmin"); // O la dashboard generale
        return;
      }

      // CASO 2: È un utente normale (Federica) che si è loggata da app.doflow.it
      if (subdomain === 'global_portal' && userTenantId !== 'public') {
        const protocol = window.location.protocol;
        const baseDomain = window.location.hostname.replace('app.', '');
        
        // 🔹 MODIFICA QUI: Aggiungiamo il token all'URL
        const targetUrl = `${protocol}//${userTenantId}.${baseDomain}/dashboard?accessToken=${token}`;
        
        if (window.location.hostname.includes('localhost')) {
             router.push(`/${userTenantId}/dashboard`);
        } else {
             window.location.href = targetUrl;
        }
        return;
      }

      // CASO 3: Utente normale già sul dominio giusto o routing path-based
      if (userTenantId && userTenantId !== "public") {
        router.push(`/${userTenantId}/dashboard`);
      } else {
        router.push("/dashboard");
      }

    } catch (err: unknown) {
      console.error("Login error:", err);
      // Suggerimento visivo se sbaglia contesto
      const msg = err instanceof Error ? err.message : "Errore imprevisto";
      
      // Se l'errore è "User not found" e siamo sul portale globale, potrebbe essere che l'utente esiste ma non nel DB public
      // Ma con la logica sopra, il SuperAdmin (che è in public) dovrebbe funzionare.
      setGeneralError(msg);
    }
  };

  return (
    <Card className="overflow-hidden border-none shadow-xl sm:border sm:border-border">
      {/* Here is the change: 
         Modificato lg:grid-cols-2 in lg:grid-cols-[1.5fr_1fr] 
         per rendere la colonna immagini più stretta.
      */}
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
                sizes="(min-width: 1024px) 40vw, 0vw" // Aggiornato sizes per performance
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