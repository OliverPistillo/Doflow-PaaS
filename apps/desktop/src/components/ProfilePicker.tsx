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
  return (
    <main className="local-surface">
      <section className="local-card profile-card" aria-labelledby="profile-title">
        <div className="mini-wordmark" aria-hidden="true" />
        <p className="eyebrow">Doflow Desktop</p>
        <h1 id="profile-title">Scegli un profilo</h1>
        <p className="lead">Ogni profilo mantiene la propria sessione in uno spazio isolato su questo dispositivo.</p>
        <div className="profile-list">
          {profiles.map((profile) => (
            <div className="profile-row" key={profile.id}>
              <button className="profile-main" type="button" onClick={() => onSelect(profile)} disabled={Boolean(busyProfileId)}>
                <span className="avatar">{initials(profile)}</span>
                <span className="profile-copy">
                  <strong>{profile.name}</strong>
                  <span>{profile.email}</span>
                </span>
                <span className="profile-arrow">{busyProfileId === profile.id ? "···" : "›"}</span>
              </button>
              <button className="remove-profile" type="button" onClick={() => onRemove(profile)} disabled={Boolean(busyProfileId)} aria-label={`Rimuovi ${profile.name} da questo dispositivo`}>
                Rimuovi
              </button>
            </div>
          ))}
        </div>
        <button className="secondary-action" type="button" onClick={onAdd} disabled={Boolean(busyProfileId)}>
          Usa un altro account
        </button>
      </section>
    </main>
  );
}
