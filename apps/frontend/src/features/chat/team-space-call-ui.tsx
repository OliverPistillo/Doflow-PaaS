"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Users, Video } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ChatConversation, TeamCallMode } from "@/features/chat/team-chat"
import { LIVEKIT_UI_ENABLED } from "@/features/chat/team-chat"
import { useTeamChat } from "@/features/chat/team-chat-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

type DeviceOption = { deviceId: string; label: string }
function availableDevices(items: MediaDeviceInfo[], kind: MediaDeviceKind, fallback: string): DeviceOption[] {
  const seen = new Set<string>()
  return items.filter((item) => item.kind === kind && item.deviceId && !["default", "communications"].includes(item.deviceId)).map((item, index) => ({ deviceId: item.deviceId, label: item.label.trim() || `${fallback} ${index + 1}` })).filter((item) => !seen.has(item.deviceId) && Boolean(seen.add(item.deviceId)))
}

export function TeamSpaceConversationActions({ conversation, showLabels = false, onConnected }: { conversation: ChatConversation; showLabels?: boolean; onConnected?: () => void }) {
  const chat = useTeamChat(); const [prejoinCallId, setPrejoinCallId] = useState<string>(); const [mode, setMode] = useState<TeamCallMode>("voice"); const [now, setNow] = useState(0)
  const active = chat.calls.find((call) => call.conversationId === conversation.id && !["ended", "failed"].includes(call.status))
  useEffect(() => { if (!active) return; const update = () => setNow(Date.now()); const initial = window.setTimeout(update, 0); const timer = window.setInterval(update, 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [active])
  if (!LIVEKIT_UI_ENABLED) return null
  const begin = async (nextMode: TeamCallMode) => {
    if (!chat.livekitConfigured) return toast.error("LiveKit non configurato sul server")
    setMode(nextMode); const result = active ? { ok: true, id: active.id } : await chat.startCall(conversation.id, nextMode)
    if (!result.ok || !result.id) return toast.error(result.message ?? "Impossibile avviare la chiamata")
    setPrejoinCallId(result.id)
  }
  const elapsed = active?.startedAt && now ? Math.max(0, Math.floor((now - Date.parse(active.startedAt)) / 60_000)) : 0
  return <><div className="flex items-center gap-1">{active ? <Button size="sm" variant="secondary" onClick={() => void begin(active.mode)} aria-label={`Partecipa alla chiamata, ${active.connectedUserIds.length} collegati`}><Phone /><span className="hidden sm:inline">Partecipa</span><Badge variant="outline" className="h-5 px-1.5 text-[10px]">{active.connectedUserIds.length} · {elapsed}m</Badge></Button> : <><Button size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label="Avvia chiamata vocale" onClick={() => void begin("voice")}><Phone />{showLabels && <span className="hidden md:inline">Avvia chiamata</span>}</Button><Button size={showLabels ? "sm" : "icon-sm"} variant="ghost" aria-label="Avvia videochiamata" onClick={() => void begin("video")}><Video />{showLabels && <span className="hidden lg:inline">Avvia video</span>}</Button></>}</div><PrejoinDialog key={`${prejoinCallId ?? "closed"}:${mode}`} callId={prejoinCallId} mode={mode} open={Boolean(prejoinCallId)} onConnected={onConnected} onOpenChange={(open) => !open && setPrejoinCallId(undefined)} /></>
}

function PrejoinDialog({ callId, mode, open, onOpenChange, onConnected }: { callId?: string; mode: TeamCallMode; open: boolean; onOpenChange: (open: boolean) => void; onConnected?: () => void }) {
  const chat = useTeamChat(); const videoRef = useRef<HTMLVideoElement>(null); const [microphone, setMicrophone] = useState(true); const [camera, setCamera] = useState(mode === "video"); const [devices, setDevices] = useState<{ audio: DeviceOption[]; video: DeviceOption[] }>({ audio: [], video: [] }); const [audioDevice, setAudioDevice] = useState("default"); const [videoDevice, setVideoDevice] = useState("default"); const [joining, setJoining] = useState(false); const [error, setError] = useState<string>()
  const refreshDevices = useCallback(async () => {
    try {
      const items = await navigator.mediaDevices?.enumerateDevices() ?? []
      const next = { audio: availableDevices(items, "audioinput", "Microfono"), video: availableDevices(items, "videoinput", "Videocamera") }
      setDevices(next); setAudioDevice((current) => current === "default" || next.audio.some((item) => item.deviceId === current) ? current : "default"); setVideoDevice((current) => current === "default" || next.video.some((item) => item.deviceId === current) ? current : "default")
    } catch { setDevices({ audio: [], video: [] }) }
  }, [])
  useEffect(() => {
    if (!open) return
    const media = navigator.mediaDevices; const changed = () => void refreshDevices(); const initial = window.setTimeout(changed, 0); media?.addEventListener("devicechange", changed); return () => { window.clearTimeout(initial); media?.removeEventListener("devicechange", changed) }
  }, [open, refreshDevices])
  useEffect(() => {
    let stream: MediaStream | undefined
    if (open && camera) void navigator.mediaDevices.getUserMedia({ video: videoDevice === "default" ? true : { deviceId: { exact: videoDevice } }, audio: false }).then((value) => { stream = value; if (videoRef.current) videoRef.current.srcObject = value; setError(undefined); void refreshDevices() }).catch(() => { setCamera(false); setError("Videocamera non disponibile o permesso negato. Puoi entrare senza video.") })
    return () => stream?.getTracks().forEach((track) => track.stop())
  }, [camera, open, refreshDevices, videoDevice])
  const join = async () => { if (!callId || joining || !chat.livekitConfigured) return; setJoining(true); setError(undefined); const result = await chat.joinCall(callId, { microphone, camera, audioDeviceId: audioDevice === "default" ? undefined : audioDevice, videoDeviceId: videoDevice === "default" ? undefined : videoDevice }); setJoining(false); if (!result.ok) { const message = result.message ?? "Connessione non riuscita. Controlla dispositivi e rete, poi riprova."; setError(message); return toast.error(message) } onConnected?.(); onOpenChange(false) }
  const deviceSelect = (kind: "audio" | "video", value: string, update: (value: string) => void) => { const list = devices[kind]; const selected = list.find((item) => item.deviceId === value); const defaultLabel = kind === "audio" ? "Dispositivo predefinito" : "Videocamera predefinita"; return <Select value={value} onValueChange={update}><SelectTrigger className="w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate" title={selected?.label ?? defaultLabel}><SelectValue placeholder={list.length ? defaultLabel : "Dispositivo non disponibile"} /></SelectTrigger><SelectContent className="max-h-64 max-w-[calc(100vw-2rem)]"><SelectItem value="default">{list.length ? defaultLabel : "Dispositivo non disponibile"}</SelectItem>{list.map((device) => <SelectItem key={device.deviceId} value={device.deviceId} title={device.label} className="max-w-[min(420px,calc(100vw-3rem))] truncate">{device.label}</SelectItem>)}</SelectContent></Select> }
  return <Dialog open={open} onOpenChange={(value) => !joining && onOpenChange(value)}><DialogContent className="flex max-h-[min(92dvh,680px)] w-[calc(100vw-2rem)] max-w-lg min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"><DialogHeader className="shrink-0 px-5 pb-3 pt-5 text-left"><DialogTitle>Prima di entrare</DialogTitle><DialogDescription>Controlla dispositivi e preferenze. Lo stato “In chiamata” apparirà soltanto dopo la connessione LiveKit.</DialogDescription></DialogHeader><div className="min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-2"><div className="aspect-video min-w-0 overflow-hidden rounded-xl border bg-slate-950"><video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${camera ? "block" : "hidden"}`} />{!camera && <div className="grid h-full place-items-center text-center text-sm text-white/70"><span><CameraOff className="mx-auto mb-2 size-8" />Videocamera disattivata</span></div>}</div><div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2"><Label className="min-w-0 space-y-1.5"><span>Microfono</span>{deviceSelect("audio", audioDevice, setAudioDevice)}</Label><Label className="min-w-0 space-y-1.5"><span>Videocamera</span>{deviceSelect("video", videoDevice, setVideoDevice)}</Label></div><div className="flex min-w-0 flex-wrap gap-2"><Button variant={microphone ? "secondary" : "outline"} onClick={() => setMicrophone((value) => !value)}>{microphone ? <Mic /> : <MicOff />}{microphone ? "Microfono attivo" : "Microfono spento"}</Button><Button variant={camera ? "secondary" : "outline"} onClick={() => setCamera((value) => !value)}>{camera ? <Camera /> : <CameraOff />}{camera ? "Video attivo" : "Video spento"}</Button></div>{error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}</div><DialogFooter className="sticky bottom-0 mx-0 mb-0 shrink-0 border-t bg-background px-5 py-4"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={joining}>Annulla</Button><Button onClick={() => void join()} disabled={joining || !callId || !chat.livekitConfigured}>{joining ? "Connessione…" : "Connetti"}</Button></DialogFooter></DialogContent></Dialog>
}

export function TeamCallOverlay() {
  const chat = useTeamChat(); const identity = useDoflowIdentity(); const pathname = usePathname(); const [minimized, setMinimized] = useState(false); const [now, setNow] = useState(0)
  useEffect(() => { if (!chat.currentCall) return; const update = () => setNow(Date.now()); const initial = window.setTimeout(update, 0); const timer = window.setInterval(update, 1_000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [chat.currentCall])
  const duration = useMemo(() => { const started = chat.currentCall?.startedAt; if (!started || !now) return "00:00"; const total = Math.max(0, Math.floor((now - Date.parse(started)) / 1_000)); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` }, [chat.currentCall, now])
  if (!LIVEKIT_UI_ENABLED) return null
  if (!chat.currentCall || pathname === "/dashboard/team-space") return null
  const conversation = chat.conversations.find((item) => item.id === chat.currentCall?.conversationId); const canEnd = chat.currentCall.createdBy === identity.currentUserId || identity.currentUser.roles.includes("administrator")
  const callHref = `/dashboard/team-space?channel=${encodeURIComponent(conversation?.id ?? "")}&view=call`
  return <aside className={`fixed bottom-3 right-3 z-[70] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border bg-background shadow-2xl ${minimized ? "w-56" : "w-[min(360px,calc(100vw-1.5rem))]"}`} aria-label="Mini-player Team Space"><div className="flex items-center gap-2 p-2.5"><Link href={callHref} className="flex min-w-0 flex-1 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600"><Phone className="size-4" /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{conversation?.title ?? "Team Space"}</b><span className="block truncate text-xs text-muted-foreground">{duration} · {chat.participantIds.length} partecipanti · {chat.microphoneEnabled ? "Microfono attivo" : "Microfono spento"}</span></span></Link><Button size="icon-xs" variant="ghost" onClick={() => setMinimized((value) => !value)} aria-label={minimized ? "Mostra controlli" : "Riduci mini-player"}>{minimized ? <Users /> : <span aria-hidden>−</span>}</Button></div>{!minimized && <div className="flex items-center gap-1 border-t p-2"><Button size="sm" variant={chat.microphoneEnabled ? "secondary" : "destructive"} onClick={() => void chat.toggleMicrophone()} aria-label={chat.microphoneEnabled ? "Disattiva microfono" : "Attiva microfono"}>{chat.microphoneEnabled ? <Mic /> : <MicOff />}<span className="hidden xs:inline">Microfono</span></Button><Button size="sm" variant="outline" asChild><Link href={callHref}>Torna</Link></Button><Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => void chat.leaveCall()}><PhoneOff />Esci</Button>{canEnd && <span className="sr-only">Puoi terminare la chiamata dalla pagina Team Space</span>}<span className="sr-only"><Users />{chat.participantIds.length} partecipanti</span></div>}</aside>
}
