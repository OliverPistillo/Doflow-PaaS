// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallWindow } from "./CallWindow";
import { LiveKitCallRuntime, releaseLiveKitRoom, shouldHandleRoomDisconnect } from "./LiveKitCallRuntime";
import type { NativeCallWindowApi } from "./native";
import type { NativeCallContext } from "./types";
import type { Room } from "livekit-client";

const context: NativeCallContext = {
  call: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    callType: "audio",
    direction: "outgoing",
    displayName: "Partecipante QA",
    guestMode: false,
  },
  credentials: {
    serverUrl: "ws://127.0.0.1:9",
    accessToken: "qa-fixture-not-a-jwt-000000000000000000000000000000",
  },
};

function nativeApi(overrides: Partial<NativeCallWindowApi> = {}): NativeCallWindowApi {
  return {
    getContext: vi.fn().mockResolvedValue(context),
    ready: vi.fn().mockResolvedValue(undefined),
    sendAction: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    onContextUpdated: vi.fn().mockResolvedValue(() => undefined),
    ...overrides,
  };
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("fail-safe Desktop call window", () => {
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

  it("renders a synchronous Doflow Calls shell before context or LiveKit resolves", () => {
    const api = nativeApi({ getContext: vi.fn(() => new Promise<NativeCallContext>(() => undefined)) });
    act(() => root.render(<CallWindow api={api} />));
    expect(container.textContent).toContain("Doflow Calls");
    expect(container.textContent).toContain("Preparazione chiamata");
    expect(container.querySelector("[data-call-shell=preparing]")).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
    expect(api.ready).not.toHaveBeenCalled();
  });

  it("loads the dedicated runtime after the safe shell", async () => {
    const Runtime = () => <div data-test-runtime="ready">Runtime pronto</div>;
    const api = nativeApi();
    act(() => root.render(<CallWindow api={api} runtimeLoader={async () => ({ LiveKitCallRuntime: Runtime })} />));
    await flush();
    expect(container.querySelector("[data-test-runtime=ready]")?.textContent).toBe("Runtime pronto");
    expect(api.ready).toHaveBeenCalledTimes(1);
  });

  it("turns a rejected runtime chunk into a visible, closable error exactly once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = nativeApi();
    act(() => root.render(<CallWindow api={api} runtimeLoader={async () => { throw new Error("sensitive loader detail"); }} />));
    await flush();
    expect(container.textContent).toContain("Impossibile avviare la chiamata");
    expect(container.textContent).toContain("desktop_renderer_failed");
    expect(container.textContent).not.toContain("sensitive loader detail");
    const close = container.querySelector<HTMLButtonElement>("button[aria-label='Chiudi chiamata']")!;
    act(() => { close.click(); close.click(); });
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(api.sendAction).toHaveBeenCalledTimes(1);
    expect(api.ready).toHaveBeenCalledTimes(1);
  });

  it("catches a React runtime exception without exposing its stack", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const BrokenRuntime = () => { throw new Error("raw stack and token-like detail"); };
    act(() => root.render(<CallWindow api={nativeApi()} runtimeLoader={async () => ({ LiveKitCallRuntime: BrokenRuntime })} />));
    await flush();
    expect(container.textContent).toContain("Impossibile avviare la chiamata");
    expect(container.textContent).not.toContain("raw stack");
    expect(container.querySelector("[data-call-shell=failed]")).not.toBeNull();
  });

  it("keeps context and missing-credential failures visible and closable", async () => {
    const missingContextApi = nativeApi({ getContext: vi.fn().mockRejectedValue(new Error("native detail")) });
    act(() => root.render(<CallWindow api={missingContextApi} />));
    await flush();
    expect(container.textContent).toContain("call_context_unavailable");

    act(() => root.unmount());
    root = createRoot(container);
    const noCredentials = { ...context, credentials: undefined };
    act(() => root.render(
      <CallWindow
        api={nativeApi({ getContext: vi.fn().mockResolvedValue(noCredentials) })}
        runtimeLoader={async () => ({ LiveKitCallRuntime })}
      />,
    ));
    await flush();
    expect(container.textContent).toContain("media_credentials_missing");
  });

  it("reports renderer readiness once under StrictMode", async () => {
    const Runtime = () => <div>Runtime pronto</div>;
    const api = nativeApi();
    act(() => root.render(
      <StrictMode>
        <CallWindow api={api} runtimeLoader={async () => ({ LiveKitCallRuntime: Runtime })} />
      </StrictMode>,
    ));
    await flush();
    expect(api.ready).toHaveBeenCalledTimes(1);
  });

  it("stops every local track and bounds a stuck LiveKit disconnect", async () => {
    vi.useFakeTimers();
    const tracks = [1, 2].map(() => ({ stop: vi.fn(), detach: vi.fn() }));
    const room = {
      removeAllListeners: vi.fn(),
      localParticipant: { trackPublications: new Map(tracks.map((track, index) => [String(index), { track }])) },
      disconnect: vi.fn(() => new Promise<void>(() => undefined)),
    } as unknown as Room;
    const release = releaseLiveKitRoom(room);
    await vi.advanceTimersByTimeAsync(800);
    await release;
    expect(tracks.every((track) => track.stop.mock.calls.length === 1 && track.detach.mock.calls.length === 1)).toBe(true);
    expect(room.removeAllListeners).toHaveBeenCalledOnce();
    expect(room.disconnect).toHaveBeenCalledOnce();
  });

  it("keeps initial-connect and intentional disconnects on the visible error path", () => {
    const room = {} as Room;
    const retiring = new WeakSet<Room>();
    expect(shouldHandleRoomDisconnect(room, retiring, null)).toBe(false);
    expect(shouldHandleRoomDisconnect(room, retiring, Date.now())).toBe(true);
    retiring.add(room);
    expect(shouldHandleRoomDisconnect(room, retiring, Date.now())).toBe(false);
  });
});
