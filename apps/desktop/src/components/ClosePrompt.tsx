import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellIcon,
  CheckIcon,
  CloseIcon,
  ExitIcon,
  InfoIcon,
  TrayIcon,
} from "./DesktopBannerIcons";

type ClosePromptProps = {
  onStayActive: (remember: boolean) => void | Promise<void>;
  onExit: (remember: boolean) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
};

export function ClosePrompt({ onStayActive, onExit, onCancel }: ClosePromptProps) {
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [suppressInitialFocusRing, setSuppressInitialFocusRing] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const actionStarted = useRef(false);

  const invokeOnce = useCallback((action: () => void | Promise<void>) => {
    if (actionStarted.current) return;
    actionStarted.current = true;
    setSubmitting(true);
    setActionError(undefined);
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        void result.catch(() => {
          actionStarted.current = false;
          setSubmitting(false);
          setActionError("Operazione non riuscita. Riprova.");
        });
      }
    } catch {
      actionStarted.current = false;
      setSubmitting(false);
      setActionError("Operazione non riuscita. Riprova.");
    }
  }, []);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        invokeOnce(onCancel);
        return;
      }
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === closeButtonRef.current) {
        event.preventDefault();
        cancelButtonRef.current?.focus();
      } else if (!event.shiftKey && document.activeElement === cancelButtonRef.current) {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [invokeOnce, onCancel]);

  return (
    <div className="close-prompt-backdrop" role="presentation">
      <section className="close-prompt" role="dialog" aria-modal="true" aria-labelledby="close-prompt-title" aria-describedby="close-prompt-description close-prompt-information">
        <button ref={closeButtonRef} className="panel-close-button" type="button" onClick={() => invokeOnce(onCancel)} disabled={submitting} aria-label="Annulla chiusura">
          <CloseIcon />
        </button>
        <div className="close-prompt-heading">
          <p className="eyebrow">DOFLOW DESKTOP</p>
          <h2 id="close-prompt-title">Chiudere Doflow?</h2>
        </div>
        <div className="close-prompt-question">
          <span className="close-prompt-glyph" aria-hidden="true"><BellIcon /></span>
          <p id="close-prompt-description">Vuoi lasciare Doflow attivo nell'area di notifica<br />per riaprirlo più velocemente?</p>
        </div>
        <div className="close-prompt-information" id="close-prompt-information">
          <InfoIcon />
          <p>Doflow continuerà a funzionare in background<br />e potrai ricevere notifiche e aggiornamenti.</p>
        </div>
        <label className="remember-close-choice">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={submitting} />
          <span className="remember-close-control" aria-hidden="true"><CheckIcon /></span>
          <span>Imposta questa opzione come predefinita</span>
        </label>
        <div className="close-prompt-actions">
          <button ref={primaryRef} className={`primary-action close-stay-action${suppressInitialFocusRing ? " is-initial-focus" : ""}`} type="button" onBlur={() => setSuppressInitialFocusRing(false)} onClick={() => invokeOnce(() => onStayActive(remember))} disabled={submitting} aria-busy={submitting || undefined}>
            <TrayIcon />
            <span>Rimani attivo</span>
          </button>
          <button className="secondary-action close-exit-action" type="button" onClick={() => invokeOnce(() => onExit(remember))} disabled={submitting}>
            <ExitIcon />
            <span>Esci da Doflow</span>
          </button>
          <button ref={cancelButtonRef} className="text-action close-cancel-action" type="button" onClick={() => invokeOnce(onCancel)} disabled={submitting}>Annulla</button>
        </div>
        {actionError ? <p className="close-prompt-error" role="alert">{actionError}</p> : null}
      </section>
    </div>
  );
}
