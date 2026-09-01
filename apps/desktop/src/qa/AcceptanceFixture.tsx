import { useEffect, useState } from "react";
import { ProfilePicker } from "../components/ProfilePicker";
import { ClosePrompt } from "../components/ClosePrompt";
import {
  ErrorScreen,
  ExpiredProfileScreen,
  PreparingScreen,
  UpdateScreen,
} from "../components/StatusScreens";
import type { SavedProfile } from "../types";

type Scenario = "sweep" | "complete" | "slow" | "picker" | "mandatory" | "expired" | "error" | "close";

const profile: SavedProfile = {
  id: "10000000-4000-4000-8000-000000000001",
  userId: "qa-user",
  tenantSlug: "doflow",
  name: "Oliver",
  email: "oliver@doflow.it",
  initials: "O",
  createdAt: "2026-01-01T00:00:00Z",
  lastUsedAt: "2026-01-01T00:00:00Z",
  webviewContextId: "10000000-4000-4000-8000-000000000001",
};

const profiles: SavedProfile[] = [
  profile,
  {
    ...profile,
    id: "20000000-4000-4000-8000-000000000002",
    userId: "qa-user-2",
    name: "Martina",
    email: "martina@doflow.it",
    initials: "M",
    webviewContextId: "20000000-4000-4000-8000-000000000002",
  },
  {
    ...profile,
    id: "30000000-4000-4000-8000-000000000003",
    userId: "qa-user-3",
    tenantSlug: "doflow",
    name: "Daniele",
    email: "daniele@doflow.it",
    initials: "D",
    webviewContextId: "30000000-4000-4000-8000-000000000003",
  },
];

const scenarios: Record<string, Scenario> = {
  "1": "sweep",
  "2": "complete",
  "3": "slow",
  "4": "picker",
  "5": "mandatory",
  "6": "expired",
  "7": "error",
  "8": "close",
};

function SplashFrame({ frame }: { frame: "sweep" | "complete" }) {
  return (
    <div className="splash qa-splash" aria-label={`QA splash ${frame}`}>
      <div className="splash-vignette" />
      <div className="splash-logo-wrap">
        <div className="splash-ambient" style={{ opacity: frame === "sweep" ? 0.42 : 0.18, transform: frame === "sweep" ? "scale(1)" : "scale(.94)" }} />
        <div className="splash-logo splash-logo-reveal" style={{ clipPath: frame === "sweep" ? "inset(0 42% 0 0)" : "inset(0 0% 0 0)" }} />
        {frame === "sweep" ? (
          <div className="splash-sweep-mask" aria-hidden="true">
            <div className="splash-sweep-band" style={{ opacity: 1, transform: "translateX(250%)" }} />
          </div>
        ) : null}
      </div>
      <p className="splash-status">Preparazione del tuo workspace</p>
    </div>
  );
}

export function AcceptanceFixture() {
  const [scenario, setScenario] = useState<Scenario>("sweep");

  useEffect(() => {
    const select = (event: KeyboardEvent) => {
      const next = scenarios[event.key];
      if (next) setScenario(next);
    };
    window.addEventListener("keydown", select);
    return () => window.removeEventListener("keydown", select);
  }, []);

  let surface;
  if (scenario === "sweep" || scenario === "complete") {
    surface = <SplashFrame frame={scenario} />;
  } else if (scenario === "slow") {
    surface = <><PreparingScreen /><SplashFrame frame="complete" /></>;
  } else if (scenario === "picker") {
    surface = <ProfilePicker profiles={profiles} selectedProfileId={profile.id} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />;
  } else if (scenario === "mandatory") {
    surface = (
      <UpdateScreen
        update={{
          kind: "mandatory",
          currentVersion: "1.0.1",
          latestVersion: "1.1.0",
          minimumSupportedVersion: "1.1.0",
          policySource: "network",
          updateAvailable: true,
          canContinueWithoutUpdate: false,
        }}
        progress={{ downloaded: 42, total: 100, phase: "downloading" }}
        busy
        onRetry={() => undefined}
        onQuit={() => undefined}
      />
    );
  } else if (scenario === "expired") {
    surface = <ExpiredProfileScreen profile={profile} profiles={profiles} onReauthenticate={() => undefined} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} />;
  } else if (scenario === "error") {
    surface = <ErrorScreen message="Controlla la connessione e riprova." onRetry={() => undefined} onQuit={() => undefined} />;
  } else {
    surface = <><ProfilePicker profiles={profiles} selectedProfileId={profile.id} onSelect={() => undefined} onRemove={() => undefined} onAdd={() => undefined} onClose={() => undefined} /><ClosePrompt onStayActive={() => undefined} onExit={() => undefined} onCancel={() => undefined} /></>;
  }

  return <div className="app-root" data-qa-scenario={scenario} aria-label={`Doflow Desktop QA: ${scenario}`}>{surface}</div>;
}
