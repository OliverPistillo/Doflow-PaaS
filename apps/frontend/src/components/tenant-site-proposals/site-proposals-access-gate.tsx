"use client";

import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

export function SiteProposalsAccessGate({ children }: { children: React.ReactNode }) {
  const { hasCapability } = useDoflowIdentity();
  if (!hasCapability("canUseBuilder")) {
    return <section data-builder-shell="doflow-reference" className="flex min-h-[50vh] items-center justify-center"><Card className="max-w-md"><CardContent className="p-7 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">Modulo non disponibile</h1><p className="mt-2 text-sm text-muted-foreground">Questa area non è disponibile per l’account corrente.</p></CardContent></Card></section>;
  }
  return <section data-builder-shell="doflow-reference">{children}</section>;
}
