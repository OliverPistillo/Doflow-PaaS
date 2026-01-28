"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function AuthSync() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // C'è un token nell'URL?
    const tokenFromUrl = searchParams.get("accessToken");

    if (tokenFromUrl) {
      console.log("Token rilevato in URL. Sincronizzazione...");
      
      // 1. Sovrascrivi qualsiasi cosa ci sia nel localStorage
      window.localStorage.setItem("doflow_token", tokenFromUrl);

      // 2. Costruisci l'URL pulito (senza query params)
      const cleanUrl = window.location.pathname;

      // 3. HARD RELOAD. Questo è fondamentale.
      // Non usare router.push o replace qui. Vogliamo che il browser
      // riparta da zero leggendo il localStorage fresco.
      window.location.href = cleanUrl;
    }
  }, [searchParams]);

  // Se stiamo processando il token, mostriamo una pagina bianca o loader
  // per evitare che l'utente veda "401 Error" per una frazione di secondo.
  if (searchParams.get("accessToken")) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
           <p className="text-gray-500 font-medium">Autenticazione in corso...</p>
        </div>
      </div>
    );
  }

  return null;
}