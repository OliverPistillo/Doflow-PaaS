import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SavedProfile } from "../types";
import {
  ChevronIcon,
  CloseIcon,
  GearIcon,
  PlusIcon,
  TrashIcon,
} from "./DesktopBannerIcons";

type ProfilePickerProps = {
  profiles: SavedProfile[];
  busyProfileId?: string;
  selectedProfileId?: string;
  onSelect: (profile: SavedProfile) => void | Promise<void>;
  onRemove: (profile: SavedProfile) => void | Promise<void>;
  onAdd: () => void | Promise<void>;
  onClose: () => void;
};

function initials(profile: SavedProfile) {
  return profile.initials || profile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DF";
}

function profileIsAmbiguous(profile: SavedProfile, profiles: SavedProfile[]) {
  const email = profile.email.trim().toLocaleLowerCase();
  const name = profile.name.trim().toLocaleLowerCase();
  return profiles.some((candidate) => candidate.id !== profile.id && (
    candidate.email.trim().toLocaleLowerCase() === email
    || candidate.name.trim().toLocaleLowerCase() === name
  ));
}

export function ProfilePicker({
  profiles,
  busyProfileId,
  selectedProfileId,
  onSelect,
  onRemove,
  onAdd,
  onClose,
}: ProfilePickerProps) {
  const [managing, setManaging] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<SavedProfile>();
  const [localBusyProfileId, setLocalBusyProfileId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const cancelRemovalRef = useRef<HTMLButtonElement>(null);
  const removalDialogRef = useRef<HTMLElement>(null);
  const removalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionStarted = useRef(false);
  const mounted = useRef(true);
  const effectiveBusyProfileId = busyProfileId || localBusyProfileId;
  const activeProfileId = effectiveBusyProfileId || selectedProfileId || profiles[0]?.id;
  const profileIds = useMemo(() => new Set(profiles.map((profile) => profile.id)), [profiles]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const releaseAction = useCallback(() => {
    actionStarted.current = false;
    if (mounted.current) setLocalBusyProfileId(undefined);
  }, []);

  const runProfileAction = useCallback((profileId: string, action: () => void | Promise<void>) => {
    if (actionStarted.current || busyProfileId) return;
    actionStarted.current = true;
    setActionError(undefined);
    setLocalBusyProfileId(profileId);
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        void result.then(releaseAction).catch(() => {
          releaseAction();
          if (mounted.current) setActionError("Operazione non riuscita. Riprova.");
        });
      } else {
        queueMicrotask(releaseAction);
      }
    } catch {
      releaseAction();
      setActionError("Operazione non riuscita. Riprova.");
    }
  }, [busyProfileId, releaseAction]);

  useEffect(() => {
    if (pendingRemoval && !profileIds.has(pendingRemoval.id)) setPendingRemoval(undefined);
    if (profiles.length === 0) setManaging(false);
  }, [pendingRemoval, profileIds, profiles.length]);

  useEffect(() => {
    if (pendingRemoval) cancelRemovalRef.current?.focus();
  }, [pendingRemoval]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Tab" && pendingRemoval && removalDialogRef.current) {
        const focusable = [...removalDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        )];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (first && last && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (first && last && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (pendingRemoval) {
        setPendingRemoval(undefined);
        removalTriggerRef.current?.focus();
      } else if (managing) {
        setManaging(false);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [managing, onClose, pendingRemoval]);

  const confirmRemoval = () => {
    if (!pendingRemoval || effectiveBusyProfileId) return;
    const profile = pendingRemoval;
    setPendingRemoval(undefined);
    runProfileAction(profile.id, () => onRemove(profile));
  };

  return (
    <main className="local-surface profile-picker-surface">
      <section className="profile-picker-panel" aria-labelledby="profile-title">
        <button className="panel-close-button" type="button" onClick={onClose} aria-label="Chiudi selezione profili">
          <CloseIcon />
        </button>
        <header className="profile-picker-header">
          <div className="mini-wordmark" aria-hidden="true" />
          <div>
            <h1 id="profile-title">Profili memorizzati</h1>
            <p className="lead">Accedi rapidamente ai tuoi profili</p>
          </div>
        </header>
        <div className="profile-list" aria-label="Profili disponibili">
          {profiles.length === 0 ? (
            <div className="profile-empty-state" role="status">
              <strong>Nessun profilo memorizzato</strong>
              <span>Accedi con un account per iniziare.</span>
            </div>
          ) : profiles.map((profile) => {
            const selected = profile.id === activeProfileId;
            const busy = profile.id === effectiveBusyProfileId;
            const tenantHint = profileIsAmbiguous(profile, profiles) ? profile.tenantSlug : undefined;
            const accessibleTenant = profile.tenantSlug ? `, tenant ${profile.tenantSlug}` : "";
            return (
            <div className={`profile-row${selected ? " is-selected" : ""}${managing ? " is-managing" : ""}`} key={profile.id} aria-busy={busy || undefined}>
              <button
                className="profile-main"
                type="button"
                onClick={() => runProfileAction(profile.id, () => onSelect(profile))}
                disabled={Boolean(effectiveBusyProfileId) || managing}
                aria-label={`${profile.name}, ${profile.email}${accessibleTenant}${busy ? ", apertura in corso" : ""}`}
              >
                <span className="avatar" aria-hidden="true">
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile)}
                </span>
                <span className="profile-copy">
                  <strong>{profile.name}</strong>
                  <span>{profile.email}{tenantHint ? ` · ${tenantHint}` : ""}</span>
                </span>
                {busy ? (
                  <span className="profile-busy-indicator" aria-hidden="true" />
                ) : (
                  <ChevronIcon className="profile-arrow" />
                )}
              </button>
              {managing ? (
                <button
                  className="profile-remove-action"
                  type="button"
                  onClick={(event) => {
                    removalTriggerRef.current = event.currentTarget;
                    setPendingRemoval(profile);
                  }}
                  disabled={Boolean(effectiveBusyProfileId)}
                  aria-label={`Rimuovi ${profile.name} da questo dispositivo`}
                >
                  <TrashIcon />
                </button>
              ) : null}
            </div>
          );})}
        </div>
        <button className="secondary-action profile-add-action" type="button" onClick={() => runProfileAction("new", onAdd)} disabled={Boolean(effectiveBusyProfileId) || managing}>
          <PlusIcon />
          <span>Accedi con un altro account</span>
        </button>
        {actionError ? <p className="profile-action-error" role="alert">{actionError}</p> : null}
        <button
          className={`profile-management-toggle${managing ? " is-active" : ""}`}
          type="button"
          onClick={() => setManaging((current) => !current)}
          disabled={Boolean(effectiveBusyProfileId) || profiles.length === 0}
          aria-pressed={managing}
        >
          <GearIcon />
          <span>{managing ? "Fine gestione" : "Gestione profili"}</span>
        </button>
        {pendingRemoval ? (
          <div className="profile-removal-backdrop" role="presentation">
            <section ref={removalDialogRef} className="profile-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-removal-title" aria-describedby="profile-removal-description">
              <TrashIcon className="profile-removal-icon" />
              <h2 id="profile-removal-title">Rimuovere questo profilo?</h2>
              <p id="profile-removal-description">
                {pendingRemoval.name} verrà rimosso soltanto da questo dispositivo. L’account Doflow non verrà eliminato.
              </p>
              <div className="profile-removal-actions">
                <button ref={cancelRemovalRef} className="secondary-action" type="button" onClick={() => {
                  setPendingRemoval(undefined);
                  removalTriggerRef.current?.focus();
                }}>Annulla</button>
                <button className="danger-action" type="button" onClick={confirmRemoval}>Rimuovi profilo</button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
