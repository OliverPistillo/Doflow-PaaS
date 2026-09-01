import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { callUiReducer, formatCallDuration, initialCallUiState, mediaErrorMessage } from "./call-state";
import { deviceLabel, enumerateCallDevices } from "./device-manager";
import { nativeCallWindow, type NativeCallWindowApi } from "./native";
import type { MediaDeviceGroups, NativeCallContext } from "./types";

const EMPTY_DEVICES: MediaDeviceGroups = { microphones: [], speakers: [], cameras: [] };
const DISCONNECT_GRACE_MS = 750;

export type CallRuntimeFailureCode =
  | "media_credentials_missing"
  | "media_initialization_failed"
  | "media_permission_denied";

interface MediaTargets {
  remoteVideo?: HTMLVideoElement | null;
  selfVideo?: HTMLVideoElement | null;
  audioContainer?: HTMLDivElement | null;
}

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

export async function releaseLiveKitRoom(room: Room | null, targets: MediaTargets = {}) {
  if (!room) return;
  try { room.removeAllListeners(); } catch { /* WebView teardown remains authoritative. */ }
  for (const publication of room.localParticipant.trackPublications.values()) {
    try { publication.track?.stop(); } catch { /* Continue stopping every local track. */ }
    try { publication.track?.detach(); } catch { /* Continue detaching every local track. */ }
  }
  try {
    const disconnect = Promise.resolve(room.disconnect(true)).catch(() => undefined);
    await Promise.race([disconnect, delay(DISCONNECT_GRACE_MS)]);
  } catch {
    // Native WebView destruction is the final privacy boundary if LiveKit cannot disconnect.
  }
  if (targets.remoteVideo) targets.remoteVideo.srcObject = null;
  if (targets.selfVideo) targets.selfVideo.srcObject = null;
  targets.audioContainer?.replaceChildren();
}

export function shouldHandleRoomDisconnect(
  room: Room,
  retiringRooms: WeakSet<Room>,
  connectedAt: number | null,
) {
  return connectedAt !== null && !retiringRooms.has(room);
}

