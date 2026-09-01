import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { nativeCallWindow, type NativeCallWindowApi } from "./native";
import type { NativeCallContext } from "./types";

function IncomingFailure({ api }: { api: NativeCallWindowApi }) {
  const [closing, setClosing] = useState(false);
  return (
    <main className="incoming-call-surface">
      <section className="incoming-call-card incoming-call-failed" role="alert">
        <div className="call-brand" aria-hidden="true"><span className="mini-wordmark" /></div>
        <p className="eyebrow error-eyebrow">Doflow Calls</p>
        <h1>Chiamata non disponibile</h1>
        <p className="call-inline-error">La finestra è stata arrestata in sicurezza.</p>
        <button
          type="button"
          className="incoming-close-action"
          disabled={closing}
          onClick={() => {
            setClosing(true);
            void api.close({ action: "reject", reason: "desktop_renderer_failed" }).catch(() => setClosing(false));
          }}
        >{closing ? "Chiusura…" : "Chiudi"}</button>
      </section>
    </main>
  );
}

class IncomingBoundary extends Component<{
  api: NativeCallWindowApi;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    void this.props.api.sendAction({ action: "reject", reason: "desktop_renderer_failed" }).catch(() => undefined);
  }

  render() {
    return this.state.failed ? <IncomingFailure api={this.props.api} /> : this.props.children;
  }
}

function IncomingCallWindowRuntime({ api }: { api: NativeCallWindowApi }) {
  const [context, setContext] = useState<NativeCallContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "reject" | "close" | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const timeoutClosed = useRef(false);
  const actionPending = useRef(false);

  const closeUnavailable = useCallback(() => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy("close");
    void api.close().catch(() => {
      actionPending.current = false;
      setBusy(null);
    });
  }, [api]);

  useEffect(() => {
    let active = true;
    void api.getContext().then((value) => {
      if (active) setContext(value);
    }).catch(() => {
      if (active) setError("Questa chiamata non è più disponibile.");
    });
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!context?.call.expiresAt) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(context.call.expiresAt!).getTime() - Date.now()) / 1000));
      setRemaining(Number.isFinite(seconds) ? seconds : null);
      if (seconds === 0 && !timeoutClosed.current) {
        timeoutClosed.current = true;
        actionPending.current = true;
        setError("Chiamata non risposta.");
        void api.close().catch(() => undefined);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [api, context]);

  const title = useMemo(
    () => context?.call.callType === "video" ? "Videochiamata in arrivo" : "Audiochiamata in arrivo",
    [context],
  );

  const act = async (action: "accept" | "reject") => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(action);
    setError(null);
    try {
      await api.close({ action });
    } catch {
      actionPending.current = false;
      setBusy(null);
      setError("Impossibile aggiornare la chiamata. Chiudi questa finestra e riprova da Doflow.");
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
            aria-label={error ? "Chiudi chiamata" : "Rifiuta chiamata"}
            disabled={busy !== null || (!context && !error)}
            onClick={error ? closeUnavailable : () => void act("reject")}
          >✕<span>{busy === "reject" || busy === "close" ? "Chiusura…" : (error ? "Chiudi" : "Rifiuta")}</span></button>
          {!error ? (
            <button
              type="button"
              className="call-round-action is-accept"
              aria-label="Rispondi alla chiamata"
              disabled={!context || busy !== null}
              onClick={() => void act("accept")}
            >✓<span>{busy === "accept" ? "Connessione…" : "Rispondi"}</span></button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function IncomingCallWindow({ api = nativeCallWindow }: { api?: NativeCallWindowApi }) {
  return (
    <IncomingBoundary api={api}>
      <IncomingCallWindowRuntime api={api} />
    </IncomingBoundary>
  );
}
