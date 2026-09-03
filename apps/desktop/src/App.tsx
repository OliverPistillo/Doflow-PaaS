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
  const [credentialProfileIds, setCredentialProfileIds] = useState<ReadonlySet<string>>(new Set());
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
    setBusyProfileId(profile.id);
    try {
      const registry = await nativeDesktop.removeProfile(profile.id);
      setCredentialProfileIds((current) => {
        const next = new Set(current);
        next.delete(profile.id);
        return next;
      });
      dispatch({ type: "SWITCH_REQUESTED", registry });
    } catch (error) {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    } finally {
      setBusyProfileId(undefined);
    }
  }, []);

  const forgetPassword = useCallback(async (profile: SavedProfile) => {
    setBusyProfileId(profile.id);
    try {
      await nativeDesktop.forgetSavedPassword(profile.id);
      setCredentialProfileIds((current) => {
        const next = new Set(current);
        next.delete(profile.id);
        return next;
      });
    } catch (error) {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    } finally {
      setBusyProfileId(undefined);
    }
  }, []);

  const requestClose = useCallback(() => {
    void nativeDesktop.requestClose().catch((error) => {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    });
  }, []);

  const reauthenticateProfile = useCallback(async (profile: SavedProfile) => {
    setBusyProfileId(profile.id);
    try {
      await nativeDesktop.activatePreparedProfile();
    } catch (error) {
      dispatch({ type: "FAIL", message: errorMessage(error) });
    } finally {
      setBusyProfileId(undefined);
    }
  }, []);

  const registry: ProfileRegistry = useMemo(
    () => state.registry || { version: 1, profiles: [] },
    [state.registry],
  );
  useEffect(() => {
    let active = true;
    void Promise.all(registry.profiles.map(async (profile) => ({
      id: profile.id,
      saved: await nativeDesktop.hasSavedPassword(profile.id).catch(() => false),
    }))).then((results) => {
      if (!active) return;
      setCredentialProfileIds(new Set(results.filter((result) => result.saved).map((result) => result.id)));
    });
    return () => {
      active = false;
    };
  }, [registry.profiles]);
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
      return (
        <ProfilePicker
          profiles={registry.profiles}
          busyProfileId={busyProfileId}
          selectedProfileId={registry.lastUsedProfileId}
          onSelect={prepareProfile}
          onRemove={removeProfile}
          credentialProfileIds={credentialProfileIds}
          onForgetPassword={forgetPassword}
          onAdd={() => prepareProfile()}
          onClose={requestClose}
        />
      );
    }
    if (state.phase === "expired-profile" && state.selectedProfile) {
      return (
        <ExpiredProfileScreen
          profile={state.selectedProfile}
          profiles={registry.profiles}
          busyProfileId={busyProfileId}
          onReauthenticate={() => void reauthenticateProfile(state.selectedProfile!)}
          onSelect={prepareProfile}
          onAdd={() => prepareProfile()}
          onRemove={removeProfile}
          credentialProfileIds={credentialProfileIds}
          onForgetPassword={forgetPassword}
          onClose={requestClose}
        />
      );
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
  }, [busyProfileId, continueWithoutUpdate, credentialProfileIds, forgetPassword, installing, prepareProfile, reauthenticateProfile, registry.lastUsedProfileId, registry.profiles, removeProfile, requestClose, runUpdateGate, startBootstrap, state.error, state.phase, state.selectedProfile, state.update, updateProgress]);

  const integratedWindowControls = closePromptVisible || state.phase === "picker" || state.phase === "expired-profile";

  return (
    <div className="app-root">
      {!integratedWindowControls ? (
        <div className="window-controls" data-tauri-drag-region>
          <button type="button" aria-label="Riduci a icona" onClick={() => void nativeDesktop.minimize()}>—</button>
          <button type="button" aria-label="Chiudi Doflow" onClick={requestClose}>×</button>
        </div>
      ) : null}
      <div className="app-background" inert={closePromptVisible ? true : undefined}>{background}</div>
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
