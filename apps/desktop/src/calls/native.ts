import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { NativeCallActionPayload, NativeCallClosePayload, NativeCallContext } from "./types";

async function closeCurrentWindowFallback() {
  await getCurrentWindow().close();
}

export const nativeCallWindow = {
  getContext: () => invoke<NativeCallContext>("get_native_call_context"),
  ready: () => invoke<void>("native_call_window_ready"),
  sendAction: (input: NativeCallActionPayload) => invoke<void>("send_native_call_action", { input }),
  close: async (input: NativeCallClosePayload = {}) => {
    try {
      await invoke<void>("close_native_call_window", { input });
    } catch {
      await closeCurrentWindowFallback();
    }
  },
  onContextUpdated: (handler: (context: NativeCallContext) => void): Promise<UnlistenFn> =>
    listen<NativeCallContext>("desktop://call-context-updated", (event) => handler(event.payload)),
};

export type NativeCallWindowApi = typeof nativeCallWindow;
