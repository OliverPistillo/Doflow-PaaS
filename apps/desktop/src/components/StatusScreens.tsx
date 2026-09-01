import type { DesktopUpdateState, SavedProfile, UpdateProgressPayload } from "../types";

function DesktopVersion({ version }: { version?: string }) {
  if (!version || version === "unknown") return null;
  return <p className="desktop-version">Doflow Desktop {version} · Canale Stable</p>;
}

export function PreparingScreen({ version }: { version?: string }) {
  return (
    <main className="local-surface">
      <section className="local-card compact-card" aria-live="polite">
        <div className="mini-wordmark" aria-hidden="true" />
        <div className="spinner" />
        <h1>Apertura di Doflow</h1>
        <p className="lead">Stiamo ripristinando la tua sessione.</p>
        <DesktopVersion version={version} />
      </section>
    </main>
  );
}

export function ExpiredProfileScreen({ profile, onReauthenticate, onOther }: { profile: SavedProfile; onReauthenticate: () => void; onOther: () => void }) {
  return (
    <main className="local-surface">
      <section className="local-card compact-card">
        <div className="mini-wordmark" aria-hidden="true" />
        <span className="avatar large-avatar">{profile.initials || profile.name.slice(0, 2).toUpperCase()}</span>
        <p className="eyebrow">Bentornato</p>
        <h1>{profile.name}</h1>
        <p className="lead">{profile.email}</p>
        <button className="primary-action" type="button" onClick={onReauthenticate}>Accedi di nuovo</button>
        <button className="text-action" type="button" onClick={onOther}>Usa un altro account</button>
      </section>
    </main>
  );
}

export function UpdateScreen({ update, progress, busy, onRetry, onContinue, onQuit }: {
  update: DesktopUpdateState;
  progress?: UpdateProgressPayload;
  busy: boolean;
  onRetry: () => void;
  onContinue?: () => void;
  onQuit: () => void;
}) {
  const percent = progress?.total && progress.total > 0
    ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
    : undefined;
  const failed = progress?.phase === "failed";
  const hasInstallableUpdate = update.updateAvailable
    && (update.kind === "optional" || update.kind === "mandatory");
  const heading = hasInstallableUpdate
    ? "Aggiornamento Doflow"
    : update.kind === "mandatory"
      ? "Aggiornamento richiesto"
      : "Verifica aggiornamenti non riuscita";
  const status = progress?.phase === "installing"
    ? "Installazione in corso. Doflow si riavvierà automaticamente."
    : percent === undefined
      ? "Download e verifica della nuova versione in corso."
      : `${percent}% completato`;
  return (
    <main className="local-surface update-surface">
      <section className="local-card compact-card" aria-live="polite">
        <div className="mini-wordmark" aria-hidden="true" />
        <p className="eyebrow">Canale Stable</p>
        <h1>{heading}</h1>
        {busy ? (
          <>
            <div className={`progress-track ${percent === undefined ? "indeterminate" : ""}`}>
              <span style={percent === undefined ? undefined : { width: `${percent}%` }} />
            </div>
            <p className="lead">{status}</p>
          </>
        ) : (
          <p className="lead">
            {hasInstallableUpdate
              ? "L’installazione automatica non è stata completata. Riprova per continuare con la versione più recente."
              : update.kind === "mandatory"
                ? "Questa versione non è più supportata. Connettiti a Internet e riprova l’aggiornamento."
                : "Non è stato possibile verificare il canale aggiornamenti. Controlla la connessione e riprova."}
          </p>
        )}
        {failed ? <p className="error-copy" role="alert">{progress.message || "Aggiornamento non riuscito."}</p> : null}
        {!busy || failed ? <button className="primary-action" type="button" onClick={onRetry}>Riprova aggiornamento</button> : null}
        {onContinue && (!busy || failed) ? <button className="secondary-action update-continue" type="button" onClick={onContinue}>Continua con questa versione</button> : null}
        <button className="text-action" type="button" onClick={onQuit}>Esci</button>
        <DesktopVersion version={update.currentVersion} />
        {update.latestVersion ? <p className="desktop-version">Versione disponibile {update.latestVersion}</p> : null}
      </section>
    </main>
  );
}

export function ErrorScreen({ message, onRetry, onQuit }: { message: string; onRetry: () => void; onQuit: () => void }) {
  return (
    <main className="local-surface">
      <section className="local-card compact-card">
        <div className="mini-wordmark" aria-hidden="true" />
        <p className="eyebrow error-eyebrow">Connessione non disponibile</p>
        <h1>Impossibile raggiungere Doflow</h1>
        <p className="lead">{message}</p>
        <button className="primary-action" type="button" onClick={onRetry}>Riprova</button>
        <button className="text-action" type="button" onClick={onQuit}>Esci</button>
      </section>
    </main>
  );
}
