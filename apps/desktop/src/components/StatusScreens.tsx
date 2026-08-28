import type { SavedProfile, UpdateProgressPayload } from "../types";

export function PreparingScreen() {
  return (
    <main className="local-surface">
      <section className="local-card compact-card" aria-live="polite">
        <div className="mini-wordmark" aria-hidden="true" />
        <div className="spinner" />
        <h1>Apertura di Doflow</h1>
        <p className="lead">Stiamo ripristinando la tua sessione.</p>
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

export function MandatoryUpdateScreen({ progress, busy, onInstall, onQuit }: { progress?: UpdateProgressPayload; busy: boolean; onInstall: () => void; onQuit: () => void }) {
  const percent = progress?.total && progress.total > 0
    ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
    : undefined;
  return (
    <main className="local-surface update-surface">
      <section className="local-card compact-card" aria-live="polite">
        <div className="mini-wordmark" aria-hidden="true" />
        <p className="eyebrow">Aggiornamento richiesto</p>
        <h1>Aggiornamento in corso</h1>
        {busy ? (
          <>
            <div className={`progress-track ${percent === undefined ? "indeterminate" : ""}`}>
              <span style={percent === undefined ? undefined : { width: `${percent}%` }} />
            </div>
            <p className="lead">{percent === undefined ? "Stiamo preparando la nuova versione di Doflow" : `${percent}% completato`}</p>
          </>
        ) : (
          <p className="lead">Questa versione non è più supportata. Installa l’aggiornamento verificato per continuare.</p>
        )}
        {progress?.phase === "failed" ? <p className="error-copy">{progress.message || "Aggiornamento non riuscito."}</p> : null}
        {!busy || progress?.phase === "failed" ? <button className="primary-action" type="button" onClick={onInstall}>Riprova aggiornamento</button> : null}
        <button className="text-action" type="button" onClick={onQuit}>Esci</button>
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
