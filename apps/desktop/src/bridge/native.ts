import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DesktopUpdateState,
  PreparedProfile,
  ProfileRegistry,
  RemoteReadyPayload,
  UpdateProgressPayload,
} from "../types";

export const nativeDesktop = {
  loadProfiles: () => invoke<ProfileRegistry>("load_profile_registry"),
  checkForUpdates: () => invoke<DesktopUpdateState>("check_for_updates"),
  getUpdateState: () => invoke<DesktopUpdateState>("get_bootstrap_update_state"),
  prepareProfile: (profileId?: string) =>
    invoke<PreparedProfile>("prepare_profile_webview", { profileId: profileId ?? null }),
  activatePreparedProfile: () => invoke<void>("activate_prepared_profile"),
  removeProfile: (profileId: string) =>
    invoke<ProfileRegistry>("remove_saved_profile", { profileId }),
  installUpdate: () => invoke<void>("install_current_verified_update"),
  quit: () => invoke<void>("quit_desktop"),
  minimize: () => invoke<void>("minimize_bootstrap"),
  onRemoteReady: (handler: (payload: RemoteReadyPayload) => void) =>
    listen<RemoteReadyPayload>("desktop://remote-ready", (event) => handler(event.payload)),
  onProfileSwitchRequested: (handler: () => void) =>
    listen("desktop://profile-switch-requested", handler),
  onUpdateProgress: (handler: (payload: UpdateProgressPayload) => void) =>
    listen<UpdateProgressPayload>("desktop://update-progress", (event) => handler(event.payload)),
  onBootstrapError: (handler: (message: string) => void) =>
    listen<string>("desktop://bootstrap-error", (event) => handler(event.payload)),
};

export type DesktopNativeApi = typeof nativeDesktop;
export type DesktopUnlisten = UnlistenFn;