export function LiveKitCallRuntime({
  context,
  api = nativeCallWindow,
  onFatalError,
}: {
  context: NativeCallContext;
  api?: NativeCallWindowApi;
  onFatalError: (code: CallRuntimeFailureCode) => void;
}) {
  const [currentContext, setCurrentContext] = useState(context);
  const [state, dispatch] = useReducer(callUiReducer, initialCallUiState);
  const [devices, setDevices] = useState<MediaDeviceGroups>(EMPTY_DEVICES);
  const [microphoneId, setMicrophoneId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const actionSentRef = useRef(false);
  const mountedRef = useRef(true);
  const connectionGenerationRef = useRef(0);
  const retiringRoomsRef = useRef(new WeakSet<Room>());

  const refreshDevices = useCallback(async () => {
    try {
      const next = await enumerateCallDevices();
      if (!mountedRef.current) return;
      setDevices(next);
      setMicrophoneId((current) => next.microphones.some((device) => device.deviceId === current) ? current : (next.microphones[0]?.deviceId || ""));
      setCameraId((current) => next.cameras.some((device) => device.deviceId === current) ? current : (next.cameras[0]?.deviceId || ""));
      setSpeakerId((current) => next.speakers.some((device) => device.deviceId === current) ? current : (next.speakers[0]?.deviceId || ""));
    } catch {
      if (mountedRef.current) setDevices(EMPTY_DEVICES);
    }
  }, []);

  const releaseRoom = useCallback(async () => {
    connectionGenerationRef.current += 1;
    connectedAtRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) retiringRoomsRef.current.add(room);
    await releaseLiveKitRoom(room, {
      remoteVideo: remoteVideoRef.current,
      selfVideo: selfVideoRef.current,
      audioContainer: audioContainerRef.current,
    });
  }, []);

  const restoreCameraPreview = useCallback((room: Room) => {
    const camera = [...room.localParticipant.trackPublications.values()]
      .find((publication) => publication.source === Track.Source.Camera)?.track;
    if (camera && selfVideoRef.current) {
      camera.detach();
      camera.attach(selfVideoRef.current);
    }
  }, []);

  const finish = useCallback(async (reason = "participant_ended", failed = false) => {
    if (actionSentRef.current) return;
    actionSentRef.current = true;
    setEnding(true);
    dispatch({ type: "ended", message: failed ? "Chiamata interrotta" : "Chiamata terminata" });
    void releaseRoom();
    await api.close({ action: failed ? "failed" : "end", reason });
  }, [api, releaseRoom]);

  const connect = useCallback(async (next: NativeCallContext) => {
    if (!next.credentials) {
      onFatalError("media_credentials_missing");
      return;
    }
    actionSentRef.current = false;
    await releaseRoom();
    if (!mountedRef.current) return;
    const generation = ++connectionGenerationRef.current;
    dispatch({ type: "connect" });

    let room: Room;
    try {
      room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: false });
      roomRef.current = room;

      const attachRemote = (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current);
        } else if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
          const audio = document.createElement("audio");
          audio.autoplay = true;
          audio.setAttribute("data-doflow-call-audio", "true");
          track.attach(audio);
          audioContainerRef.current.append(audio);
        }
        if (mountedRef.current) dispatch({ type: "participant", present: true });
      };
      const detachRemote = (track: RemoteTrack) => {
        track.detach().forEach((element) => element.remove());
      };
      room
        .on(RoomEvent.TrackSubscribed, attachRemote)
        .on(RoomEvent.TrackUnsubscribed, detachRemote)
        .on(RoomEvent.ParticipantConnected, () => { if (mountedRef.current) dispatch({ type: "participant", present: true }); })
        .on(RoomEvent.ParticipantDisconnected, () => { if (mountedRef.current) dispatch({ type: "participant", present: false }); })
        .on(RoomEvent.Reconnecting, () => { if (mountedRef.current) dispatch({ type: "reconnecting" }); })
        .on(RoomEvent.Reconnected, () => { if (mountedRef.current) dispatch({ type: "reconnected" }); })
        .on(RoomEvent.Disconnected, (reason) => {
          // A failed initial connect emits Disconnected before connect() rejects. The catch
          // below owns that path so the visible fail-safe surface is not closed immediately.
          if (!shouldHandleRoomDisconnect(room, retiringRoomsRef.current, connectedAtRef.current)) return;
          if (!actionSentRef.current) void finish(`livekit_disconnected_${String(reason).slice(0, 48)}`, true).catch(() => undefined);
        })
        .on(RoomEvent.MediaDevicesChanged, () => { void refreshDevices().catch(() => undefined); })
        .on(RoomEvent.LocalTrackPublished, (publication) => {
          const track = publication.track;
          if (!track) return;
          if ((track.source === Track.Source.Camera || track.source === Track.Source.ScreenShare) && selfVideoRef.current) {
            track.attach(selfVideoRef.current);
          }
        })
        .on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.source === Track.Source.ScreenShare && mountedRef.current) {
            dispatch({ type: "screen", enabled: false });
            restoreCameraPreview(room);
          }
          publication.track?.detach();
        });

      await room.connect(next.credentials.serverUrl, next.credentials.accessToken, { autoSubscribe: true });
      if (!mountedRef.current || generation !== connectionGenerationRef.current) {
        await releaseLiveKitRoom(room);
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(true, microphoneId ? { deviceId: microphoneId } : undefined);
      if (!mountedRef.current || generation !== connectionGenerationRef.current) return;
      dispatch({ type: "microphone", enabled: true });
      if (next.call.callType === "video") {
        await room.localParticipant.setCameraEnabled(true, cameraId ? { deviceId: cameraId } : undefined);
        if (!mountedRef.current || generation !== connectionGenerationRef.current) return;
        dispatch({ type: "camera", enabled: true });
      }
      connectedAtRef.current = Date.now();
      dispatch({ type: "connected" });
      dispatch({ type: "participant", present: room.remoteParticipants.size > 0 });
      await refreshDevices();
      if (mountedRef.current && generation === connectionGenerationRef.current) {
        await api.sendAction({ action: "ready" });
      }
    } catch (error) {
      const shouldReport = mountedRef.current && generation === connectionGenerationRef.current;
      await releaseRoom();
      if (!shouldReport || !mountedRef.current) return;
      const message = mediaErrorMessage(error);
      if (/permesso|consent/i.test(message)) {
        onFatalError("media_permission_denied");
      } else {
        onFatalError("media_initialization_failed");
      }
    }
  }, [api, cameraId, finish, microphoneId, onFatalError, refreshDevices, releaseRoom, restoreCameraPreview]);

  useEffect(() => {
    mountedRef.current = true;
    setCurrentContext(context);
    void connect(context).catch(() => onFatalError("media_initialization_failed"));
    let unlisten: (() => void) | undefined;
    void api.onContextUpdated((value) => {
      if (!mountedRef.current) return;
      setCurrentContext(value);
      void connect(value).catch(() => onFatalError("media_initialization_failed"));
    }).then((dispose) => { unlisten = dispose; }).catch(() => undefined);
    return () => {
      mountedRef.current = false;
      connectionGenerationRef.current += 1;
      unlisten?.();
      void releaseRoom();
    };
    // The native context owns the call session; credential refreshes arrive on the fixed event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => { void refreshDevices().catch(() => undefined); };
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refreshDevices]);

  useEffect(() => {
    if (state.phase !== "active" && state.phase !== "reconnecting") return;
    const timer = window.setInterval(() => {
      if (connectedAtRef.current) setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  const switchDevice = async (kind: MediaDeviceKind, deviceId: string) => {
    const room = roomRef.current;
    if (!room || !deviceId) return;
    try {
      await room.switchActiveDevice(kind, deviceId, true);
      if (kind === "audioinput") setMicrophoneId(deviceId);
      if (kind === "videoinput") setCameraId(deviceId);
      if (kind === "audiooutput") setSpeakerId(deviceId);
    } catch (error) {
      dispatch({ type: "permission-error", message: mediaErrorMessage(error) });
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const enabled = !state.microphoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(enabled, microphoneId ? { deviceId: microphoneId } : undefined);
      dispatch({ type: "microphone", enabled });
    } catch (error) {
      dispatch({ type: "permission-error", message: mediaErrorMessage(error) });
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room || currentContext.call.callType !== "video") return;
    try {
      const enabled = !state.cameraEnabled;
      await room.localParticipant.setCameraEnabled(enabled, cameraId ? { deviceId: cameraId } : undefined);
      dispatch({ type: "camera", enabled });
    } catch (error) {
      dispatch({ type: "permission-error", message: mediaErrorMessage(error) });
    }
  };

  const toggleScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const enabled = !state.screenShareEnabled;
      await room.localParticipant.setScreenShareEnabled(enabled);
      dispatch({ type: "screen", enabled });
      if (!enabled) restoreCameraPreview(room);
    } catch (error) {
      dispatch({ type: "permission-error", message: mediaErrorMessage(error) });
    }
  };

  const participantTitle = currentContext.call.displayName || "Partecipante Doflow";
  const statusLabel = useMemo(() => {
    if (state.phase === "active" && !state.participantPresent) return currentContext.call.guestMode ? "In attesa dell’ospite…" : "In attesa del partecipante…";
    return state.message;
  }, [currentContext.call.guestMode, state]);

  return (
    <main className="call-window" data-phase={state.phase} data-call-runtime="livekit">
      <header className="call-window-header">
        <div>
          <p className="eyebrow">Doflow Calls · {currentContext.call.callType === "video" ? "Video" : "Audio"}</p>
          <h1>{participantTitle}</h1>
        </div>
        <div className="call-status" role="status" aria-live="polite">
          <span className={`call-status-dot ${state.phase}`} aria-hidden="true" />
          <span>{statusLabel}</span>
          <time>{formatCallDuration(elapsed)}</time>
        </div>
      </header>

      <section className="call-stage" aria-label="Area video chiamata">
        <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline aria-label={`Video di ${participantTitle}`} />
        {!state.participantPresent || currentContext.call.callType === "audio" ? (
          <div className="call-participant-placeholder">
            <span aria-hidden="true">{participantTitle.slice(0, 1).toUpperCase()}</span>
            <strong>{participantTitle}</strong>
            <small>{statusLabel}</small>
          </div>
        ) : null}
        <video ref={selfVideoRef} className={`call-self-video ${state.cameraEnabled || state.screenShareEnabled ? "is-visible" : ""}`} autoPlay muted playsInline aria-label="Anteprima personale" />
        <div ref={audioContainerRef} hidden aria-hidden="true" />
      </section>

      {state.permissionError ? <p className="call-permission-error" role="alert">{state.permissionError}</p> : null}

      <section className="call-device-bar" aria-label="Dispositivi chiamata">
        <label>Microfono
          <select value={microphoneId} onChange={(event) => void switchDevice("audioinput", event.target.value)} disabled={!devices.microphones.length}>
            {devices.microphones.length ? devices.microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device, index, "Microfono")}</option>) : <option>Nessun microfono</option>}
          </select>
        </label>
        <label>Altoparlante
          <select value={speakerId} onChange={(event) => void switchDevice("audiooutput", event.target.value)} disabled={!devices.speakers.length}>
            {devices.speakers.length ? devices.speakers.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device, index, "Altoparlante")}</option>) : <option>Output predefinito</option>}
          </select>
        </label>
        {currentContext.call.callType === "video" ? <label>Webcam
          <select value={cameraId} onChange={(event) => void switchDevice("videoinput", event.target.value)} disabled={!devices.cameras.length}>
            {devices.cameras.length ? devices.cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device, index, "Webcam")}</option>) : <option>Nessuna webcam</option>}
          </select>
        </label> : null}
      </section>

      <footer className="call-controls" aria-label="Controlli chiamata">
        <button type="button" className={state.microphoneEnabled ? "" : "is-off"} onClick={() => void toggleMicrophone()} disabled={!roomRef.current || ending} aria-label={state.microphoneEnabled ? "Disattiva microfono" : "Attiva microfono"} aria-pressed={!state.microphoneEnabled}>
          <span aria-hidden="true">{state.microphoneEnabled ? "◉" : "⊘"}</span>{state.microphoneEnabled ? "Microfono" : "Riattiva"}
        </button>
        {currentContext.call.callType === "video" ? <button type="button" className={state.cameraEnabled ? "" : "is-off"} onClick={() => void toggleCamera()} disabled={!roomRef.current || ending} aria-label={state.cameraEnabled ? "Disattiva videocamera" : "Attiva videocamera"} aria-pressed={!state.cameraEnabled}>
          <span aria-hidden="true">▣</span>{state.cameraEnabled ? "Video" : "Video off"}
        </button> : null}
        <button type="button" className={state.screenShareEnabled ? "is-active" : ""} onClick={() => void toggleScreenShare()} disabled={!roomRef.current || ending} aria-label={state.screenShareEnabled ? "Interrompi condivisione schermo" : "Condividi schermo"} aria-pressed={state.screenShareEnabled}>
          <span aria-hidden="true">▱</span>{state.screenShareEnabled ? "Interrompi" : "Condividi"}
        </button>
        <button type="button" className="call-end-button" onClick={() => void finish()} disabled={ending} aria-label="Termina chiamata">
          <span aria-hidden="true">⌁</span>{ending ? "Chiusura…" : "Termina"}
        </button>
      </footer>
    </main>
  );
}
