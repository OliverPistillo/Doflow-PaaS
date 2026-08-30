import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  LocalTrack,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { callUiReducer, formatCallDuration, initialCallUiState, mediaErrorMessage } from "./call-state";
import { deviceLabel, enumerateCallDevices } from "./device-manager";
import { nativeCallWindow } from "./native";
import type { MediaDeviceGroups, NativeCallContext } from "./types";

const EMPTY_DEVICES: MediaDeviceGroups = { microphones: [], speakers: [], cameras: [] };

export function CallWindow() {
  const [context, setContext] = useState<NativeCallContext | null>(null);
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
  const phaseRef = useRef(state.phase);

  useEffect(() => { phaseRef.current = state.phase; }, [state.phase]);

  const refreshDevices = useCallback(async () => {
    try {
      const next = await enumerateCallDevices();
      setDevices(next);
      setMicrophoneId((current) => next.microphones.some((device) => device.deviceId === current) ? current : (next.microphones[0]?.deviceId || ""));
      setCameraId((current) => next.cameras.some((device) => device.deviceId === current) ? current : (next.cameras[0]?.deviceId || ""));
      setSpeakerId((current) => next.speakers.some((device) => device.deviceId === current) ? current : (next.speakers[0]?.deviceId || ""));
    } catch {
      setDevices(EMPTY_DEVICES);
    }
  }, []);

  const releaseRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (!room) return;
    for (const publication of room.localParticipant.trackPublications.values()) {
      publication.track?.stop();
      publication.track?.detach();
    }
    room.disconnect(true);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (selfVideoRef.current) selfVideoRef.current.srcObject = null;
    audioContainerRef.current?.replaceChildren();
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
    await releaseRoom();
    try {
      await nativeCallWindow.sendAction({ action: failed ? "failed" : "end", reason });
    } catch {
      setEnding(false);
      dispatch({ type: "error", message: "La sessione media è chiusa; riapri Doflow per verificare lo stato." });
    }
  }, [releaseRoom]);

  const connect = useCallback(async (next: NativeCallContext) => {
    if (!next.credentials) {
      dispatch({ type: "error", message: "Credenziali chiamata non disponibili." });
      return;
    }
    actionSentRef.current = false;
    await releaseRoom();
    dispatch({ type: "connect" });
    const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: false });
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
      dispatch({ type: "participant", present: true });
    };
    const detachRemote = (track: RemoteTrack) => {
      track.detach().forEach((element) => element.remove());
    };
    room
      .on(RoomEvent.TrackSubscribed, attachRemote)
      .on(RoomEvent.TrackUnsubscribed, detachRemote)
      .on(RoomEvent.ParticipantConnected, () => dispatch({ type: "participant", present: true }))
      .on(RoomEvent.ParticipantDisconnected, () => dispatch({ type: "participant", present: false }))
      .on(RoomEvent.Reconnecting, () => dispatch({ type: "reconnecting" }))
      .on(RoomEvent.Reconnected, () => dispatch({ type: "reconnected" }))
      .on(RoomEvent.Disconnected, (reason) => {
        if (!actionSentRef.current) void finish(`livekit_disconnected_${String(reason).slice(0, 60)}`, true);
      })
      .on(RoomEvent.MediaDevicesChanged, () => void refreshDevices())
      .on(RoomEvent.LocalTrackPublished, (publication) => {
        const track = publication.track;
        if (!track) return;
        if ((track.source === Track.Source.Camera || track.source === Track.Source.ScreenShare) && selfVideoRef.current) {
          track.attach(selfVideoRef.current);
        }
      })
      .on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          dispatch({ type: "screen", enabled: false });
          restoreCameraPreview(room);
        }
        publication.track?.detach();
      });

    try {
      await room.connect(next.credentials.serverUrl, next.credentials.accessToken, { autoSubscribe: true });
      await room.localParticipant.setMicrophoneEnabled(true, microphoneId ? { deviceId: microphoneId } : undefined);
      dispatch({ type: "microphone", enabled: true });
      if (next.call.callType === "video") {
        await room.localParticipant.setCameraEnabled(true, cameraId ? { deviceId: cameraId } : undefined);
        dispatch({ type: "camera", enabled: true });
      }
      connectedAtRef.current = Date.now();
      dispatch({ type: "connected" });
      dispatch({ type: "participant", present: room.remoteParticipants.size > 0 });
      await refreshDevices();
      await nativeCallWindow.sendAction({ action: "ready" });
    } catch (error) {
      const message = mediaErrorMessage(error);
      dispatch({ type: "permission-error", message });
      await releaseRoom();
      try { await nativeCallWindow.sendAction({ action: "failed", reason: "media_start_failed" }); } catch { /* backend remains authoritative */ }
    }
  }, [cameraId, finish, microphoneId, refreshDevices, releaseRoom, restoreCameraPreview]);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;
    void nativeCallWindow.getContext().then((value) => {
      if (!mounted) return;
      setContext(value);
      if (!roomRef.current || phaseRef.current === "error" || phaseRef.current === "reconnecting") void connect(value);
    }).catch(() => {
      if (mounted) dispatch({ type: "error", message: "La chiamata non è più disponibile." });
    });
    void nativeCallWindow.onContextUpdated((value) => {
      if (!mounted) return;
      setContext(value);
      if (!roomRef.current || phaseRef.current === "error" || phaseRef.current === "ended") {
        void connect(value);
      }
    }).then((dispose) => { unlisten = dispose; });
    return () => {
      mounted = false;
      unlisten?.();
      void releaseRoom();
    };
    // The initial connection owns its cleanup; credential refresh is delivered by the native event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => void refreshDevices();
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
    if (!room || context?.call.callType !== "video") return;
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

  const participantTitle = context?.call.displayName || "Partecipante Doflow";
  const statusLabel = useMemo(() => {
    if (state.phase === "active" && !state.participantPresent) return context?.call.guestMode ? "In attesa dell’ospite…" : "In attesa del partecipante…";
    return state.message;
  }, [context, state]);

  return (
    <main className="call-window" data-phase={state.phase}>
      <header className="call-window-header">
        <div>
          <p className="eyebrow">Doflow Calls · {context?.call.callType === "video" ? "Video" : "Audio"}</p>
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
        {!state.participantPresent || context?.call.callType === "audio" ? (
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
        {context?.call.callType === "video" ? <label>Webcam
          <select value={cameraId} onChange={(event) => void switchDevice("videoinput", event.target.value)} disabled={!devices.cameras.length}>
            {devices.cameras.length ? devices.cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device, index, "Webcam")}</option>) : <option>Nessuna webcam</option>}
          </select>
        </label> : null}
      </section>

      <footer className="call-controls" aria-label="Controlli chiamata">
        <button type="button" className={state.microphoneEnabled ? "" : "is-off"} onClick={() => void toggleMicrophone()} disabled={!roomRef.current || ending} aria-label={state.microphoneEnabled ? "Disattiva microfono" : "Attiva microfono"} aria-pressed={!state.microphoneEnabled}>
          <span aria-hidden="true">{state.microphoneEnabled ? "◉" : "⊘"}</span>{state.microphoneEnabled ? "Microfono" : "Riattiva"}
        </button>
        {context?.call.callType === "video" ? <button type="button" className={state.cameraEnabled ? "" : "is-off"} onClick={() => void toggleCamera()} disabled={!roomRef.current || ending} aria-label={state.cameraEnabled ? "Disattiva videocamera" : "Attiva videocamera"} aria-pressed={!state.cameraEnabled}>
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
