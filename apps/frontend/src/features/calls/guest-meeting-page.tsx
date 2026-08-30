"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, LoaderCircle, Mic, MicOff, MonitorUp, PhoneOff, ShieldCheck } from "lucide-react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publicDoflowCallsApi, type GuestCallAccess, type GuestPreview } from "./doflow-calls-api";

type GuestPhase = "resolving" | "prejoin" | "joining" | "active" | "reconnecting" | "ended" | "error";
type DeviceLists = { audio: MediaDeviceInfo[]; video: MediaDeviceInfo[]; output: MediaDeviceInfo[] };
const EMPTY_DEVICES: DeviceLists = { audio: [], video: [], output: [] };

function safeInviteFromFragment() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("invite")?.trim() || "";
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return /^[A-Za-z0-9_-]{40,96}$/.test(token) ? token : null;
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/usato/i.test(message)) return "Questo invito è già stato utilizzato.";
  if (/scaduto|revocato|non valido/i.test(message)) return "Il link è scaduto, è stato revocato oppure non è valido.";
  return "La riunione non è disponibile. Chiedi all’organizzatore un nuovo link.";
}

function label(device: MediaDeviceInfo, index: number, fallback: string) {
  return device.label.trim().slice(0, 100) || `${fallback} ${index + 1}`;
}

