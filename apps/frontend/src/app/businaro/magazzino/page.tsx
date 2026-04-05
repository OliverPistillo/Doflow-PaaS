"use client";

import * as React from "react";
import { Package, MoveRight, ScanLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import KioskHeader from "../components/KioskHeader";
import ScanInputCard from "../components/ScanInputCard";
import KioskActionBar from "../components/KioskActionBar";
import { tenantFetch } from "@/lib/tenant-fetch";

type PickStep = "JOB" | "SKU" | "QTY" | "CONFIRM";
type MoveStep = "FROM" | "SKU" | "TO" | "QTY" | "CONFIRM";

export default function BusinaroWarehouseKioskPage() {
  const { toast } = useToast();

  // PICK
  const [pickStep, setPickStep] = React.useState<PickStep>("JOB");
  const [pickLoading, setPickLoading] = React.useState(false);
  const [jobOrderCode, setJobOrderCode] = React.useState("");
  const [pickSku, setPickSku] = React.useState("");
  const [pickQty, setPickQty] = React.useState<number>(1);

  // MOVE
  const [moveStep, setMoveStep] = React.useState<MoveStep>("FROM");
  const [moveLoading, setMoveLoading] = React.useState(false);
  const [fromLoc, setFromLoc] = React.useState("");
  const [moveSku, setMoveSku] = React.useState("");
  const [toLoc, setToLoc] = React.useState("");
  const [moveQty, setMoveQty] = React.useState<number>(1);

  const resetPick = () => {
    setPickStep("JOB");
    setPickLoading(false);
    setJobOrderCode("");
    setPickSku("");
    setPickQty(1);
  };

  const resetMove = () => {
    setMoveStep("FROM");
    setMoveLoading(false);
    setFromLoc("");
    setMoveSku("");
    setToLoc("");
    setMoveQty(1);
  };

  // --- PICK handlers
  const pickNextFromJob = () => {
    if (!jobOrderCode.trim()) return;
    setPickStep("SKU");
    toast({ title: "Commessa acquisita", description: `JOB: ${jobOrderCode}` });
  };

  const pickNextFromSku = () => {
    if (!pickSku.trim()) return;
    setPickStep("QTY");
  };

  const pickNextFromQty = () => {
    if (!pickQty || pickQty <= 0) {
      toast({ title: "Quantità non valida", description: "Inserisci una quantità > 0", variant: "destructive" });
      return;
    }
    setPickStep("CONFIRM");
  };

  const doPick = async () => {
    setPickLoading(true);
    try {
      // Endpoint backend Businaro (da creare lato NestJS)
      // POST /api/businaro/warehouse/pick
      const res = await tenantFetch("/api/businaro/warehouse/pick", {
        method: "POST",
        body: JSON.stringify({
          jobOrderCode,
          sku: pickSku,
          quantity: pickQty,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Errore backend");
      }

      toast({
        title: "Prelievo registrato ✅",
        description: `${pickQty}x ${pickSku} su ${jobOrderCode}`,
        className: "bg-green-700 text-white border-green-800",
      });

      // Resta sulla stessa commessa per pick multipli: reset solo SKU/QTY
      setPickSku("");
      setPickQty(1);
      setPickStep("SKU");
    } catch (e: any) {
      toast({ title: "Errore bloccante", description: e?.message ?? "Pick fallito", variant: "destructive" });
      setPickStep("JOB");
    } finally {
      setPickLoading(false);
    }
  };

  // --- MOVE handlers
  const moveNextFromFrom = () => {
    if (!fromLoc.trim()) return;
    setMoveStep("SKU");
  };

  const moveNextFromSku = () => {
    if (!moveSku.trim()) return;
    setMoveStep("TO");
  };

  const moveNextFromTo = () => {
    if (!toLoc.trim()) return;
    setMoveStep("QTY");
  };

  const moveNextFromQty = () => {
    if (!moveQty || moveQty <= 0) {
      toast({ title: "Quantità non valida", description: "Inserisci una quantità > 0", variant: "destructive" });
      return;
    }
    setMoveStep("CONFIRM");
  };

  const doMove = async () => {
    setMoveLoading(true);
    try {
      // Endpoint backend Businaro (da creare lato NestJS)
      // POST /api/businaro/warehouse/move
      const res = await tenantFetch("/api/businaro/warehouse/move", {
        method: "POST",
        body: JSON.stringify({
          fromLocationCode: fromLoc,
          toLocationCode: toLoc,
          sku: moveSku,
          quantity: moveQty,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Errore backend");
      }

      toast({
        title: "Spostamento registrato ✅",
        description: `${moveQty}x ${moveSku}: ${fromLoc} → ${toLoc}`,
        className: "bg-green-700 text-white border-green-800",
      });

      // Reset per prossimo spostamento
      resetMove();
    } catch (e: any) {
      toast({ title: "Errore bloccante", description: e?.message ?? "Move fallito", variant: "destructive" });
      setMoveStep("FROM");
    } finally {
      setMoveLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <KioskHeader
        title="📦 MAGAZZINO"
        subtitle="Pick con commessa obbligatoria + Move con scan ubicazioni"
        roleLabel="WAREHOUSE"
        operatorLabel="MASTER_MAGAZZINO"
        onReset={() => {
          resetPick();
          resetMove();
        }}
      />

      <Tabs defaultValue="pick" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-14">
          <TabsTrigger value="pick" className="text-lg">
            <ScanLine className="mr-2 h-5 w-5" />
            PICK
          </TabsTrigger>
          <TabsTrigger value="move" className="text-lg">
            <MoveRight className="mr-2 h-5 w-5" />
            MOVE
          </TabsTrigger>
        </TabsList>

        {/* PICK */}
        <TabsContent value="pick" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScanInputCard
              stepActive={pickStep === "JOB"}
              title="1) Scansiona COMMESSA"
              description="Obbligatoria. Senza commessa non si preleva."
              placeholder="JOB CODE..."
              value={jobOrderCode}
              onChange={setJobOrderCode}
              onEnter={pickNextFromJob}
              accent="blue"
            />
            <ScanInputCard
              stepActive={pickStep === "SKU"}
              title="2) Scansiona SKU"
              description="Articolo da prelevare"
              placeholder="SKU..."
              value={pickSku}
              onChange={setPickSku}
              onEnter={pickNextFromSku}
              disabled={pickStep === "JOB"}
              accent="orange"
            />
          </div>

          <ScanInputCard
            stepActive={pickStep === "QTY"}
            title="3) Quantità"
            description="Inserisci quantità e premi INVIO"
            placeholder="QTY..."
            value={pickStep === "QTY" ? String(pickQty) : String(pickQty)}
            onChange={(v) => setPickQty(parseInt(v || "0", 10))}
            onEnter={pickNextFromQty}
            disabled={pickStep !== "QTY"}
            accent="slate"
          />

          {pickStep === "CONFIRM" && (
            <KioskActionBar
              title="Conferma PICK"
              subtitle={`${pickQty}x ${pickSku} su ${jobOrderCode}`}
              confirmLabel="CONFERMA PRELIEVO"
              onConfirm={doPick}
              loading={pickLoading}
              dangerNote="Se la commessa non è attiva o la disponibilità non basta: errore bloccante."
            />
          )}
        </TabsContent>

        {/* MOVE */}
        <TabsContent value="move" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScanInputCard
              stepActive={moveStep === "FROM"}
              title="1) Scansiona UBICAZIONE PARTENZA"
              placeholder="FROM LOCATION..."
              value={fromLoc}
              onChange={setFromLoc}
              onEnter={moveNextFromFrom}
              accent="blue"
            />
            <ScanInputCard
              stepActive={moveStep === "SKU"}
              title="2) Scansiona SKU"
              placeholder="SKU..."
              value={moveSku}
              onChange={setMoveSku}
              onEnter={moveNextFromSku}
              disabled={moveStep === "FROM"}
              accent="orange"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScanInputCard
              stepActive={moveStep === "TO"}
              title="3) Scansiona UBICAZIONE ARRIVO"
              placeholder="TO LOCATION..."
              value={toLoc}
              onChange={setToLoc}
              onEnter={moveNextFromTo}
              disabled={moveStep !== "TO"}
              accent="green"
            />
            <ScanInputCard
              stepActive={moveStep === "QTY"}
              title="4) Quantità"
              placeholder="QTY..."
              value={String(moveQty)}
              onChange={(v) => setMoveQty(parseInt(v || "0", 10))}
              onEnter={moveNextFromQty}
              disabled={moveStep !== "QTY"}
              accent="slate"
            />
          </div>

          {moveStep === "CONFIRM" && (
            <KioskActionBar
              title="Conferma MOVE"
              subtitle={`${moveQty}x ${moveSku}: ${fromLoc} → ${toLoc}`}
              confirmLabel="CONFERMA SPOSTAMENTO"
              onConfirm={doMove}
              loading={moveLoading}
              dangerNote="Ogni spostamento fisico deve essere registrato: niente fantasmi sugli scaffali."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
