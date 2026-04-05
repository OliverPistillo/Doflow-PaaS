// Percorso: apps/frontend/src/components/ui/export-button.tsx

"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api";

interface ExportButtonProps {
  entity: "leads" | "tickets" | "invoices" | "tenants" | "deals";
  label?: string;
  size?: "sm" | "default";
}

export function ExportButton({ entity, label, size = "sm" }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const token = window.localStorage.getItem("doflow_token");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/superadmin/export/${entity}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export fallito");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doflow_${entity}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size={size} onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
      {label || "Esporta CSV"}
    </Button>
  );
}
