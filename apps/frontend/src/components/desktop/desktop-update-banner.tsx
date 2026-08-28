"use client";

import * as React from "react";
import { ArrowDownToLine, X } from "lucide-react";

import {
  getDesktopUpdateState,
  installDesktopUpdate,
  useDoflowDesktop,
} from "@/lib/desktop-bridge";

export function DesktopUpdateBanner() {
  const isDesktop = useDoflowDesktop();
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    void getDesktopUpdateState()
      .then((state) => {
        if (!cancelled) setVisible(state?.kind === "optional");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isDesktop]);

  if (!isDesktop || !visible) return null;

  return (
    <aside className="fixed right-5 top-5 z-[100] flex max-w-[360px] items-center gap-3 rounded-2xl border border-violet-200/80 bg-white/95 px-4 py-3 text-slate-900 shadow-xl shadow-violet-950/10 backdrop-blur" aria-label="Aggiornamento Doflow Desktop disponibile">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white">
        <ArrowDownToLine className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Nuova versione disponibile</p>
        <div className="mt-1 flex items-center gap-3 text-xs">
          <button type="button" className="font-semibold text-violet-700 hover:text-violet-900" disabled={busy} onClick={() => {
            setBusy(true);
            void installDesktopUpdate().catch(() => setBusy(false));
          }}>
            {busy ? "Preparazione…" : "Aggiorna"}
          </button>
          <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setVisible(false)}>Più tardi</button>
        </div>
      </div>
      <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Chiudi notifica aggiornamento" onClick={() => setVisible(false)}>
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
