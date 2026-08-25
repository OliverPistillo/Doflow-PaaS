"use client";

import { ShieldAlert } from "lucide-react";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

export function SiteProposalsAccessGate({ children }: { children: React.ReactNode }) {
  const { hasCapability } = useDoflowIdentity();
  if (!hasCapability("canUseBuilder")) {
    return <main className="flex min-h-[50vh] items-center justify-center px-4"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-slate-500" /><h1 className="mt-4 text-lg font-semibold text-slate-950">Modulo non disponibile</h1><p className="mt-2 text-sm text-slate-500">Questa area non è disponibile per l’account corrente.</p></div></main>;
  }
  return <>{children}</>;
}
