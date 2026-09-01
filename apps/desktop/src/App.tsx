import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { nativeDesktop, type DesktopUnlisten } from "./bridge/native";
import {
  bootstrapReducer,
  initialBootstrapState,
  resolveStartupProfile,
} from "./bootstrap/machine";
import { createStartupUpdateRunner } from "./bootstrap/updater";
import { ProfilePicker } from "./components/ProfilePicker";
import { ClosePrompt } from "./components/ClosePrompt";
import { Splash } from "./components/Splash";
import {
  ErrorScreen,
  ExpiredProfileScreen,
  PreparingScreen,
  UpdateScreen,
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
  const [closePromptVisible, setClosePromptVisible] = useState(false);
  const activationStarted = useRef(false);
  const bootstrapRequested = useRef(false);
  const profilesRequested = useRef(false);
  const exitTarget = useRef<"local" | "remote">("local");
  const updateRunner = useRef<ReturnType<typeof createStartupUpdateRunner> | null>(null);
  if (!updateRunner.current) updateRunner.current = createStartupUpdateRunner(nativeDesktop);

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

  const startProfileBootstrap = useCallback(async () => {
    if (profilesRequested.current) return;
    profilesRequested.current = true;
    try {
      const registry = await nativeDesktop.loadProfiles();
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
      profilesRequested.current = false;
      dispatch({ type: "FAIL", message: errorMessage(error) });
    }
  }, [prepareProfile]);

  const runUpdateGate = useCallback(async () => {
    setInstalling(true);
    setUpdateProgress({ downloaded: 0, phase: "starting" });
    const result = await updateRunner.current!.run({
      formatError: errorMessage,
      onUpdateResolved: (update) => dispatch({ type: "UPDATE_RESOLVED", update }),
      onInstallStarted: () => {
        setInstalling(true);
        setUpdateProgress({ downloaded: 0, phase: "starting" });
      },
      onInstallFailed: (message) => {
        setInstalling(false);
        setUpdateProgress({ downloaded: 0, phase: "failed", message });
      },
    });
    if (result.status === "continue") {
      setInstalling(false);
      setUpdateProgress(undefined);
      await startProfileBootstrap();
    } else if (result.status === "blocked" && !result.error) {
      setInstalling(false);
      setUpdateProgress(undefined);
    }
  }, [startProfileBootstrap]);

  const startBootstrap = useCallback(async () => {
    activationStarted.current = false;
    profilesRequested.current = false;
    setSplashExiting(false);
    setSplashVisible(true);
    setInstalling(false);
    setUpdateProgress(undefined);
    dispatch({ type: "START" });
    await runUpdateGate();
  }, [runUpdateGate]);

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
      nativeDesktop.onClosePromptRequested(() => setClosePromptVisible(true)),
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
    if (["picker", "expired-profile", "updating", "update-blocked", "error"].includes(state.phase)) {
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

  const registry: ProfileRegistry = state.registry || { version: 1, profiles: [] };
  const continueWithoutUpdate = useCallback(() => {
    dispatch({ type: "CONTINUE_WITHOUT_UPDATE" });
    setInstalling(false);
    setUpdateProgress(undefined);
    void startProfileBootstrap();
  }, [startProfileBootstrap]);
  const resolveClose = useCallback((behavior: "tray" | "exit", remember: boolean) => {
    setClosePromptVisible(false);
    void nativeDesktop.resolveClose(behavior, remember).catch((error) => {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    });
  }, []);
  const cancelClose = useCallback(() => {
    setClosePromptVisible(false);
    void nativeDesktop.cancelClose();
  }, []);
  const background = useMemo(() => {
    if (state.phase === "picker") {
      return <ProfilePicker profiles={registry.profiles} busyProfileId={busyProfileId} version={state.update?.currentVersion} onSelect={prepareProfile} onRemove={removeProfile} onAdd={() => prepareProfile()} />;
    }
    if (state.phase === "expired-profile" && state.selectedProfile) {
      return <ExpiredProfileScreen profile={state.selectedProfile} onReauthenticate={() => { void nativeDesktop.activatePreparedProfile().catch((error) => dispatch({ type: "FAIL", message: errorMessage(error) })); }} onOther={() => dispatch({ type: "PICKER_REQUIRED" })} />;
    }
    if ((state.phase === "updating" || state.phase === "update-blocked") && state.update) {
      return (
        <UpdateScreen
          update={state.update}
          progress={updateProgress}
          busy={installing}
          onRetry={() => void runUpdateGate()}
          onContinue={state.update.canContinueWithoutUpdate ? continueWithoutUpdate : undefined}
          onQuit={() => void nativeDesktop.quit()}
        />
      );
    }
    if (state.phase === "error") {
      return <ErrorScreen message={state.error || "Avvio non riuscito."} onRetry={() => void startBootstrap()} onQuit={() => void nativeDesktop.quit()} />;
    }
    return <PreparingScreen version={state.update?.currentVersion} />;
  }, [busyProfileId, continueWithoutUpdate, installing, prepareProfile, registry.profiles, removeProfile, runUpdateGate, startBootstrap, state.error, state.phase, state.selectedProfile, state.update, updateProgress]);

  return (
    <div className="app-root">
      <div className="window-controls" data-tauri-drag-region>
        <button type="button" aria-label="Riduci a icona" onClick={() => void nativeDesktop.minimize()}>—</button>
        <button type="button" aria-label="Chiudi Doflow" onClick={() => void nativeDesktop.requestClose()}>×</button>
      </div>
      {background}
      {splashVisible ? (
        <Splash
          exiting={splashExiting}
          onAnimationFinished={() => dispatch({ type: "ANIMATION_FINISHED" })}
          onExitFinished={finishSplashExit}
        />
      ) : null}
      {closePromptVisible ? (
        <ClosePrompt
          onStayActive={(remember) => resolveClose("tray", remember)}
          onExit={(remember) => resolveClose("exit", remember)}
          onCancel={cancelClose}
        />
      ) : null}
    </div>
  );
}
