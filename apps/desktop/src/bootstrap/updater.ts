import type { DesktopNativeApi } from "../bridge/native";
import type { DesktopUpdateState } from "../types";

type StartupUpdateApi = Pick<
  DesktopNativeApi,
  "checkForUpdates" | "getUpdateState" | "installUpdate"
>;

export type StartupUpdateGateResult =
  | { status: "continue"; update: DesktopUpdateState }
  | { status: "blocked"; update: DesktopUpdateState; error?: string }
  | { status: "restart-pending"; update: DesktopUpdateState };

export type StartupUpdateCallbacks = {
  formatError: (error: unknown) => string;
  onUpdateResolved: (update: DesktopUpdateState) => void;
  onInstallStarted: () => void;
  onInstallFailed: (message: string) => void;
};

function unavailableState(
  previous: DesktopUpdateState | undefined,
  message: string,
): DesktopUpdateState {
  return {
    kind: "unavailable",
    currentVersion: previous?.currentVersion || "unknown",
    latestVersion: previous?.latestVersion,
    minimumSupportedVersion: previous?.minimumSupportedVersion,
    message,
    policySource: previous?.policySource || "none",
    updateAvailable: false,
    canContinueWithoutUpdate: previous?.canContinueWithoutUpdate === true,
  };
}

async function executeStartupUpdateGate(
  api: StartupUpdateApi,
  callbacks: StartupUpdateCallbacks,
): Promise<StartupUpdateGateResult> {
  let update: DesktopUpdateState;
  try {
    update = await api.checkForUpdates();
  } catch (error) {
    let previous: DesktopUpdateState | undefined;
    try {
      previous = await api.getUpdateState();
    } catch {
      previous = undefined;
    }
    update = unavailableState(previous, callbacks.formatError(error));
  }

  callbacks.onUpdateResolved(update);
  const shouldInstall = update.updateAvailable
    && (update.kind === "optional" || update.kind === "mandatory");

  if (shouldInstall) {
    callbacks.onInstallStarted();
    try {
      await api.installUpdate();
      return { status: "restart-pending", update };
    } catch (error) {
      const message = callbacks.formatError(error);
      callbacks.onInstallFailed(message);
      return { status: "blocked", update, error: message };
    }
  }

  if (update.kind === "none") {
    return { status: "continue", update };
  }
  return { status: "blocked", update };
}

export function createStartupUpdateRunner(api: StartupUpdateApi) {
  let inFlight: Promise<StartupUpdateGateResult> | undefined;

  return {
    run(callbacks: StartupUpdateCallbacks) {
      if (inFlight) return inFlight;
      inFlight = executeStartupUpdateGate(api, callbacks).finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
  };
}
