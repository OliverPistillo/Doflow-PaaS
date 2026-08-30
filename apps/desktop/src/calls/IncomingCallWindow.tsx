import { useEffect, useMemo, useState } from "react";
import { nativeCallWindow } from "./native";
import type { NativeCallContext } from "./types";

export function IncomingCallWindow() {
  const [context, setContext] = useState<NativeCallContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void nativeCallWindow.getContext().then((value) => {
      if (active) setContext(value);
    }).catch(() => {
      if (active) setError("Questa chiamata non è più disponibile.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!context?.call.expiresAt) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(context.call.expiresAt!).getTime() - Date.now()) / 1000));
      setRemaining(Number.isFinite(seconds) ? seconds : null);
      if (seconds === 0) setError("Chiamata non risposta.");
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [context]);

  const title = useMemo(
    () => context?.call.callType === "video" ? "Videochiamata in arrivo" : "Audiochiamata in arrivo",
    [context],
  );

  const act = async (action: "accept" | "reject") => {
    setBusy(action);
    setError(null);
    try {
      await nativeCallWindow.sendAction({ action });
    } catch {
      setBusy(null);
      setError("Impossibile aggiornare la chiamata. Riprova dalla finestra principale.");
    }
  };

  return (
    <main className="incoming-call-surface">
      <section className="incoming-call-card" role="dialog" aria-modal="true" aria-labelledby="incoming-title">
        <div className="call-brand" aria-hidden="true"><span className="mini-wordmark" /></div>
        <div className={`incoming-call-glyph ${context?.call.callType === "video" ? "is-video" : ""}`} aria-hidden="true">
          {context?.call.callType === "video" ? "▣" : "◖"}
        </div>
        <p className="eyebrow">Doflow Calls</p>
        <h1 id="incoming-title">{title}</h1>
        <p className="incoming-caller">{context?.call.displayName || "Utente Doflow"}</p>
        {remaining !== null && !error ? <p className="incoming-time">Rispondi entro {remaining}s</p> : null}
        {error ? <p className="call-inline-error" role="alert">{error}</p> : null}
        <div className="incoming-call-actions">
          <button
            type="button"
            className="call-round-action is-reject"
            aria-label="Rifiuta chiamata"
            disabled={!context || busy !== null || Boolean(error)}
            onClick={() => void act("reject")}
          >✕<span>Rifiuta</span></button>
          <button
            type="button"
            className="call-round-action is-accept"
            aria-label="Rispondi alla chiamata"
            disabled={!context || busy !== null || Boolean(error)}
            onClick={() => void act("accept")}
          >✓<span>{busy === "accept" ? "Connessione…" : "Rispondi"}</span></button>
        </div>
      </section>
    </main>
  );
}
