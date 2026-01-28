"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AuthSync() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Cerca il token nell'URL
    const tokenFromUrl = searchParams.get("accessToken");

    if (tokenFromUrl) {
      // 1. Salva il token nel LocalStorage del NUOVO dominio
      window.localStorage.setItem("doflow_token", tokenFromUrl);

      // 2. Pulisci l'URL per sicurezza (rimuovi il token dalla barra indirizzi)
      const newUrl = window.location.pathname;
      router.replace(newUrl);
      
      // 3. (Opzionale) Forza un refresh per assicurarsi che apiFetch legga il nuovo token
      router.refresh();
    }
  }, [searchParams, router]);

  return null; // Questo componente non renderizza nulla visivamente
}