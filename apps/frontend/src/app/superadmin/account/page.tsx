// Percorso: apps/frontend/src/app/superadmin/account/page.tsx
// Pagina profilo superadmin — "Il mio Account" dalla sidebar

"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Key, Bell, Save, BadgeCheck } from "lucide-react";
import { getDoFlowUser, getInitials } from "@/lib/jwt";

export default function SuperAdminAccountPage() {
  const [user, setUser] = useState<{ email: string; role: string; initials: string } | null>(null);

  useEffect(() => {
    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email    ?? "superadmin@doflow.it",
        role:     payload.role     ?? "SUPER_ADMIN",
        initials: getInitials(payload.email),
      });
    }
  }, []);

  return (
    <div className="dashboard-content animate-fadeIn max-w-3xl">

      {/* ── Profilo Header ────────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <Avatar className="h-16 w-16 rounded-card border-2 border-primary/20 shadow-md">
              <AvatarFallback
                className="rounded-card text-xl font-black"
                style={{
                  background: "hsl(var(--primary) / 0.12)",
                  color:      "hsl(var(--primary))",
                }}
              >
                {user?.initials ?? "SA"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <p className="text-xl font-bold text-foreground">
                {user?.email ?? "Caricamento..."}
              </p>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 text-[11px] font-bold text-primary border-primary/30 bg-primary/10"
                >
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  {user?.role ?? "SUPER_ADMIN"}
                </Badge>
                <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  Account Attivo
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Dati Personali ────────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-primary" aria-hidden="true" />
            Dati Personali
          </CardTitle>
          <CardDescription>Aggiorna il tuo profilo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="display-name">Nome visualizzato</Label>
              <Input id="display-name" defaultValue="Super Admin" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email-addr">Email</Label>
              <Input id="email-addr" type="email" defaultValue={user?.email ?? ""} disabled className="bg-muted/50" />
              <p className="text-[11px] text-muted-foreground">Contatta il team tecnico per modificare l&apos;email.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button className="gap-2">
              <Save className="h-4 w-4" aria-hidden="true" />
              Salva
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sicurezza ─────────────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-5 w-5 text-primary" aria-hidden="true" />
            Sicurezza
          </CardTitle>
          <CardDescription>Gestisci password e autenticazione a due fattori.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cur-pw">Password attuale</Label>
              <Input id="cur-pw" type="password" placeholder="••••••••" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-pw">Nuova password</Label>
              <Input id="new-pw" type="password" placeholder="••••••••" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2">
              <Key className="h-4 w-4" aria-hidden="true" />
              Aggiorna Password
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Autenticazione a 2 fattori (MFA)</p>
              <p className="text-xs text-muted-foreground">
                Aggiungi un livello extra di sicurezza al tuo account.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* ── Notifiche ─────────────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
            Preferenze Notifiche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Nuovi tenant creati",       desc: "Notificami quando viene creato un nuovo tenant.", def: true  },
            { label: "Errori di sistema critici", desc: "Alert immediati per downtime o errori DB.",       def: true  },
            { label: "Report mensile",            desc: "Riepilogo mensile delle metriche piattaforma.",   def: false },
          ].map((n) => (
            <div key={n.label} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Switch defaultChecked={n.def} />
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}