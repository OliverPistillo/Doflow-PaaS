"use client";

import * as React from "react";
import { Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import KioskHeader from "../components/KioskHeader";
import ScanInputCard from "../components/ScanInputCard";
import KioskActionBar from "../components/KioskActionBar";
import { tenantFetch } from "@/lib/tenant-fetch";

type Step = "JOB" | "SKU" | "QTY" | "CONFIRM";

export default function BusinaroAssemblyKioskPage() {
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>("JOB");
  const [loading, setLoading] = React.useState(false);

  const [jobOrderCode, setJobOrderCode] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [qty, setQty] = React.useState<number>(1);

  const reset = () => {
    setStep("JOB");
    setLoading(false);
    setJobOrderCode("");
    setSku("");
    setQty(1);
  };

  const nextFromJob = () => {
    if (!jobOrderCode.trim()) return;
    setStep("SKU");
    toast({ title: "Commessa acquisita", description: `JOB: ${jobOrderCode}` });
  };

  const nextFromSku = () => {
    if (!sku.trim()) return;
    setStep("QTY");
  };

  const nextFromQty = () => {
    if (!qty || qty <= 0) {
      toast({ title: "Quantità non valida", description: "Inserisci una quantità > 0", variant: "destructive" });
      return;
    }
    setStep("CONFIRM");
  };

  const consume = async () => {
    setLoading(true);
    try {
      const res = await tenantFetch("/api/businaro/assembly/consume", {
        method: "POST",
        body: JSON.stringify({
          jobOrderCode,
          sku,
          quantity: qty,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Errore backend");
      }

      toast({
        title: "Consumo registrato ✅",
        description: `${qty}x ${sku} su ${jobOrderCode}`,
        className: "bg-green-700 text-white border-green-800",
      });

      // Reset parziale per consumi multipli sulla stessa commessa
      setSku("");
      setQty(1);
      setStep("SKU");
    } catch (e: any) {
      toast({ title: "Errore bloccante", description: e?.message ?? "Consumo fallito", variant: "destructive" });
      setStep("JOB");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <KioskHeader
        title="🔧 ASSEMBLAGGIO"
        subtitle="Consumo materiali su commessa"
        roleLabel="ASSEMBLY"
        operatorLabel="MASTER_ASSEMBLAGGIO"
        onReset={reset}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ScanInputCard
          stepActive={step === "JOB"}
          title="1) Scansiona COMMESSA"
          placeholder="JOB CODE..."
          value={jobOrderCode}
          onChange={setJobOrderCode}
          onEnter={nextFromJob}
          accent="blue"
        />

        <ScanInputCard
          stepActive={step === "SKU"}
          title="2) Scansiona SKU"
          placeholder="SKU..."
          value={sku}
          onChange={setSku}
          onEnter={nextFromSku}
          disabled={step === "JOB"}
          accent="orange"
        />
      </div>

      <ScanInputCard
        stepActive={step === "QTY"}
        title="3) Quantità"
        placeholder="QTY..."
        value={String(qty)}
        onChange={(v) => setQty(parseInt(v || "0", 10))}
        onEnter={nextFromQty}
        disabled={step !== "QTY"}
        accent="slate"
      />

      {step === "CONFIRM" && (
        <KioskActionBar
          title="Conferma CONSUMO"
          subtitle={`${qty}x ${sku} su ${jobOrderCode}`}
          confirmLabel="CONFERMA CONSUMO"
          onConfirm={consume}
          loading={loading}
          dangerNote="Se la commessa è PRODUCTION_NEW e il lotto non è NEW: il backend bloccherà l'operazione."
        />
      )}

      <div className="rounded-xl border bg-white p-5 text-slate-700">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Wrench className="h-5 w-5" />
          Nota operativa
        </div>
        <p className="mt-2">
          Qui non “inventiamo” regole: la UI guida, ma il backend è il guardiano. Se provi a consumare materiale
          non compatibile, l’API risponde con errore e la UI mostra il blocco.
        </p>
      </div>
    </div>
  );
}