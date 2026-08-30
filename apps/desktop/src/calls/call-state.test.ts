import { describe, expect, it } from "vitest";
import { callUiReducer, formatCallDuration, initialCallUiState, mediaErrorMessage } from "./call-state";

describe("Desktop call UI state", () => {
  it("keeps reconnect and terminal media state deterministic", () => {
    let state = callUiReducer(initialCallUiState, { type: "connect" });
    state = callUiReducer(state, { type: "connected" });
    state = callUiReducer(state, { type: "microphone", enabled: true });
    state = callUiReducer(state, { type: "camera", enabled: true });
    state = callUiReducer(state, { type: "reconnecting" });
    expect(state.phase).toBe("reconnecting");
    state = callUiReducer(state, { type: "reconnected" });
    expect(state.phase).toBe("active");
    state = callUiReducer(state, { type: "ended" });
    expect(state).toMatchObject({ phase: "ended", microphoneEnabled: false, cameraEnabled: false, screenShareEnabled: false });
  });

  it("formats timers and maps privacy-sensitive device failures to safe copy", () => {
    expect(formatCallDuration(65)).toBe("01:05");
    expect(formatCallDuration(3661)).toBe("01:01:01");
    expect(mediaErrorMessage(new DOMException("raw driver detail", "NotAllowedError"))).not.toContain("raw driver detail");
    expect(mediaErrorMessage(new DOMException("", "NotFoundError"))).toContain("Nessun dispositivo");
  });
});
