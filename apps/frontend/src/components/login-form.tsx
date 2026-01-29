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

// --- UTILS ---
type JwtPayload = {
  email?: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
};

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase().replace(/[^A-Z_]/g, "");
  if (["OWNER", "SUPERADMIN", "SUPER_ADMIN"].includes(r)) return "SUPER_ADMIN";
  return "USER";
}

// --- CONFIG ---
const SLIDES = [
  { 
    src: "/login-cover-1.webp", 
    quote: "La piattaforma all-in-one per gestire il tuo business.",
    author: "Doflow Team"
  },
  { 
    src: "/login-cover-2.webp", 
    quote: "Tieni traccia di ogni lead e ottimizza le conversioni.",
    author: "Performance Analytics"
  }
];

const loginSchema = z.object({
  email: z.string().min(1, "L'email è obbligatoria").email("Email non valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [slide, setSlide] = React.useState(0);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);
    try {
      const data = await apiFetch<{token: string; error?: string}>("/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify(values),
      });

      if (data?.error) throw new Error(data.error);
      if (!data?.token) throw new Error("Errore durante l'accesso");

      window.localStorage.setItem("doflow_token", data.token);
      const payload = parseJwtPayload(data.token);
      const role = normalizeRole(payload?.role);
      const tenantId = payload?.tenantId ?? payload?.tenant_id;

      if (role === "SUPER_ADMIN") router.push("/superadmin");
      else if (tenantId && tenantId !== "public") router.push(`/${tenantId}/dashboard`);
      else router.push("/dashboard");

    } catch (err: any) {
      setGeneralError(err.message || "Credenziali non valide");
    }
  };

  return (
    <Card className="mx-auto w-full max-w-[1000px] overflow-hidden border-none shadow-2xl sm:border">
      <div className="grid min-h-[600px] lg:grid-cols-2">
        
        {/* LATO SINISTRO: FORM */}
        <div className="flex flex-col justify-center bg-white p-8 md:p-12 lg:p-16">
          <div className="mx-auto w-full max-w-[350px] space-y-8">
            
            {/* Header */}
            <div className="flex flex-col items-center space-y-2 text-center">
              <Image
                src="/doflow_logo.svg"
                alt="Doflow"
                width={130}
                height={40}
                className="mb-4 h-10 w-auto object-contain"
                priority
              />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bentornato</h1>
              <p className="text-sm text-slate-500">
                Inserisci le tue credenziali per accedere
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@azienda.it"
                  className={cn(errors.email && "border-red-500 focus-visible:ring-red-500")}
                  {...register("email")}
                />
                {errors.email && <p className="text-[11px] font-medium text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" title="Recupera password" className="text-xs font-semibold text-blue-600 hover:underline">
                    Dimenticata?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={cn("pr-10", errors.password && "border-red-500")}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] font-medium text-red-500">{errors.password.message}</p>}
              </div>

              {generalError && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                  <AlertCircle size={16} />
                  <span>{generalError}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Accedi"}
              </Button>
            </form>

            {/* Footer */}
            <p className="px-8 text-center text-[11px] leading-relaxed text-slate-400">
              Continuando accetti i nostri{" "}
              <Link href="/terms" className="underline hover:text-slate-600">Termini di Servizio</Link> e la{" "}
              <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
            </p>
          </div>
        </div>

        {/* LATO DESTRO: IMMAGINE/SLIDER */}
        <div className="relative hidden bg-slate-100 lg:block">
          {SLIDES.map((s, i) => (
            <div
              key={i}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000 ease-in-out",
                i === slide ? "opacity-100 z-10" : "opacity-0 z-0"
              )}
            >
              <Image
                src={s.src}
                alt="Dashboard Preview"
                fill
                className="object-cover"
                priority={i === 0}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-12 left-12 right-12 text-white">
                <blockquote className="text-xl font-medium leading-snug">
                  &ldquo;{s.quote}&rdquo;
                </blockquote>
                <p className="mt-3 text-sm font-semibold text-white/70">— {s.author}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}