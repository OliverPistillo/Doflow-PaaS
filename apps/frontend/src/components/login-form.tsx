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

type JwtPayload = {
  email?: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
  tenantSlug?: string;
};

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}

function normalizeRole(role?: string) {
  const r = String(role ?? "").toUpperCase().replace(/[^A-Z_]/g, "");
  if (["OWNER", "SUPERADMIN", "SUPER_ADMIN"].includes(r)) return "SUPER_ADMIN";
  return "USER";
}

const SLIDES = [
  {
    src: "/login-cover-1.webp",
    alt: "Gestione semplificata",
    quote: "La piattaforma all-in-one per gestire il tuo business.",
    author: "Doflow Team",
  },
  {
    src: "/login-cover-2.webp",
    alt: "Analytics avanzati",
    quote: "Tieni traccia di ogni lead e ottimizza le conversioni.",
    author: "Performance Analytics",
  },
  {
    src: "/login-cover-3.webp",
    alt: "Automazione workflow",
    quote: "Automatizza i processi ripetitivi e risparmia tempo prezioso.",
    author: "Workflow Engine",
  },
] as const;

const loginSchema = z.object({
  email: z.string().min(1, "L'email è obbligatoria").email("Inserisci un'email valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function getHostContext() {
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "app.doflow.it";
  const isAppHost = host === "app.doflow.it" || host === "admin.doflow.it" || host === "localhost";

  const subdomain = host.endsWith(".doflow.it") ? host.replace(".doflow.it", "").split(".")[0] : null;
  const tenantSub =
    !isAppHost && subdomain && !["app", "admin", "api", "www"].includes(subdomain) ? subdomain : null;

  return { host, isAppHost, tenantSub };
}

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
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);

    const { isAppHost, tenantSub } = getHostContext();
    const realm = isAppHost ? "platform" : "tenant";

    try {
      // (opzionale ma utile): se avevi token vecchi, li sovrascrivi comunque dopo,
      // ma almeno eviti effetti collaterali mentre fai login.
      // window.localStorage.removeItem("doflow_token");

      const data = await apiFetch<{ token: string; error?: string; message?: string }>("/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          ...values,
          realm,
          tenantSlug: tenantSub ?? undefined,
        }),
      });

      if (data?.error) throw new Error(data.error || data.message);
      if (!data?.token) throw new Error("Token di accesso mancante");

      window.localStorage.setItem("doflow_token", data.token);

      const payload = parseJwtPayload(data.token);
      const role = normalizeRole(payload?.role);

      if (role === "SUPER_ADMIN") {
        router.push("/superadmin");
        return;
      }

      // Tenant realm: usa lo slug dal subdomain (non tenantId del token)
      if (tenantSub) {
        router.push(`/${tenantSub}/dashboard`);
        return;
      }

      // App realm: dashboard generica
      router.push("/dashboard");
    } catch (err: any) {
      setGeneralError(err?.message || "Si è verificato un errore imprevisto.");
    }
  };

  return (
    <Card className="mx-auto w-full max-w-[1100px] overflow-hidden border-none shadow-2xl sm:border sm:border-border">
      <div className="grid min-h-[650px] lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-card p-8 md:p-12 lg:p-16">
          <div className="mx-auto w-full max-w-[350px] space-y-8">
            <div className="flex flex-col items-center space-y-2 text-center">
              <Image
                src="/doflow_logo.svg"
                alt="Doflow"
                width={120}
                height={40}
                className="mb-4 h-10 w-auto object-contain"
                priority
              />
              <h1 className="text-2xl font-bold tracking-tight">Bentornato</h1>
              <p className="text-sm text-muted-foreground">Inserisci le tue credenziali per accedere.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@azienda.it"
                  disabled={isSubmitting}
                  className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
                  {...register("email")}
                />
                {errors.email && <p className="text-[11px] font-medium text-destructive">{errors.email.message}</p>}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                    Dimenticata?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    className={cn("pr-10", errors.password && "border-destructive")}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] font-medium text-destructive">{errors.password.message}</p>
                )}
              </div>

              {generalError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                  <AlertCircle size={16} />
                  <span>{generalError}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-semibold" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> In corso...
                  </>
                ) : (
                  "Accedi"
                )}
              </Button>
            </form>

            <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
              Cliccando su Accedi, accetti i nostri{" "}
              <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
                Termini
              </Link>{" "}
              e la{" "}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="relative hidden lg:block bg-muted overflow-hidden">
          {SLIDES.map((s, i) => (
            <div
              key={i}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000 ease-in-out",
                i === slide ? "opacity-100 z-10" : "opacity-0 z-0",
              )}
            >
              <Image src={s.src} alt={s.alt} fill priority={i === 0} className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-12 text-white w-full">
                <blockquote className="text-lg font-medium leading-relaxed italic">
                  &ldquo;{s.quote}&rdquo;
                </blockquote>
                <p className="mt-4 text-sm font-semibold text-white/80">— {s.author}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