export function GuestMeetingPage() {
  const [phase, setPhase] = useState<GuestPhase>("resolving");
  const [preview, setPreview] = useState<GuestPreview | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceLists>(EMPTY_DEVICES);
  const [audioDevice, setAudioDevice] = useState("default");
  const [videoDevice, setVideoDevice] = useState("default");
  const [outputDevice, setOutputDevice] = useState("default");
  const [microphone, setMicrophone] = useState(true);
  const [microphoneCheck, setMicrophoneCheck] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [camera, setCamera] = useState(false);
  const [screenShare, setScreenShare] = useState(false);
  const [participantPresent, setParticipantPresent] = useState(false);
  const startedRef = useRef(false);
  const inviteRef = useRef<string | null>(null);
  const accessRef = useRef<GuestCallAccess | null>(null);
  const roomRef = useRef<Room | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const microphoneTestStreamRef = useRef<MediaStream | null>(null);
  const audioRootRef = useRef<HTMLDivElement | null>(null);
  const renewalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRenewalRef = useRef<(access: GuestCallAccess) => void>(() => undefined);

  const enumerate = useCallback(async () => {
    try {
      const values = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audio: values.filter((device) => device.kind === "audioinput"),
        video: values.filter((device) => device.kind === "videoinput"),
        output: values.filter((device) => device.kind === "audiooutput"),
      });
    } catch {
      setDevices(EMPTY_DEVICES);
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const token = safeInviteFromFragment();
    inviteRef.current = token;
    if (!token) {
      queueMicrotask(() => {
        setPhase("error");
        setError("Link riunione mancante o non valido.");
      });
      return;
    }
    void publicDoflowCallsApi.preview(token).then((value) => {
      setPreview(value);
      setCamera(value.callType === "video");
      setPhase("prejoin");
      void enumerate();
    }).catch((cause) => {
      setPhase("error");
      setError(friendlyError(cause));
    });
  }, [enumerate]);

  useEffect(() => {
    if (phase !== "prejoin" || !camera) {
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
      return;
    }
    let cancelled = false;
    void navigator.mediaDevices.getUserMedia({
      video: videoDevice === "default" ? true : { deviceId: { exact: videoDevice } },
      audio: false,
    }).then((stream) => {
      if (cancelled) return stream.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = stream;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
      void enumerate();
    }).catch(() => {
      setCamera(false);
      setError("Videocamera non disponibile o permesso negato. Puoi partecipare senza video.");
    });
    return () => {
      cancelled = true;
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
    };
  }, [camera, enumerate, phase, videoDevice]);

  const stopRoom = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      for (const publication of room.localParticipant.trackPublications.values()) {
        publication.track?.stop();
        publication.track?.detach();
      }
      room.disconnect(true);
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    audioRootRef.current?.replaceChildren();
  }, []);

  const restoreCameraPreview = useCallback((room: Room) => {
    const cameraTrack = [...room.localParticipant.trackPublications.values()]
      .find((publication) => publication.source === Track.Source.Camera)?.track;
    if (cameraTrack && localVideoRef.current) {
      cameraTrack.detach();
      cameraTrack.attach(localVideoRef.current);
    }
  }, []);

  const scheduleRenewal = useCallback((access: GuestCallAccess) => {
    if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current);
    renewalTimerRef.current = setTimeout(() => {
      const current = accessRef.current;
      if (!current?.guestSession) return;
      void publicDoflowCallsApi.renew(current.inviteId, current.guestSession).then((renewed) => {
        const next = { ...current, ...renewed };
        accessRef.current = next;
        scheduleRenewalRef.current(next);
      }).catch(() => undefined);
    }, Math.max(30_000, (access.expiresInSeconds - 60) * 1000));
  }, []);

  useEffect(() => {
    scheduleRenewalRef.current = scheduleRenewal;
  }, [scheduleRenewal]);

  const connect = useCallback(async (access: GuestCallAccess) => {
    stopRoom();
    const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
    roomRef.current = room;
    const attach = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) track.attach(remoteVideoRef.current);
      if (track.kind === Track.Kind.Audio && audioRootRef.current) {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        track.attach(audio);
        audioRootRef.current.append(audio);
      }
      setParticipantPresent(true);
    };
    room
      .on(RoomEvent.TrackSubscribed, attach)
      .on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()))
      .on(RoomEvent.ParticipantConnected, () => setParticipantPresent(true))
      .on(RoomEvent.ParticipantDisconnected, () => setParticipantPresent(room.remoteParticipants.size > 0))
      .on(RoomEvent.Reconnecting, () => setPhase("reconnecting"))
      .on(RoomEvent.Reconnected, () => setPhase("active"))
      .on(RoomEvent.MediaDevicesChanged, () => void enumerate())
      .on(RoomEvent.LocalTrackPublished, (publication) => {
        const track = publication.track;
        if (track && (track.source === Track.Source.Camera || track.source === Track.Source.ScreenShare) && localVideoRef.current) track.attach(localVideoRef.current);
      })
      .on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          setScreenShare(false);
          restoreCameraPreview(room);
        }
        publication.track?.detach();
      })
      .on(RoomEvent.Disconnected, () => {
        if (phase === "ended") return;
        setPhase("ended");
        setError("La connessione alla riunione è terminata.");
      });
    await room.connect(access.serverUrl, access.token, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(microphone, audioDevice === "default" ? undefined : { deviceId: audioDevice });
    if (preview?.callType === "video" && camera) {
      await room.localParticipant.setCameraEnabled(true, videoDevice === "default" ? undefined : { deviceId: videoDevice });
    }
    if (outputDevice !== "default") await room.switchActiveDevice("audiooutput", outputDevice, true).catch(() => undefined);
    setParticipantPresent(room.remoteParticipants.size > 0);
    setPhase("active");
    await enumerate();
  }, [audioDevice, camera, enumerate, microphone, outputDevice, phase, preview?.callType, restoreCameraPreview, stopRoom, videoDevice]);

  const join = async () => {
    const name = displayName.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 80) {
      setError("Inserisci un nome tra 2 e 80 caratteri.");
      return;
    }
    if (!inviteRef.current) return;
    setError(null);
    setPhase("joining");
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    try {
      const access = await publicDoflowCallsApi.join(inviteRef.current, name);
      inviteRef.current = null;
      accessRef.current = access;
      scheduleRenewal(access);
      await connect(access);
    } catch (cause) {
      setPhase("error");
      setError(friendlyError(cause));
    }
  };

  const testMicrophone = async () => {
    if (microphoneCheck === "checking") return;
    setMicrophoneCheck("checking");
    setError(null);
    microphoneTestStreamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioDevice === "default" ? true : { deviceId: { exact: audioDevice } },
        video: false,
      });
      microphoneTestStreamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live") throw new Error("microphone unavailable");
      setMicrophoneCheck("ok");
      await enumerate();
    } catch {
      setMicrophoneCheck("error");
      setError("Microfono non disponibile o permesso negato. Seleziona un altro dispositivo o controlla le impostazioni del browser.");
    } finally {
      microphoneTestStreamRef.current?.getTracks().forEach((track) => track.stop());
      microphoneTestStreamRef.current = null;
    }
  };

  useEffect(() => () => {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneTestStreamRef.current?.getTracks().forEach((track) => track.stop());
    stopRoom();
    if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current);
    accessRef.current = null;
    inviteRef.current = null;
  }, [stopRoom]);

  const toggleMic = async () => {
    const next = !microphone;
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(next, audioDevice === "default" ? undefined : { deviceId: audioDevice });
      setMicrophone(next);
    } catch { setError("Microfono non disponibile o permesso negato."); }
  };
  const toggleCamera = async () => {
    const next = !camera;
    try {
      await roomRef.current?.localParticipant.setCameraEnabled(next, videoDevice === "default" ? undefined : { deviceId: videoDevice });
      setCamera(next);
    } catch { setError("Videocamera non disponibile o permesso negato."); }
  };
  const toggleScreen = async () => {
    const next = !screenShare;
    try {
      await roomRef.current?.localParticipant.setScreenShareEnabled(next);
      setScreenShare(next);
      if (!next && roomRef.current) restoreCameraPreview(roomRef.current);
    } catch { setError("Condivisione schermo non disponibile."); }
  };
  const leave = () => {
    setPhase("ended");
    stopRoom();
    accessRef.current = null;
    if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current);
  };

  return (
    <main className="min-h-dvh bg-[#070911] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div><p className="text-sm font-bold tracking-[0.12em] text-indigo-300">DOFLOW CALLS</p><p className="mt-1 text-xs text-slate-400">Riunione protetta · nessun account richiesto</p></div>
          <ShieldCheck className="size-6 text-emerald-400" aria-label="Connessione protetta" />
        </header>

        {phase === "resolving" ? <section className="grid min-h-[55vh] place-items-center"><p className="flex items-center gap-2 text-sm text-slate-300"><LoaderCircle className="animate-spin" />Verifica dell’invito…</p></section> : null}
        {phase === "error" ? <section className="mx-auto mt-20 max-w-lg rounded-2xl border border-rose-400/20 bg-white/5 p-7 text-center"><h1 className="text-2xl font-semibold">Riunione non disponibile</h1><p className="mt-3 text-sm leading-6 text-slate-300" role="alert">{error}</p></section> : null}
        {phase === "ended" ? <section className="mx-auto mt-20 max-w-lg rounded-2xl border border-white/10 bg-white/5 p-7 text-center"><h1 className="text-2xl font-semibold">Riunione terminata</h1><p className="mt-3 text-sm text-slate-300">Puoi chiudere questa pagina.</p></section> : null}

        {phase === "prejoin" || phase === "joining" ? (
          <section className="mx-auto grid max-w-3xl gap-5 rounded-3xl border border-white/10 bg-[#111522] p-5 shadow-2xl sm:p-7">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Invito di {preview?.hostName}</p><h1 className="mt-2 text-2xl font-semibold">{preview?.callType === "video" ? "Video riunione" : "Audio riunione"}</h1><p className="mt-1 text-sm text-slate-400">Controlla nome e dispositivi prima di entrare.</p></div>
            {preview?.callType === "video" ? <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/30"><video ref={previewVideoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${camera ? "block" : "hidden"}`} />{!camera ? <div className="grid h-full place-items-center text-sm text-slate-400"><CameraOff className="mb-2 size-8" />Videocamera disattivata</div> : null}</div> : null}
            <Label className="grid gap-2">Il tuo nome<Input value={displayName} maxLength={80} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} className="border-white/15 bg-white/5" /></Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <DeviceSelect label="Microfono" value={audioDevice} devices={devices.audio} fallback="Microfono" onChange={setAudioDevice} />
              {preview?.callType === "video" ? <DeviceSelect label="Webcam" value={videoDevice} devices={devices.video} fallback="Webcam" onChange={setVideoDevice} /> : null}
              <DeviceSelect label="Altoparlante" value={outputDevice} devices={devices.output} fallback="Output" onChange={setOutputDevice} />
            </div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setMicrophone((value) => !value)}>{microphone ? <Mic /> : <MicOff />}{microphone ? "Microfono attivo" : "Microfono spento"}</Button><Button variant="outline" disabled={microphoneCheck === "checking"} onClick={() => void testMicrophone()}><Mic />{microphoneCheck === "checking" ? "Verifica…" : "Prova microfono"}</Button>{preview?.callType === "video" ? <Button variant="outline" onClick={() => setCamera((value) => !value)}>{camera ? <Camera /> : <CameraOff />}{camera ? "Video attivo" : "Video spento"}</Button> : null}</div>
            {microphoneCheck === "ok" ? <p className="text-sm text-emerald-300" role="status">Microfono disponibile. La prova è terminata e la cattura è stata arrestata.</p> : null}
            {error ? <p className="rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200" role="alert">{error}</p> : null}
            <Button size="lg" disabled={phase === "joining" || microphoneCheck === "checking"} onClick={() => void join()}>{phase === "joining" ? <><LoaderCircle className="animate-spin" />Connessione…</> : "Entra nella riunione"}</Button>
          </section>
        ) : null}

        {phase === "active" || phase === "reconnecting" ? (
          <section className="grid gap-4">
            <div className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Riunione con {preview?.hostName}</h1><p className="text-sm text-slate-400" role="status">{phase === "reconnecting" ? "Riconnessione in corso…" : participantPresent ? "Organizzatore connesso" : "In attesa dell’organizzatore…"}</p></div></div>
            <div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[#111522]"><video ref={remoteVideoRef} autoPlay playsInline className="h-full min-h-[360px] w-full object-cover" />{!participantPresent ? <div className="absolute inset-0 grid place-items-center text-center text-slate-300"><div><span className="mx-auto grid size-24 place-items-center rounded-3xl bg-indigo-500/20 text-4xl">{preview?.hostName.slice(0, 1).toUpperCase()}</span><p className="mt-4">In attesa dell’organizzatore…</p></div></div> : null}<video ref={localVideoRef} autoPlay muted playsInline className={`absolute bottom-4 right-4 aspect-video w-44 rounded-xl border border-white/20 object-cover shadow-2xl ${camera || screenShare ? "block" : "hidden"}`} /><div ref={audioRootRef} hidden /></div>
            {error ? <p className="rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200" role="alert">{error}</p> : null}
            <div className="flex flex-wrap justify-center gap-2"><Button variant={microphone ? "secondary" : "outline"} onClick={() => void toggleMic()}>{microphone ? <Mic /> : <MicOff />}{microphone ? "Microfono" : "Riattiva"}</Button>{preview?.callType === "video" ? <Button variant={camera ? "secondary" : "outline"} onClick={() => void toggleCamera()}>{camera ? <Camera /> : <CameraOff />}{camera ? "Video" : "Video off"}</Button> : null}<Button variant={screenShare ? "secondary" : "outline"} onClick={() => void toggleScreen()}><MonitorUp />{screenShare ? "Interrompi" : "Condividi"}</Button><Button variant="destructive" onClick={leave}><PhoneOff />Esci</Button></div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function DeviceSelect({ label: fieldLabel, value, devices, fallback, onChange }: { label: string; value: string; devices: MediaDeviceInfo[]; fallback: string; onChange: (value: string) => void }) {
  return <Label className="grid min-w-0 gap-2">{fieldLabel}<Select value={value} onValueChange={onChange}><SelectTrigger className="w-full border-white/15 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Predefinito</SelectItem>{devices.filter((device) => !["default", "communications"].includes(device.deviceId)).map((device, index) => <SelectItem key={device.deviceId} value={device.deviceId}>{label(device, index, fallback)}</SelectItem>)}</SelectContent></Select></Label>;
}
