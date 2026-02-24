"use client";

import { useState, useMemo } from "react";
import {
  Truck, Package, MapPin, Hash, Calendar, Plus, Search, Eye,
  ExternalLink, Printer, AlertTriangle, CheckCircle2, Clock,
  Box, Building2, ChevronRight, X, Navigation, RefreshCw,
  PackageCheck, PackageSearch, Loader2, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShipmentStatus = "in_preparazione" | "spedito" | "in_transito" | "consegnato" | "problema";

interface Shipment {
  id: string;
  orderId?: string;
  company: string;
  destination: string;
  carrier: string;
  trackingCode: string;
  status: ShipmentStatus;
  shipDate?: string;
  estDelivery: string;
  items: number;
  weight: string;
  notes: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const SHIPMENTS: Shipment[] = [
  { id: "SHP-2026-001", orderId: "ORD-2026-001", company: "StartupIO",         destination: "Via Roma 42, Milano",          carrier: "BRT",  trackingCode: "BRT2026018742",    status: "in_transito",    shipDate: "2026-02-17", estDelivery: "2026-02-21", items: 2,  weight: "0.5 kg",  notes: "Consegna piano uffici 3°" },
  { id: "SHP-2026-002", orderId: "ORD-2026-002", company: "BigCorp SpA",        destination: "Viale Europa 100, Roma",       carrier: "DHL",  trackingCode: "DHL1039847562",    status: "in_preparazione",shipDate: undefined,      estDelivery: "2026-02-28", items: 5,  weight: "12 kg",   notes: "Hardware per migrazione — palletizzare" },
  { id: "SHP-2026-003", orderId: "ORD-2026-003", company: "DesignStudio Srl",   destination: "Corso Magenta 15, Torino",     carrier: "GLS",  trackingCode: "GLS8827364510",    status: "consegnato",     shipDate: "2026-02-08", estDelivery: "2026-02-10", items: 1,  weight: "0.2 kg",  notes: "" },
  { id: "SHP-2026-004", orderId: "ORD-2026-005", company: "SmartFactory",       destination: "Via Industriale 8, Brescia",   carrier: "BRT",  trackingCode: "BRT2026029831",    status: "in_transito",    shipDate: "2026-02-19", estDelivery: "2026-02-22", items: 8,  weight: "6 kg",    notes: "Notebook + accessori per setup postazioni" },
  { id: "SHP-2026-005", orderId: "ORD-2026-007", company: "InnovateIT",         destination: "Piazza Duomo 1, Firenze",      carrier: "UPS",  trackingCode: "1Z999AA10123456784",status: "in_preparazione",shipDate: undefined,      estDelivery: "2026-03-05", items: 3,  weight: "2 kg",    notes: "Dispositivi test app mobile" },
  { id: "SHP-2026-006", orderId: "ORD-2026-004", company: "MediaGroup Italia",  destination: "Via Veneto 22, Roma",          carrier: "DHL",  trackingCode: "DHL1039852198",    status: "spedito",        shipDate: "2026-02-20", estDelivery: "2026-02-23", items: 1,  weight: "0.3 kg",  notes: "" },
  { id: "SHP-2026-007", undefined,               company: "Ufficio Milano",     destination: "Via Tortona 33, Milano",       carrier: "BRT",  trackingCode: "BRT2026031004",    status: "consegnato",     shipDate: "2026-02-15", estDelivery: "2026-02-16", items: 4,  weight: "18 kg",   notes: "Materiale ufficio — scrivanie + monitor" },
  { id: "SHP-2026-008", undefined,               company: "NexusLab",           destination: "Via Garibaldi 5, Bologna",     carrier: "GLS",  trackingCode: "GLS8827401122",    status: "problema",       shipDate: "2026-02-14", estDelivery: "2026-02-17", items: 2,  weight: "3 kg",    notes: "Indirizzo errato — in attesa rettifica" },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ShipmentStatus, {
  label: string; color: string; bg: string; border: string;
  icon: React.ComponentType<{className?: string}>;
  step: number; // 0-4 for timeline
}> = {
  in_preparazione: { label: "In preparazione", color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-950/40",   border: "border-indigo-200",  icon: Package,       step: 0 },
  spedito:         { label: "Spedito",          color: "text-sky-600",     bg: "bg-sky-100 dark:bg-sky-950/40",         border: "border-sky-200",     icon: Truck,         step: 1 },
  in_transito:     { label: "In transito",      color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40",     border: "border-amber-200",   icon: Navigation,    step: 2 },
  consegnato:      { label: "Consegnato",       color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40", border: "border-emerald-200", icon: PackageCheck,  step: 3 },
  problema:        { label: "Problema",         color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/40",       border: "border-rose-200",    icon: AlertTriangle, step: -1 },
};

const CARRIER_COLORS: Record<string, string> = {
  BRT: "bg-orange-100 text-orange-700 dark:bg-orange-950/30",
  DHL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30",
  GLS: "bg-blue-100 text-blue-700 dark:bg-blue-950/30",
  UPS: "bg-amber-100 text-amber-700 dark:bg-amber-950/30",
};

const ALL_STATUSES: Array<"Tutti" | ShipmentStatus> = ["Tutti","in_preparazione","spedito","in_transito","consegnato","problema"];
const ALL_CARRIERS = ["Tutti","BRT","DHL","GLS","UPS"];

// ─── Shipment timeline ────────────────────────────────────────────────────────

function ShipmentTimeline({ status }: { status: ShipmentStatus }) {
  const steps = [
    { key: "in_preparazione", label: "Preparazione" },
    { key: "spedito",         label: "Spedito" },
    { key: "in_transito",     label: "In transito" },
    { key: "consegnato",      label: "Consegnato" },
  ];
  const currentStep = STATUS_CFG[status]?.step ?? -1;
  const isProblem   = status === "problema";

  return (
    <div className="flex items-center gap-0 my-2">
      {steps.map((step, i) => {
        const isActive   = !isProblem && i <= currentStep;
        const isCurrent  = !isProblem && i === currentStep;
        const Cfg        = STATUS_CFG[step.key as ShipmentStatus];
        return (
          <div key={step.key} className="flex-1 flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all",
                isActive
                  ? isCurrent
                    ? cn("border-indigo-500 bg-indigo-500 shadow-sm shadow-indigo-200")
                    : "border-emerald-500 bg-emerald-500"
                  : "border-border bg-background",
              )}>
                {isActive ? <Cfg.icon className="h-3 w-3 text-white" /> : <div className="h-1.5 w-1.5 rounded-full bg-border" />}
              </div>
              <p className={cn("text-[9px] mt-1 text-center w-14 leading-tight", isActive ? "text-foreground font-medium" : "text-muted-foreground/50")}>
                {step.label}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mb-3 mx-0.5", i < currentStep ? "bg-emerald-400" : "bg-border")} />
            )}
          </div>
        );
      })}
      {isProblem && (
        <div className="ml-2 flex items-center gap-1 text-rose-600 text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" /> Problema
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState<"Tutti" | ShipmentStatus>("Tutti");
  const [carrierFilter, setCarrier] = useState("Tutti");
  const [selected, setSelected]     = useState<Shipment | null>(null);

  const filtered = useMemo(() => SHIPMENTS.filter(s => {
    if (statusFilter  !== "Tutti" && s.status  !== statusFilter)  return false;
    if (carrierFilter !== "Tutti" && s.carrier !== carrierFilter) return false;
    if (search && !`${s.id} ${s.company} ${s.trackingCode} ${s.destination}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, statusFilter, carrierFilter]);

  const inTransit  = SHIPMENTS.filter(s => s.status === "in_transito").length;
  const problems   = SHIPMENTS.filter(s => s.status === "problema").length;
  const preparing  = SHIPMENTS.filter(s => s.status === "in_preparazione").length;
  const delivered  = SHIPMENTS.filter(s => s.status === "consegnato").length;

  // Compute days until delivery
  const daysUntil = (estDelivery: string) => {
    const d = Math.round((new Date(estDelivery).getTime() - new Date().getTime()) / 86400000);
    return d;
  };

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logistica & Spedizioni</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {SHIPMENTS.length} spedizioni · {inTransit} in transito · {problems > 0 ? `${problems} con problemi` : "nessun problema"}
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0" size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nuova Spedizione
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "In preparazione", value: String(preparing),  icon: Package,      color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
          { label: "In transito",     value: String(inTransit),  icon: Navigation,   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
          { label: "Consegnate",      value: String(delivered),  icon: PackageCheck, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Problemi",        value: String(problems),   icon: AlertTriangle,color: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-950/30" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-black tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca spedizione, tracking, destinazione..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatus(v as any)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>
                {s === "Tutti" ? "Tutti gli stati" : STATUS_CFG[s as ShipmentStatus]?.label ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={carrierFilter} onValueChange={setCarrier}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Corriere" />
          </SelectTrigger>
          <SelectContent>
            {ALL_CARRIERS.map(c => <SelectItem key={c} value={c}>{c === "Tutti" ? "Tutti i corrieri" : c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Main content */}
      <div className={cn("flex gap-4", selected && "lg:gap-5")}>

        {/* Cards list */}
        <div className="flex-1 min-w-0 space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Truck className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Nessuna spedizione trovata.</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(s => {
              const sc   = STATUS_CFG[s.status];
              const StIcon = sc.icon;
              const days = daysUntil(s.estDelivery);
              const isSelected = selected?.id === s.id;
              const isProblem  = s.status === "problema";

              return (
                <Card
                  key={s.id}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-all border-border/60",
                    isSelected && "border-indigo-400 shadow-md ring-1 ring-indigo-400/30",
                    isProblem  && "border-rose-300 dark:border-rose-800",
                  )}
                  onClick={() => setSelected(isSelected ? null : s)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", sc.bg)}>
                          <StIcon className={cn("h-4 w-4", sc.color)} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black font-mono text-indigo-600">{s.id}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sc.color, "border-current/30", sc.bg)}>
                              {sc.label}
                            </Badge>
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", CARRIER_COLORS[s.carrier] ?? "bg-muted text-muted-foreground")}>
                              {s.carrier}
                            </span>
                          </div>
                          <p className="text-sm font-semibold mt-0.5">{s.company}</p>
                        </div>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground/50 shrink-0 mt-1 transition-transform", isSelected && "rotate-90")} />
                    </div>

                    <ShipmentTimeline status={s.status} />

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-1">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.destination.split(",").pop()?.trim()}</span>
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" />{s.items} colli · {s.weight}</span>
                      {s.orderId && <span className="flex items-center gap-1 text-indigo-600"><Hash className="h-3 w-3" />{s.orderId}</span>}
                      {s.status !== "consegnato" && s.status !== "problema" && (
                        <span className={cn("flex items-center gap-1 font-semibold",
                          days < 0 ? "text-rose-600" : days <= 1 ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          <Calendar className="h-3 w-3" />
                          {days < 0 ? `In ritardo ${Math.abs(days)}g` : days === 0 ? "Oggi" : `Consegna in ${days}g`}
                        </span>
                      )}
                      {isProblem && s.notes && (
                        <span className="text-rose-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />{s.notes}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="hidden lg:block w-72 xl:w-80 shrink-0">
            <Card className="sticky top-4 border-border/60">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <p className="font-black font-mono text-indigo-600 text-sm">{selected.id}</p>
                  <Badge variant="outline" className={cn("text-[10px] mt-1", STATUS_CFG[selected.status].color, "border-current/30", STATUS_CFG[selected.status].bg)}>
                    {STATUS_CFG[selected.status].label}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {[
                  { icon: Building2, label: "Destinatario",    value: selected.company },
                  { icon: MapPin,    label: "Indirizzo",        value: selected.destination },
                  { icon: Truck,     label: "Corriere",         value: selected.carrier },
                  { icon: Hash,      label: "Tracking",         value: selected.trackingCode, mono: true },
                  ...(selected.orderId ? [{ icon: Package, label: "Ordine", value: selected.orderId, mono: true }] : []),
                  { icon: Calendar,  label: "Consegna stimata", value: new Date(selected.estDelivery).toLocaleDateString("it-IT") },
                  { icon: Box,       label: "Colli",            value: `${selected.items} articoli · ${selected.weight}` },
                ].map(info => (
                  <div key={info.label} className="flex items-start gap-2.5 bg-muted/30 rounded-lg p-2.5">
                    <info.icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">{info.label}</p>
                      <p className={cn("text-xs font-semibold mt-0.5 break-all", (info as any).mono && "font-mono")}>{info.value}</p>
                    </div>
                  </div>
                ))}
                {selected.notes && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <p className="text-[10px] font-semibold mb-0.5">Note</p>
                    {selected.notes}
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Traccia
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Etichetta
                  </Button>
                </div>

                {selected.status === "problema" && (
                  <Button size="sm" className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Gestisci problema
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
