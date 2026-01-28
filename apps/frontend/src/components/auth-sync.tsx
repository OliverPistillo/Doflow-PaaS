"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function AuthSync() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Cerca il token nell'URL
    const tokenFromUrl = searchParams.get("accessToken");

    if (tokenFromUrl) {
      // 1. Salva IMMEDIATAMENTE il token
      window.localStorage.setItem("doflow_token", tokenFromUrl);

      // 2. Rimuovi il parametro dal browser senza ricaricare (estetica)
      const newUrl = window.location.pathname;
      
      // 3. FORZA IL RELOAD DELLA PAGINA
      // Usiamo window.location.href invece del router di Next.js.
      // Questo costringe il browser a ripartire da zero.
      // Al riavvio, il token sarà già nel localStorage e le API funzioneranno.
      window.location.href = newUrl;
    }
  }, [searchParams]);

  // Se c'è un token in URL, mostriamo un loader per evitare "flash" di contenuti non autorizzati
  if (searchParams.get("accessToken")) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
           <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
           <p className="text-sm text-muted-foreground font-medium">Autenticazione in corso...</p>
        </div>
      </div>
    );
  }

  return null;
}