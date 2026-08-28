import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { nativeDesktop, type DesktopUnlisten } from "./bridge/native";
import {
  bootstrapReducer,
  initialBootstrapState,
  resolveStartupProfile,
} from "./bootstrap/machine";
import { ProfilePicker } from "./components/ProfilePicker";
import { Splash } from "./components/Splash";
import {
  ErrorScreen,
  ExpiredProfileScreen,
  MandatoryUpdateScreen,
  PreparingScreen,
} from "./components/StatusScreens";
import type { ProfileRegistry, SavedProfile, UpdateProgressPayload } from "./types";

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/offline|dns|network|reach|timed?\s*out/i.test(message)) {
    return "Controlla la connessione e riprova.";
  }
  return message || "Si è verificato un errore durante l’avvio.";
}

export default function App() {
  const [state, dispatch] = useReducer(bootstrapReducer, initialBootstrapState);
  const [splashExiting, setSplashExiting] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [busyProfileId, setBusyProfileId] = useState<string>();
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressPayload>();
  const [installing, setInstalling] = useState(false);
  const activationStarted = useRef(false);
  const bootstrapRequested = useRef(false);
  const exitTarget = useRef<"local" | "remote">("local");

  const prepareProfile = useCallback(async (profile?: SavedProfile) => {
    setBusyProfileId(profile?.id || "new");
    dispatch({ type: "PROFILE_PREPARING", profile, profileId: profile?.id });
    try {
      const prepared = await nativeDesktop.prepareProfile(profile?.id);
      dispatch({ type: "PROFILE_PREPARED", profileId: prepared.profileId });
    } catch (error) {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    } finally {
      setBusyProfileId(undefined);
    }
  }, []);

  const startBootstrap = useCallback(async () => {
    activationStarted.current = false;
    setSplashExiting(false);
    setSplashVisible(true);
    dispatch({ type: "START" });

    const profilesPromise = nativeDesktop.loadProfiles();
    const updatePromise = nativeDesktop.checkForUpdates();

    void updatePromise
      .then((update) => dispatch({ type: "UPDATE_RESOLVED", update }))
      .catch((error) => dispatch({
        type: "UPDATE_RESOLVED",
        update: {
          kind: "unavailable",
          currentVersion: "unknown",
          message: errorMessage(error),
          policySource: "none",
          updateAvailable: false,
        },
      }));

    try {
      const registry = await profilesPromise;
      dispatch({ type: "PROFILES_LOADED", registry });
      const startupProfile = resolveStartupProfile(registry);
      if (startupProfile) {
        await prepareProfile(startupProfile);
      } else if (registry.profiles.length === 0) {
        await prepareProfile();
      } else {
        dispatch({ type: "PICKER_REQUIRED" });
      }
    } catch (error) {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    }
  }, [prepareProfile]);

  useEffect(() => {
    const listeners: Promise<DesktopUnlisten>[] = [
      nativeDesktop.onRemoteReady((remote) => dispatch({ type: "REMOTE_READY", remote })),
      nativeDesktop.onProfileSwitchRequested(() => {
        void nativeDesktop.loadProfiles().then((registry) => {
          activationStarted.current = false;
          setSplashVisible(false);
          dispatch({ type: "SWITCH_REQUESTED", registry });
        });
      }),
      nativeDesktop.onUpdateProgress(setUpdateProgress),
      nativeDesktop.onBootstrapError((message) => dispatch({ type: "FAIL", message })),
    ];
    if (!bootstrapRequested.current) {
      bootstrapRequested.current = true;
      void startBootstrap();
    }
    return () => {
      for (const listener of listeners) void listener.then((unlisten) => unlisten());
    };
  }, [startBootstrap]);

  useEffect(() => {
    if (!splashVisible || splashExiting || !state.animationFinished) return;
    if (state.phase === "ready") {
      if (activationStarted.current) return;
      activationStarted.current = true;
      exitTarget.current = "remote";
      setSplashExiting(true);
      return;
    }
    if (["picker", "expired-profile", "mandatory-update", "error"].includes(state.phase)) {
      exitTarget.current = "local";
      setSplashExiting(true);
    }
  }, [splashExiting, splashVisible, state.animationFinished, state.phase]);

  const finishSplashExit = useCallback(() => {
    setSplashVisible(false);
    if (exitTarget.current !== "remote") return;
    void nativeDesktop.activatePreparedProfile().catch((error) => {
      activationStarted.current = false;
      dispatch({ type: "FAIL", message: errorMessage(error) });
    });
  }, []);

  const removeProfile = useCallback(async (profile: SavedProfile) => {
    if (!window.confirm(`Rimuovere ${profile.name} da questo dispositivo? L’account Doflow non verrà eliminato.`)) return;
    setBusyProfileId(profile.id);
    try {
      const registry = await nativeDesktop.removeProfile(profile.id);
      dispatch({ type: "SWITCH_REQUESTED", registry });
    } catch (error) {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    } finally {
      setBusyProfileId(undefined);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    setInstalling(true);
    setUpdateProgress({ downloaded: 0, phase: "starting" });
    try {
      await nativeDesktop.installUpdate();
    } catch (error) {
      setInstalling(false);
      setUpdateProgress({ downloaded: 0, phase: "failed", message: errorMessage(error) });
    }
  }, []);

  const registry: ProfileRegistry = state.registry || { version: 1, profiles: [] };
  const background = useMemo(() => {
    if (state.phase === "picker") {
      return <ProfilePicker profiles={registry.profiles} busyProfileId={busyProfileId} onSelect={prepareProfile} onRemove={removeProfile} onAdd={() => prepareProfile()} />;
    }
    if (state.phase === "expired-profile" && state.selectedProfile) {
      return <ExpiredProfileScreen profile={state.selectedProfile} onReauthenticate={() => { void nativeDesktop.activatePreparedProfile().catch((error) => dispatch({ type: "FAIL", message: errorMessage(error) })); }} onOther={() => dispatch({ type: "PICKER_REQUIRED" })} />;
    }
    if (state.phase === "mandatory-update") {
      return <MandatoryUpdateScreen progress={updateProgress} busy={installing} onInstall={installUpdate} onQuit={() => void nativeDesktop.quit()} />;
    }
    if (state.phase === "error") {
      return <ErrorScreen message={state.error || "Avvio non riuscito."} onRetry={() => void startBootstrap()} onQuit={() => void nativeDesktop.quit()} />;
    }
    return <PreparingScreen />;
  }, [busyProfileId, installUpdate, installing, prepareProfile, registry.profiles, removeProfile, startBootstrap, state.error, state.phase, state.selectedProfile, updateProgress]);

  return (
    <div className="app-root">
      <div className="window-controls" data-tauri-drag-region>
        <button type="button" aria-label="Riduci a icona" onClick={() => void nativeDesktop.minimize()}>—</button>
        <button type="button" aria-label="Chiudi Doflow" onClick={() => void nativeDesktop.quit()}>×</button>
      </div>
      {background}
      {splashVisible ? (
        <Splash
          exiting={splashExiting}
          onAnimationFinished={() => dispatch({ type: "ANIMATION_FINISHED" })}
          onExitFinished={finishSplashExit}
        />
      ) : null}
    </div>
  );
}
