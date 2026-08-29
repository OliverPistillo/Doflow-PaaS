import { useEffect, useState } from "react";
import type { SavedProfile } from "../types";

type ProfilePickerProps = {
  profiles: SavedProfile[];
  busyProfileId?: string;
  onSelect: (profile: SavedProfile) => void;
  onRemove: (profile: SavedProfile) => void;
  onAdd: () => void;
};

function initials(profile: SavedProfile) {
  return profile.initials || profile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DF";
}

export function ProfilePicker({ profiles, busyProfileId, onSelect, onRemove, onAdd }: ProfilePickerProps) {
  const [openMenuId, setOpenMenuId] = useState<string>();

  useEffect(() => {
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(undefined);
    };
    window.addEventListener("keydown", closeMenu);
    return () => window.removeEventListener("keydown", closeMenu);
  }, []);

  return (
    <main className="local-surface">
      <section className="profile-picker-panel" aria-labelledby="profile-title">
        <header className="profile-picker-header">
          <div className="mini-wordmark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Doflow Desktop</p>
            <h1 id="profile-title">Seleziona profilo</h1>
            <p className="lead">Continua nel tuo spazio di lavoro Doflow.</p>
          </div>
        </header>
        <div className="profile-list">
          {profiles.map((profile) => (
            <div className="profile-row" key={profile.id}>
              <button className="profile-main" type="button" onClick={() => onSelect(profile)} disabled={Boolean(busyProfileId)}>
                <span className="avatar">{initials(profile)}</span>
                <span className="profile-copy">
                  <strong>{profile.name}</strong>
                  <span>{profile.email}{profile.tenantSlug ? ` · ${profile.tenantSlug}` : ""}</span>
                </span>
                <span className="profile-arrow" aria-hidden="true">{busyProfileId === profile.id ? "···" : "›"}</span>
              </button>
              <button
                className="profile-more"
                type="button"
                onClick={() => setOpenMenuId((current) => current === profile.id ? undefined : profile.id)}
                disabled={Boolean(busyProfileId)}
                aria-label={`Azioni per ${profile.name}`}
                aria-expanded={openMenuId === profile.id}
              >
                ⋯
              </button>
              {openMenuId === profile.id ? (
                <div className="profile-context-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setOpenMenuId(undefined); onRemove(profile); }}>
                    Rimuovi da questo dispositivo
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <button className="secondary-action" type="button" onClick={onAdd} disabled={Boolean(busyProfileId)}>
          <span aria-hidden="true">＋</span> Accedi con un altro account
        </button>
        <p className="profile-privacy"><span aria-hidden="true">▣</span> Sessioni isolate su questo dispositivo</p>
      </section>
    </main>
  );
}
