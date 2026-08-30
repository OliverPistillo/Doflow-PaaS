import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { NativeCallActionPayload, NativeCallContext } from "./types";

export const nativeCallWindow = {
  getContext: () => invoke<NativeCallContext>("get_native_call_context"),
  sendAction: (input: NativeCallActionPayload) => invoke<void>("send_native_call_action", { input }),
  onContextUpdated: (handler: (context: NativeCallContext) => void): Promise<UnlistenFn> =>
    listen<NativeCallContext>("desktop://call-context-updated", (event) => handler(event.payload)),
};
