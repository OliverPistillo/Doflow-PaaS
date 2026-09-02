// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IncomingCallWindow } from "./IncomingCallWindow";
import type { NativeCallWindowApi } from "./native";
import type { NativeCallContext } from "./types";

const incomingContext: NativeCallContext = {
  call: {
    sessionId: "22222222-2222-4222-8222-222222222222",
    callType: "video",
    direction: "incoming",
    displayName: "Partecipante QA",
    guestMode: false,
    expiresAt: new Date(Date.now() + 45_000).toISOString(),
  },
};

function nativeApi(overrides: Partial<NativeCallWindowApi> = {}): NativeCallWindowApi {
  return {
    getContext: vi.fn().mockResolvedValue(incomingContext),
    ready: vi.fn().mockResolvedValue(undefined),
    sendAction: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    onContextUpdated: vi.fn().mockResolvedValue(() => undefined),
    ...overrides,
  };
}

const flush = async () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("incoming Desktop call window", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("accepts exactly once and delegates local close to the native fail-safe", async () => {
    const api = nativeApi();
    act(() => root.render(<IncomingCallWindow api={api} />));
    await flush();
    expect(api.ready).toHaveBeenCalledTimes(1);
    const accept = container.querySelector<HTMLButtonElement>("button[aria-label='Rispondi alla chiamata']")!;
    act(() => { accept.click(); accept.click(); });
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(api.close).toHaveBeenCalledWith({ action: "accept" });
  });

  it("keeps missing context readable and closable", async () => {
    const api = nativeApi({ getContext: vi.fn().mockRejectedValue(new Error("native detail")) });
    act(() => root.render(<IncomingCallWindow api={api} />));
    await flush();
    expect(api.ready).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Questa chiamata non è più disponibile.");
    const close = container.querySelector<HTMLButtonElement>("button[aria-label='Chiudi chiamata']")!;
    act(() => close.click());
    expect(api.close).toHaveBeenCalledOnce();
  });

  it("closes an expired ringing window without inventing a reject", async () => {
    vi.useFakeTimers();
    const api = nativeApi({
      getContext: vi.fn().mockResolvedValue({
        ...incomingContext,
        call: { ...incomingContext.call, expiresAt: new Date(Date.now() - 1_000).toISOString() },
      }),
    });
    act(() => root.render(<IncomingCallWindow api={api} />));
    await flush();
    await vi.advanceTimersByTimeAsync(1_100);
    expect(api.close).toHaveBeenCalledWith();
    expect(api.sendAction).not.toHaveBeenCalled();
  });

  it("reports renderer readiness once under StrictMode", async () => {
    const api = nativeApi();
    act(() => root.render(<StrictMode><IncomingCallWindow api={api} /></StrictMode>));
    await flush();
    expect(api.ready).toHaveBeenCalledTimes(1);
  });
});
