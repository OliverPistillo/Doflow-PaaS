import { useEffect, useRef, useState } from "react";

type ClosePromptProps = {
  onStayActive: (remember: boolean) => void;
  onExit: (remember: boolean) => void;
  onCancel: () => void;
};

export function ClosePrompt({ onStayActive, onExit, onCancel }: ClosePromptProps) {
  const [remember, setRemember] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="close-prompt-backdrop" role="presentation">
      <section className="close-prompt" role="dialog" aria-modal="true" aria-labelledby="close-prompt-title" aria-describedby="close-prompt-description">
        <div className="close-prompt-icon" aria-hidden="true">×</div>
        <div className="close-prompt-heading">
          <p className="eyebrow">Doflow Desktop</p>
          <h2 id="close-prompt-title">Chiudere Doflow?</h2>
        </div>
        <p id="close-prompt-description">Vuoi lasciare Doflow attivo nell'area di notifica per riaprirlo più velocemente?</p>
        <label className="remember-close-choice">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>Usa questa scelta come predefinita</span>
        </label>
        <div className="close-prompt-actions">
          <button ref={primaryRef} className="primary-action" type="button" onClick={() => onStayActive(remember)}>Rimani attivo</button>
          <button className="secondary-action" type="button" onClick={() => onExit(remember)}>Esci da Doflow</button>
          <button className="text-action" type="button" onClick={onCancel}>Annulla</button>
        </div>
      </section>
    </div>
  );
}
