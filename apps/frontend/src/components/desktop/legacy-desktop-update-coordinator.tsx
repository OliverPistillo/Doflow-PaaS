"use client";

import * as React from "react";
import { ArrowDownToLine, RotateCcw } from "lucide-react";

import {
  coordinateLegacyDesktopUpdate,
  getLegacyDesktopUpdater,
  LegacyDesktopUpdateAttemptRegistry,
  type DesktopUpdateState,
  type LegacyDesktopUpdater,
} from "@/lib/desktop-bridge";

type ViewState =
  | { phase: "idle" }
  | { phase: "installing"; update: DesktopUpdateState }
  | { phase: "failed"; update?: DesktopUpdateState; message: string };

const attempts = new LegacyDesktopUpdateAttemptRegistry();

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/offline|network|timed?\s*out|reach|dns/i.test(message)) {
    return "Controlla la connessione e riprova.";
  }
  return "L’aggiornamento automatico non è stato completato.";
}

export function LegacyDesktopUpdateCoordinator() {
  const updaterRef = React.useRef<LegacyDesktopUpdater | null>(null);
  const runningRef = React.useRef(false);
  const [view, setView] = React.useState<ViewState>({ phase: "idle" });

  const run = React.useCallback(async (updater: LegacyDesktopUpdater) => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const result = await coordinateLegacyDesktopUpdate(updater, async (update) => {
        setView({ phase: "installing", update });
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
      if (result.status === "none") setView({ phase: "idle" });
    } catch (error) {
      setView((current) => ({
        phase: "failed",
        update: current.phase === "installing" ? current.update : undefined,
        message: readableError(error),
      }));
    } finally {
      runningRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    const updater = getLegacyDesktopUpdater();
    updaterRef.current = updater;
    if (!updater || !attempts.claim(updater)) return;
    void run(updater);
  }, [run]);

  if (view.phase === "idle") return null;
  const canContinue = view.phase === "failed" && view.update?.kind === "optional";
  const version = view.update?.latestVersion;

  return (
    <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-background/95 p-6 text-foreground backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="legacy-desktop-update-title">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
        <span className="mx-auto mb-6 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground" aria-hidden="true">
          {view.phase === "failed" ? <RotateCcw className="size-5" /> : <ArrowDownToLine className="size-5" />}
        </span>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Doflow Desktop · Canale Stable</p>
        <h1 id="legacy-desktop-update-title" className="text-2xl font-semibold tracking-tight">
          {view.phase === "failed" ? "Aggiornamento non completato" : "Aggiornamento di Doflow in corso"}
        </h1>
        {view.phase === "installing" ? (
          <>
            <div className="my-7 h-2 overflow-hidden rounded-full bg-muted" aria-label="Aggiornamento in corso">
              <span className="block h-full w-1/3 rounded-full bg-primary motion-safe:animate-pulse" />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {version ? `Installazione della versione ${version} in corso.` : "Installazione della nuova versione in corso."} Doflow si riavvierà automaticamente.
            </p>
          </>
        ) : (
          <>
            <p className="my-6 text-sm leading-6 text-muted-foreground" role="alert">{view.message}</p>
            <button className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" type="button" onClick={() => {
              const updater = updaterRef.current;
              if (updater) void run(updater);
            }}>
              Riprova aggiornamento
            </button>
            {canContinue ? (
              <button className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold" type="button" onClick={() => setView({ phase: "idle" })}>
                Continua con questa versione
              </button>
            ) : null}
          </>
        )}
        <p className="mt-6 text-xs text-muted-foreground">Doflow Desktop {updaterRef.current?.appVersion} · Stable</p>
      </section>
    </div>
  );
}
