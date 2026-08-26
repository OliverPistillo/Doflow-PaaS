"use client";

import * as React from "react";
import {
  Camera,
  CameraOff,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  RefreshCw,
  UsersRound,
  Video,
} from "lucide-react";
import {
  Room,
  RoomEvent,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  collaborationApi,
  type CollaborationCallAccess,
  type CollaborationCallStatus,
} from "@/lib/tenant-feature-api";

type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "ended" | "failed";

function connectionLabel(state: ConnectionState) {
  if (state === "connecting") return "Connessione";
  if (state === "connected") return "Connessa";
  if (state === "reconnecting") return "Riconnessione";
  if (state === "ended") return "Terminata";
  if (state === "failed") return "Errore";
  return "Anteprima";
}

function detachRoomMedia(activeRoom?: Room) {
  activeRoom?.remoteParticipants.forEach((participant) => {
    participant.trackPublications.forEach((publication) => publication.track?.detach());
  });
  activeRoom?.localParticipant.trackPublications.forEach((publication) => publication.track?.detach());
}

export function LiveKitCallPanel({
  status,
  conversationId,
}: {
  status: CollaborationCallStatus;
  conversationId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [room, setRoom] = React.useState<Room>();
  const [access, setAccess] = React.useState<CollaborationCallAccess>();
  const [connection, setConnection] = React.useState<ConnectionState>("idle");
  const [microphone, setMicrophone] = React.useState(true);
  const [camera, setCamera] = React.useState(false);
  const [screen, setScreen] = React.useState(false);
  const [participants, setParticipants] = React.useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = React.useState("");
  const mediaRoot = React.useRef<HTMLDivElement>(null);
  const roomRef = React.useRef<Room | undefined>(undefined);
  const accessRef = React.useRef<CollaborationCallAccess | undefined>(undefined);

  const updateParticipants = React.useCallback((activeRoom: Room) => {
    const remote = Array.from(activeRoom.remoteParticipants.values()).map((participant) => ({
      id: participant.identity,
      name: participant.name || participant.identity,
    }));
    setParticipants([
      { id: activeRoom.localParticipant.identity || "local", name: "Tu" },
      ...remote,
    ]);
  }, []);

  const attachTrack = React.useCallback((track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (!mediaRoot.current) return;
    const element = track.attach();
    element.dataset.trackId = publication.trackSid;
    element.dataset.participantId = participant.identity;
    element.className = track.kind === "video"
      ? "h-full w-full rounded-xl object-cover"
      : "sr-only";
    mediaRoot.current.appendChild(element);
  }, []);

  const detachTrack = React.useCallback((track: RemoteTrack) => {
    track.detach().forEach((element) => element.remove());
  }, []);

  const connect = async (nextMode: "voice" | "video") => {
    setCamera(false);
    setConnection("connecting");
    setError("");
    let nextRoom: Room | undefined;
    try {
      const nextAccess = await collaborationApi.startCall(conversationId, nextMode);
      const activeRoom = new Room({ adaptiveStream: true, dynacast: true });
      nextRoom = activeRoom;
      activeRoom
        .on(RoomEvent.ParticipantConnected, () => updateParticipants(activeRoom))
        .on(RoomEvent.ParticipantDisconnected, () => updateParticipants(activeRoom))
        .on(RoomEvent.TrackSubscribed, attachTrack)
        .on(RoomEvent.TrackUnsubscribed, detachTrack)
        .on(RoomEvent.Reconnecting, () => setConnection("reconnecting"))
        .on(RoomEvent.Reconnected, () => setConnection("connected"))
        .on(RoomEvent.Disconnected, () => setConnection("ended"));
      await activeRoom.connect(nextAccess.serverUrl, nextAccess.token);
      const canPublish = nextAccess.canPublish !== false;
      if (canPublish) {
        await activeRoom.localParticipant.setMicrophoneEnabled(true);
        if (nextMode === "video") await activeRoom.localParticipant.setCameraEnabled(true);
      }
      roomRef.current = activeRoom;
      accessRef.current = nextAccess;
      setRoom(activeRoom);
      setAccess(nextAccess);
      setMicrophone(canPublish);
      setCamera(canPublish && nextMode === "video");
      updateParticipants(activeRoom);
      setConnection("connected");
    } catch (cause) {
      detachRoomMedia(nextRoom);
      nextRoom?.disconnect();
      setConnection("failed");
      setError(cause instanceof Error ? cause.message : "Impossibile avviare la chiamata.");
    }
  };

  const toggleMicrophone = async () => {
    if (!room || access?.canPublish === false) return;
    try {
      const enabled = !microphone;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setMicrophone(enabled);
    } catch {
      setError("Permesso microfono negato o dispositivo non disponibile.");
    }
  };

  const toggleCamera = async () => {
    if (!room || access?.canPublish === false) return;
    try {
      const enabled = !camera;
      await room.localParticipant.setCameraEnabled(enabled);
      setCamera(enabled);
    } catch {
      setError("Permesso videocamera negato o dispositivo non disponibile.");
    }
  };

  const toggleScreen = async () => {
    if (!room || access?.canPublish === false) return;
    try {
      const enabled = !screen;
      await room.localParticipant.setScreenShareEnabled(enabled);
      setScreen(enabled);
    } catch {
      setError("Condivisione schermo non disponibile.");
    }
  };

  const leave = async () => {
    detachRoomMedia(room);
    room?.disconnect();
    if (access?.callId) {
      await collaborationApi.endCall(access.callId).catch(() => undefined);
    }
    mediaRoot.current?.querySelectorAll("audio,video").forEach((element) => element.remove());
    roomRef.current = undefined;
    accessRef.current = undefined;
    setRoom(undefined);
    setAccess(undefined);
    setParticipants([]);
    setConnection("ended");
    setMicrophone(true);
    setCamera(false);
    setScreen(false);
  };

  React.useEffect(() => {
    return () => {
      detachRoomMedia(roomRef.current);
      roomRef.current?.disconnect();
      const callId = accessRef.current?.callId;
      if (callId) void collaborationApi.endCall(callId).catch(() => undefined);
      roomRef.current = undefined;
      accessRef.current = undefined;
    };
  }, []);

  if (!status.enabled) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (!value && room) void leave();
    }}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-2">
          <Phone className="size-4" />
          <span className="hidden sm:inline">Chiama</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="size-5" />
            Chiamata Team Space
          </DialogTitle>
          <DialogDescription>
            Audio e video restano circoscritti alla conversazione autorizzata.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={connection === "connected" ? "default" : "secondary"}>
            {connectionLabel(connection)}
          </Badge>
          {participants.length ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <UsersRound className="size-3.5" />
              {participants.length} partecipanti
            </span>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {connection === "idle" || connection === "ended" || connection === "failed" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-24 flex-col gap-2" onClick={() => void connect("voice")}>
              <Phone className="size-6" />
              Chiamata audio
            </Button>
            <Button type="button" className="h-24 flex-col gap-2" onClick={() => void connect("video")}>
              <Video className="size-6" />
              Videochiamata
            </Button>
          </div>
        ) : null}
        {connection === "connecting" || connection === "reconnecting" ? (
          <div className="grid min-h-56 place-items-center rounded-2xl border bg-muted/30">
            <div className="text-center">
              {connection === "connecting"
                ? <Loader2 className="mx-auto mb-3 size-8 animate-spin motion-reduce:animate-none" />
                : <RefreshCw className="mx-auto mb-3 size-8 animate-spin motion-reduce:animate-none" />}
              <p className="text-sm font-medium">{connectionLabel(connection)}…</p>
            </div>
          </div>
        ) : null}
        {room && connection === "connected" ? (
          <>
            <div ref={mediaRoot} className="grid min-h-56 gap-3 rounded-2xl border bg-muted/30 p-3 sm:grid-cols-2">
              {participants.map((participant) => (
                <div key={participant.id} className="grid min-h-44 place-items-center rounded-xl border bg-card text-card-foreground">
                  <div className="text-center">
                    <span className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                      {participant.name.slice(0, 2).toUpperCase()}
                    </span>
                    <p className="text-sm font-medium">{participant.name}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {access?.canPublish !== false ? (
                <>
                  <Button type="button" size="icon" variant={microphone ? "secondary" : "destructive"} onClick={() => void toggleMicrophone()} aria-label={microphone ? "Disattiva microfono" : "Attiva microfono"}>
                    {microphone ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  </Button>
                  <Button type="button" size="icon" variant={camera ? "secondary" : "outline"} onClick={() => void toggleCamera()} aria-label={camera ? "Disattiva videocamera" : "Attiva videocamera"}>
                    {camera ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
                  </Button>
                  {status.supportsScreenShare !== false ? (
                    <Button type="button" size="icon" variant={screen ? "secondary" : "outline"} onClick={() => void toggleScreen()} aria-label={screen ? "Interrompi condivisione" : "Condividi schermo"}>
                      <MonitorUp className="size-4" />
                    </Button>
                  ) : null}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Partecipazione in ascolto</span>
              )}
              <Button type="button" variant="destructive" className="gap-2" onClick={() => void leave()}>
                <PhoneOff className="size-4" />
                Termina
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
