// Percorso: apps/frontend/src/app/superadmin/settings/page.tsx
// Pagina Impostazioni Globali — risolve il 404 quando si clicca
// "Impostazioni Globali" nella sidebar

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Globe, Bell, Shield, Database, Mail, Palette,
  Save, RefreshCw,
} from "lucide-react";

export default function SuperAdminSettingsPage() {
  return (
    <div className="dashboard-content animate-fadeIn">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configura i parametri globali della piattaforma DoFlow.
          </p>
        </div>
        <Button className="gap-2">
          <Save className="h-4 w-4" aria-hidden="true" />
          Salva Modifiche
        </Button>
      </div>

      {/* ── Sezione: Piattaforma ───────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
            Impostazioni Piattaforma
          </CardTitle>
          <CardDescription>Configurazioni generali per tutta la piattaforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="grid gap-2">
              <Label htmlFor="platform-name">Nome Piattaforma</Label>
              <Input id="platform-name" defaultValue="DoFlow PaaS" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support-email">Email di Supporto</Label>
              <Input id="support-email" type="email" defaultValue="support@doflow.it" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="platform-url">URL Base Piattaforma</Label>
            <Input id="platform-url" defaultValue="https://app.doflow.it" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Modalità Manutenzione</p>
              <p className="text-xs text-muted-foreground">
                Blocca l&apos;accesso a tutti gli utenti non-superadmin.
              </p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Registrazione Nuovi Tenant</p>
              <p className="text-xs text-muted-foreground">
                Consente la creazione self-service di nuovi tenant.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* ── Sezione: Sicurezza ─────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            Sicurezza & Accesso
          </CardTitle>
          <CardDescription>Politiche di autenticazione e MFA.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="grid gap-2">
              <Label htmlFor="session-ttl">Scadenza Sessione (ore)</Label>
              <Input id="session-ttl" type="number" defaultValue="24" min="1" max="720" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max-login-attempts">Tentativi Max Login</Label>
              <Input id="max-login-attempts" type="number" defaultValue="5" min="3" max="20" />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">MFA Obbligatorio (Admin)</p>
              <p className="text-xs text-muted-foreground">
                Forza l&apos;autenticazione a due fattori per tutti gli admin.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Log Audit Automatico</p>
              <p className="text-xs text-muted-foreground">
                Registra automaticamente tutte le azioni critiche.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* ── Sezione: Email ─────────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            Configurazione Email (SMTP)
          </CardTitle>
          <CardDescription>Server SMTP per l&apos;invio di email transazionali.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="grid gap-2">
              <Label htmlFor="smtp-host">Host SMTP</Label>
              <Input id="smtp-host" defaultValue="smtp.example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtp-port">Porta</Label>
              <Input id="smtp-port" type="number" defaultValue="587" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtp-user">Utente SMTP</Label>
              <Input id="smtp-user" defaultValue="noreply@doflow.it" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtp-pass">Password SMTP</Label>
              <Input id="smtp-pass" type="password" defaultValue="••••••••" />
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Testa Connessione
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sezione: Database ──────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            Storage & Database
          </CardTitle>
          <CardDescription>Limiti globali di storage e configurazione DB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="grid gap-2">
              <Label htmlFor="default-storage">Storage Default per Tenant (GB)</Label>
              <Input id="default-storage" type="number" defaultValue="5" min="1" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max-tenants">Max Tenant Attivi</Label>
              <Input id="max-tenants" type="number" defaultValue="100" />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Backup Automatici</p>
              <p className="text-xs text-muted-foreground">
                Esegui backup giornalieri di tutti gli schema tenant.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}