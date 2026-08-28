import type {
  DesktopUpdateState,
  ProfileRegistry,
  RemoteReadyPayload,
  SavedProfile,
} from "../types";

export type BootstrapPhase =
  | "starting"
  | "bootstrapping"
  | "picker"
  | "preparing-profile"
  | "expired-profile"
  | "mandatory-update"
  | "ready"
  | "error";

export type BootstrapState = {
  phase: BootstrapPhase;
  animationFinished: boolean;
  registry?: ProfileRegistry;
  update?: DesktopUpdateState;
  selectedProfile?: SavedProfile;
  preparedProfileId?: string;
  remote?: RemoteReadyPayload;
  error?: string;
};

export type BootstrapEvent =
  | { type: "START" }
  | { type: "ANIMATION_FINISHED" }
  | { type: "PROFILES_LOADED"; registry: ProfileRegistry }
  | { type: "UPDATE_RESOLVED"; update: DesktopUpdateState }
  | { type: "PICKER_REQUIRED" }
  | { type: "PROFILE_PREPARING"; profile?: SavedProfile; profileId?: string }
  | { type: "PROFILE_PREPARED"; profileId: string }
  | { type: "REMOTE_READY"; remote: RemoteReadyPayload }
  | { type: "SWITCH_REQUESTED"; registry: ProfileRegistry }
  | { type: "FAIL"; message: string };

export const initialBootstrapState: BootstrapState = {
  phase: "starting",
  animationFinished: false,
};

function reconcile(state: BootstrapState): BootstrapState {
  if (state.error) return { ...state, phase: "error" };
  if (!state.animationFinished || !state.registry || !state.update) return state;
  if (state.update.kind === "mandatory") return { ...state, phase: "mandatory-update" };
  if (!state.preparedProfileId) {
    return state.phase === "picker" ? state : { ...state, phase: "picker" };
  }
  if (!state.remote || state.remote.profileId !== state.preparedProfileId) {
    return { ...state, phase: "preparing-profile" };
  }
  if (state.remote.state === "needs-auth" && state.selectedProfile) {
    return { ...state, phase: "expired-profile" };
  }
  return { ...state, phase: "ready" };
}

export function bootstrapReducer(
  state: BootstrapState,
  event: BootstrapEvent,
): BootstrapState {
  switch (event.type) {
    case "START":
      return { ...initialBootstrapState, phase: "bootstrapping" };
    case "ANIMATION_FINISHED":
      return reconcile({ ...state, animationFinished: true });
    case "PROFILES_LOADED":
      return reconcile({ ...state, registry: event.registry });
    case "UPDATE_RESOLVED":
      return reconcile({ ...state, update: event.update });
    case "PICKER_REQUIRED":
      return reconcile({ ...state, phase: "picker", selectedProfile: undefined, preparedProfileId: undefined, remote: undefined });
    case "PROFILE_PREPARING":
      return {
        ...state,
        phase: "preparing-profile",
        selectedProfile: event.profile,
        preparedProfileId: event.profileId,
        remote: undefined,
        error: undefined,
      };
    case "PROFILE_PREPARED":
      return reconcile({ ...state, preparedProfileId: event.profileId });
    case "REMOTE_READY":
      return reconcile({ ...state, remote: event.remote });
    case "SWITCH_REQUESTED":
      return {
        ...state,
        phase: "picker",
        registry: event.registry,
        selectedProfile: undefined,
        preparedProfileId: undefined,
        remote: undefined,
      };
    case "FAIL":
      return { ...state, error: event.message, phase: "error" };
  }
}

export function resolveStartupProfile(registry: ProfileRegistry): SavedProfile | undefined {
  if (!registry.lastUsedProfileId) return undefined;
  return registry.profiles.find((profile) => profile.id === registry.lastUsedProfileId);
}
