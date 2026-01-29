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

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

type JwtPayload = {
  email?: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
  tenantSlug?: string; // potrebbe NON esserci
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
  { src: "/login-cover-1.webp", alt: "Gestione semplificata", quote: "La piattaforma all-in-one per gestire il tuo business.", author: "Doflow Team" },
  { src: "/login-cover-2.webp", alt: "Analytics avanzati", quote: "Tieni traccia di ogni lead e ottimizza le conversioni.", author: "Performance Analytics" },
  { src: "/login-cover-3.webp", alt: "Automazione workflow", quote: "Automatizza i processi ripetitivi e risparmia tempo prezioso.", author: "Workflow Engine" },
] as const;

const loginSchema = z.object({
  email: z.string().min(1, "L'email è obbligatoria").email("Inserisci un'email valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function getHostContext() {
  const host =
    typeof window !== "undefined"
      ? window.location.hostname.toLowerCase()
      : "app.doflow.it";

  const isAppHost = host === "app.doflow.it" || host === "admin.doflow.it" || host === "localhost";

  const subdomain = host.endsWith(".doflow.it")
    ? host.replace(".doflow.it", "").split(".")[0]
    : null;

  const tenantSub =
    !isAppHost &&
    subdomain &&
    !["app", "admin", "api", "www"].includes(subdomain)
      ? subdomain
      : null;

  return { host, isAppHost, tenantSub };
}

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [slide, setSlide] = React.useState(0);

  const [showTenantRedirect, setShowTenantRedirect] = React.useState(false);
  const [tenantRedirectUrl, setTenantRedirectUrl] = React.useState<string | null>(null);
  const [tenantDialogMsg, setTenantDialogMsg] = React.useState<string>("");

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

  React.useEffect(() => {
    if (!showTenantRedirect || !tenantRedirectUrl) return;

    const t = setTimeout(() => {
      window.location.href = tenantRedirectUrl;
    }, 4000);

    return () => clearTimeout(t);
  }, [showTenantRedirect, tenantRedirectUrl]);

  const onSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);

    const { isAppHost, tenantSub } = getHostContext();
    const realm = isAppHost ? "platform" : "tenant";

    try {
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

      // Tenant user su app/admin: serve tenantSlug (NON tenantId)
      if (isAppHost) {
        const userTenantSlug = payload?.tenantSlug;

        if (userTenantSlug) {
          const redirectUrl = `https://${userTenantSlug}.doflow.it/login`;
          setTenantRedirectUrl(redirectUrl);
          setTenantDialogMsg("Questo account appartiene a un tenant aziendale. Ti reindirizzo al dominio corretto.");
          setShowTenantRedirect(true);
          return;
        }

        // fallback: non possiamo dedurre lo slug
        setTenantRedirectUrl(null);
        setTenantDialogMsg(
          "Questo account appartiene a un tenant aziendale, ma non riesco a determinare automaticamente il dominio. Accedi dal dominio della tua azienda (es. https://nomeazienda.doflow.it/login)."
        );
        setShowTenantRedirect(true);
        return;
      }

      // tenant subdomain normale
      if (tenantSub) {
        router.push(`/${tenantSub}/dashboard`);
        return;
      }

      router.push("/login");
    } catch (err: any) {
      setGeneralError(err?.message || "Si è verificato un errore imprevisto.");
    }
  };

  return (
    <>
      {/* ✅ Dialog FUORI dalla Card (niente overflow/stacking issues) */}
      <AlertDialog open={showTenantRedirect} onOpenChange={setShowTenantRedirect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accesso al dominio aziendale</AlertDialogTitle>
            <AlertDialogDescription>
              {tenantDialogMsg}
              {tenantRedirectUrl && (
                <>
                  <br />
                  <span className="text-muted-foreground text-xs mt-2 block">
                    Verrai reindirizzato automaticamente tra pochi secondi...
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                if (tenantRedirectUrl) window.location.href = tenantRedirectUrl;
                else setShowTenantRedirect(false);
              }}
            >
              {tenantRedirectUrl ? "Vai al dominio aziendale" : "Ok"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mx-auto w-full max-w-[1100px] overflow-hidden border-none shadow-2xl sm:border sm:border-border">
        <div className="grid min-h-[650px] lg:grid-cols-2">
          {/* ... il resto del tuo JSX identico ... */}
          {/* (non lo ripeto qui per non farti un papiro: copia/incolla la parte sotto della tua Card com'è) */}
        </div>
      </Card>
    </>
  );
}
