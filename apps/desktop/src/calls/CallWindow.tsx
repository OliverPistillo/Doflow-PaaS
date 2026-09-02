import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { nativeCallWindow, type NativeCallWindowApi } from "./native";
import type { CallRuntimeFailureCode } from "./LiveKitCallRuntime";
import type { NativeCallContext } from "./types";

type CallWindowFailureCode =
  | "call_context_unavailable"
  | "desktop_renderer_failed"
  | CallRuntimeFailureCode;

interface RuntimeModule {
  LiveKitCallRuntime: React.ComponentType<{
    context: NativeCallContext;
    api?: NativeCallWindowApi;
    onFatalError: (code: CallRuntimeFailureCode) => void;
  }>;
}

const loadDefaultRuntime = () => import("./LiveKitCallRuntime");

function failureCopy(code: CallWindowFailureCode) {
  if (code === "call_context_unavailable") return "La sessione non è più disponibile. Chiudi questa finestra e riprova da Doflow.";
  if (code === "media_credentials_missing") return "Le credenziali della chiamata non sono disponibili.";
  if (code === "media_permission_denied") return "Doflow non può usare il dispositivo selezionato. Controlla i permessi di Windows.";
  if (code === "media_initialization_failed") return "Il collegamento audio/video non è stato inizializzato.";
  return "Il modulo della chiamata non è stato avviato correttamente.";
}

function PreparingCallSurface({ context, closing, onClose }: {
  context: NativeCallContext | null;
  closing: boolean;
  onClose: () => void;
}) {
  return (
    <main className="call-window call-window-shell" data-call-shell="preparing">
      <header className="call-window-header">
        <div>
          <p className="eyebrow">Doflow Calls</p>
          <h1>{context?.call.displayName || "Preparazione chiamata"}</h1>
        </div>
        <div className="call-status" role="status" aria-live="polite">
          <span className="call-status-dot connecting" aria-hidden="true" />
          <span>Preparazione chiamata…</span>
        </div>
      </header>
      <section className="call-stage call-shell-stage" aria-label="Preparazione chiamata">
        <span className="call-shell-logo" aria-hidden="true" />
        <div className="call-shell-spinner" aria-hidden="true" />
        <strong>Doflow Calls</strong>
        <small>Connessione sicura in preparazione</small>
      </section>
      <footer className="call-controls call-shell-actions">
        <button type="button" className="call-end-button" onClick={onClose} disabled={closing} aria-label="Chiudi chiamata">
          <span aria-hidden="true">✕</span>{closing ? "Chiusura…" : "Chiudi"}
        </button>
      </footer>
    </main>
  );
}

function FailedCallSurface({ code, closing, onClose }: {
  code: CallWindowFailureCode;
  closing: boolean;
  onClose: () => void;
}) {
  return (
    <main className="call-window call-window-shell call-window-failed" data-call-shell="failed">
      <header className="call-window-header">
        <div>
          <p className="eyebrow error-eyebrow">Doflow Calls</p>
          <h1>Impossibile avviare la chiamata</h1>
        </div>
      </header>
      <section className="call-stage call-shell-stage" role="alert" aria-live="assertive">
        <span className="call-shell-logo" aria-hidden="true" />
        <strong>La chiamata è stata interrotta in sicurezza.</strong>
        <p>{failureCopy(code)}</p>
        <code>{code}</code>
      </section>
      <footer className="call-controls call-shell-actions">
        <button type="button" className="call-end-button" onClick={onClose} disabled={closing} aria-label="Chiudi chiamata">
          <span aria-hidden="true">✕</span>{closing ? "Chiusura…" : "Chiudi chiamata"}
        </button>
      </footer>
    </main>
  );
}

class CallRuntimeBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  onFailure: () => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CallWindow({
  api = nativeCallWindow,
  runtimeLoader = loadDefaultRuntime,
}: {
  api?: NativeCallWindowApi;
  runtimeLoader?: () => Promise<RuntimeModule>;
}) {
  const [context, setContext] = useState<NativeCallContext | null>(null);
  const [failure, setFailure] = useState<CallWindowFailureCode | null>(null);
  const [closing, setClosing] = useState(false);
  const failureReported = useRef(false);
  const closeRequested = useRef(false);
  const readyReported = useRef(false);
  const Runtime = useMemo(() => lazy(async () => {
    const loaded = await runtimeLoader();
    return { default: loaded.LiveKitCallRuntime };
  }), [runtimeLoader]);

  const fail = useCallback((code: CallWindowFailureCode) => {
    setFailure((current) => current || code);
  }, []);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;
    void api.getContext().then((value) => {
      if (mounted) setContext(value);
    }).catch(() => {
      if (mounted) fail("call_context_unavailable");
    });
    void api.onContextUpdated((value) => {
      if (!mounted) return;
      setContext(value);
      setFailure(null);
    }).then((dispose) => { unlisten = dispose; }).catch(() => undefined);
    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [api, fail]);

  useEffect(() => {
    if ((!context && !failure) || readyReported.current) return;
    readyReported.current = true;
    void api.ready().catch(() => undefined);
  }, [api, context, failure]);

  useEffect(() => {
    if (!failure || failureReported.current) return;
    failureReported.current = true;
    void api.sendAction({ action: "failed", reason: "desktop_renderer_failed" }).catch(() => undefined);
  }, [api, failure]);

  const close = useCallback(() => {
    if (closeRequested.current) return;
    closeRequested.current = true;
    setClosing(true);
    void api.close({
      action: "failed",
      reason: failure ? "desktop_renderer_failed" : "native_window_closed",
    }).catch(() => {
      closeRequested.current = false;
      setClosing(false);
    });
  }, [api, failure]);

  if (failure) return <FailedCallSurface code={failure} closing={closing} onClose={close} />;
  if (!context) return <PreparingCallSurface context={null} closing={closing} onClose={close} />;

  return (
    <CallRuntimeBoundary
      fallback={<FailedCallSurface code="desktop_renderer_failed" closing={closing} onClose={close} />}
      onFailure={() => fail("desktop_renderer_failed")}
    >
      <Suspense fallback={<PreparingCallSurface context={context} closing={closing} onClose={close} />}>
        <Runtime context={context} api={api} onFatalError={fail} />
      </Suspense>
    </CallRuntimeBoundary>
  );
}
