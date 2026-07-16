"use client";

import { Loader2 } from "lucide-react";

export function CredentialsLoading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento vault...</div>;
}

