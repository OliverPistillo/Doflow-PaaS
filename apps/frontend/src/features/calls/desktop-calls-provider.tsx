"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  closeDesktopCall,
  dismissIncomingDesktopCall,
  getDesktopCallCapabilities,
  getDesktopCallsDeviceId,
  openDesktopCall,
  showIncomingDesktopCall,
  subscribeDesktopCallActions,
  updateDesktopCallCredentials,
  type DesktopCallActionEvent,
  type DesktopNativeCall,
} from "@/lib/desktop-bridge";
import { useNotifications, type RealtimeEvent } from "@/hooks/useNotifications";
import {
  doflowCallsApi,
  type DoflowCall,
  type DoflowCallContext,
  type DoflowCallsStatus,
  type DoflowCallType,
  type GuestInviteResult,
} from "./doflow-calls-api";

const TERMINAL = new Set(["rejected", "cancelled", "missed", "busy", "failed", "ended"]);

type StartInternalCall = {
  calleeUserId: string;
  type: DoflowCallType;
  conversationId?: string;
  context?: DoflowCallContext;
};

type CallsContextValue = {
  available: boolean;
  guestAvailable: boolean;
  selfUserId: string | null;
  reason: DoflowCallsStatus["reason"] | "browser" | "bridge-unsupported" | "loading";
  currentCall: DoflowCall | null;
  outgoingCall: DoflowCall | null;
  guestInvite: GuestInviteResult["invite"];
  startInternalCall: (input: StartInternalCall) => Promise<boolean>;
  cancelOutgoingCall: () => Promise<boolean>;
  createGuestMeeting: (input: { type: DoflowCallType; context?: DoflowCallContext }) => Promise<GuestInviteResult["invite"]>;
  revokeGuestMeeting: () => Promise<boolean>;
};

const CallsContext = createContext<CallsContextValue | null>(null);

function safeCall(value: unknown): DoflowCall | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const callId = String(row.callId || row.id || "");
  const type = String(row.type || "");
  const status = String(row.status || "");
  if (!/^[0-9a-f-]{36}$/i.test(callId) || !["audio", "video"].includes(type) || !status) return null;
  return { ...row, id: callId, callId, type, status } as DoflowCall;
}

function unwrapCallEvent(event: RealtimeEvent): { type: `calls.${string}`; payload: Record<string, unknown> } | null {
  if (event.type.startsWith("calls.") && "payload" in event) {
    return { type: event.type as `calls.${string}`, payload: event.payload };
  }
  if ((event.type === "user_notification" || event.type === "tenant_notification") && "payload" in event) {
    const envelope = event.payload;
    const type = String(envelope.type || "");
    const payload = envelope.payload;
    if (type.startsWith("calls.") && payload && typeof payload === "object" && !Array.isArray(payload)) {
      return { type: type as `calls.${string}`, payload: payload as Record<string, unknown> };
    }
  }
  return null;
}

function nativeDescriptor(call: DoflowCall, userId: string): DesktopNativeCall {
  const incoming = call.calleeUserId === userId;
  const displayName = incoming
    ? call.callerName
    : call.guestMode
      ? call.guestDisplayName || "Ospite"
      : call.calleeName || "Partecipante Doflow";
  return {
    sessionId: call.callId,
    callType: call.type,
    direction: call.guestMode ? "guest" : incoming ? "incoming" : "outgoing",
    displayName,
    guestMode: call.guestMode,
    ...(call.expiresAt ? { expiresAt: call.expiresAt } : {}),
  };
}

function resultMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function DesktopCallsProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<DoflowCallsStatus | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [reason, setReason] = useState<CallsContextValue["reason"]>("loading");
  const [currentCall, setCurrentCall] = useState<DoflowCall | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<DoflowCall | null>(null);
  const [guestInvite, setGuestInvite] = useState<GuestInviteResult["invite"]>(null);
  const deviceRef = useRef<string | null>(null);
  const statusRef = useRef<DoflowCallsStatus | null>(null);
  const currentRef = useRef<DoflowCall | null>(null);
  const outgoingRef = useRef<DoflowCall | null>(null);
  const openingRef = useRef(new Set<string>());
  const openedRef = useRef(new Set<string>());
  const locallyFailedWindowsRef = useRef(new Set<string>());
  const refreshTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const refreshCredentialRef = useRef<(callId: string) => void>(() => undefined);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { currentRef.current = currentCall; }, [currentCall]);
  useEffect(() => { outgoingRef.current = outgoingCall; }, [outgoingCall]);

  const clearRefresh = useCallback((callId: string) => {
    const timer = refreshTimersRef.current.get(callId);
    if (timer) clearTimeout(timer);
    refreshTimersRef.current.delete(callId);
  }, []);

  const refreshCredential = useCallback(async (callId: string) => {
    const deviceId = deviceRef.current;
    if (!deviceId || currentRef.current?.callId !== callId) return;
    try {
      const access = await doflowCallsApi.token(callId, deviceId);
      await updateDesktopCallCredentials(callId, { serverUrl: access.serverUrl, accessToken: access.token });
      clearRefresh(callId);
      const delay = Math.max(30_000, (access.expiresInSeconds - 60) * 1000);
      refreshTimersRef.current.set(callId, setTimeout(() => refreshCredentialRef.current(callId), delay));
    } catch {
      // The media SDK continues its current connection; a reconnect asks again from the native window.
    }
  }, [clearRefresh]);

  useEffect(() => {
    refreshCredentialRef.current = (callId) => void refreshCredential(callId);
  }, [refreshCredential]);

  const openCall = useCallback(async (call: DoflowCall) => {
    const deviceId = deviceRef.current;
    const userId = statusRef.current?.userId;
    if (!deviceId || !userId || TERMINAL.has(call.status)) return false;
    if (openingRef.current.has(call.callId)) return true;
    if (openedRef.current.has(call.callId)) {
      setCurrentCall(call);
      return true;
    }
    openingRef.current.add(call.callId);
    try {
      const access = await doflowCallsApi.token(call.callId, deviceId);
      await openDesktopCall(nativeDescriptor(access.call, userId), {
        serverUrl: access.serverUrl,
        accessToken: access.token,
      });
      openedRef.current.add(call.callId);
      setCurrentCall(access.call);
      setOutgoingCall(null);
      await dismissIncomingDesktopCall(call.callId).catch(() => false);
      clearRefresh(call.callId);
      const delay = Math.max(30_000, (access.expiresInSeconds - 60) * 1000);
      refreshTimersRef.current.set(call.callId, setTimeout(() => void refreshCredential(call.callId), delay));
      return true;
    } catch (error) {
      toast.error(resultMessage(error, "Impossibile aprire la chiamata Desktop."));
      return false;
    } finally {
      openingRef.current.delete(call.callId);
    }
  }, [clearRefresh, refreshCredential]);

  const closeCallState = useCallback(async (call: DoflowCall) => {
    clearRefresh(call.callId);
    openedRef.current.delete(call.callId);
    openingRef.current.delete(call.callId);
    const preserveFailureSurface = call.status === "failed" && locallyFailedWindowsRef.current.has(call.callId);
    const closeOperations: Promise<unknown>[] = [dismissIncomingDesktopCall(call.callId)];
    if (!preserveFailureSurface) {
      locallyFailedWindowsRef.current.delete(call.callId);
      closeOperations.push(closeDesktopCall(call.callId));
    }
    await Promise.allSettled(closeOperations);
    setCurrentCall((current) => current?.callId === call.callId ? null : current);
    setOutgoingCall((current) => current?.callId === call.callId ? null : current);
    if (call.status === "missed") toast.info("Chiamata persa");
    if (call.status === "rejected") toast.info("Chiamata rifiutata");
    if (call.status === "busy") toast.info("Il destinatario è già impegnato");
    if (call.status === "failed") toast.error("La chiamata si è interrotta");
  }, [clearRefresh]);

  const handleCallState = useCallback(async (event: RealtimeEvent) => {
    const callEvent = unwrapCallEvent(event);
    if (!callEvent) return;
    const call = safeCall(callEvent.payload);
    const userId = statusRef.current?.userId;
    if (!call || !userId) return;
    if (callEvent.type === "calls.incoming" && call.calleeUserId === userId && call.status === "ringing") {
      try {
        await showIncomingDesktopCall(nativeDescriptor(call, userId));
      } catch {
        toast.error("Chiamata in arrivo: apri Doflow per rispondere.");
      }
      return;
    }
    if (call.status === "accepted" && (call.callerUserId === userId || call.calleeUserId === userId)) {
      await dismissIncomingDesktopCall(call.callId).catch(() => false);
      await openCall(call);
      return;
    }
    if (["connecting", "active"].includes(call.status)) {
      setCurrentCall(call);
      setOutgoingCall(null);
      return;
    }
    if (TERMINAL.has(call.status)) await closeCallState(call);
  }, [closeCallState, openCall]);

  const realtime = useNotifications({ enabled: bridgeReady && Boolean(status?.enabled), onEvent: handleCallState });

  const recoverIncoming = useCallback(async () => {
    const deviceId = deviceRef.current;
    const userId = statusRef.current?.userId;
    if (!deviceId || !userId) return;
    try {
      const incoming = await doflowCallsApi.incoming(deviceId);
      await Promise.all(incoming.items.map((call) => showIncomingDesktopCall(nativeDescriptor(call, userId))));
    } catch {
      // Heartbeat keeps running and the persisted backend remains authoritative.
    }
  }, []);

  const reconcileKnownCall = useCallback(async () => {
    const deviceId = deviceRef.current;
    const known = currentRef.current || outgoingRef.current;
    if (!deviceId || !known) return;
    try {
      const call = await doflowCallsApi.detail(known.callId, deviceId);
      await handleCallState({ type: `calls.${call.status}`, payload: call });
    } catch {
      // The next realtime event or heartbeat retries against persisted authority.
    }
  }, [handleCallState]);

  useEffect(() => {
    let disposed = false;
    const bootstrap = async () => {
      const deviceId = getDesktopCallsDeviceId();
      if (!deviceId) {
        setReason("browser");
        return;
      }
      const capabilities = await getDesktopCallCapabilities().catch(() => null);
      if (!capabilities || capabilities.schemaVersion < 2 || !capabilities.capabilities.includes("calls.internal")) {
        setReason("bridge-unsupported");
        return;
      }
      const availability = await doflowCallsApi.status().catch(() => null);
      if (disposed) return;
      setBridgeReady(true);
      deviceRef.current = deviceId;
      if (!availability) {
        setReason("disabled");
        return;
      }
      setStatus(availability);
      statusRef.current = availability;
      setReason(availability.reason);
      if (!availability.enabled) return;
      try {
        await doflowCallsApi.heartbeat(deviceId);
        await recoverIncoming();
      } catch (error) {
        if (!disposed) toast.error(resultMessage(error, "Doflow Calls temporaneamente non disponibile."));
      }
    };
    void bootstrap();
    return () => { disposed = true; };
  }, [recoverIncoming]);

  useEffect(() => {
    if (!status?.enabled || !deviceRef.current) return;
    const heartbeat = async () => {
      const deviceId = deviceRef.current;
      if (!deviceId) return;
      await doflowCallsApi.heartbeat(deviceId).catch(() => undefined);
      await Promise.all([recoverIncoming(), reconcileKnownCall()]);
    };
    const timer = window.setInterval(() => void heartbeat(), 20_000);
    return () => window.clearInterval(timer);
  }, [recoverIncoming, reconcileKnownCall, status?.enabled]);

  useEffect(() => {
    if (!realtime.connected || !status?.enabled) return;
    void recoverIncoming();
  }, [realtime.connected, recoverIncoming, status?.enabled]);

  useEffect(() => {
    if (!status?.enabled) return;
    return subscribeDesktopCallActions((event: DesktopCallActionEvent) => {
      const deviceId = deviceRef.current;
      if (!deviceId) return;
      void (async () => {
        try {
          if (event.action === "ready") return;
          if (event.action === "accept") {
            const call = await doflowCallsApi.accept(event.sessionId, deviceId);
            await openCall(call);
          } else if (event.action === "reject") {
            const call = await doflowCallsApi.reject(event.sessionId, deviceId);
            await closeCallState(call);
          } else if (event.action === "cancel") {
            const call = await doflowCallsApi.cancel(event.sessionId, deviceId);
            await closeCallState(call);
          } else if (event.action === "failed") {
            locallyFailedWindowsRef.current.add(event.sessionId);
            const call = await doflowCallsApi.fail(event.sessionId, deviceId, event.reason);
            await closeCallState(call);
          } else if (event.action === "end") {
            const call = await doflowCallsApi.end(event.sessionId, deviceId, event.reason);
            await closeCallState(call);
          } else if (event.action === "refreshToken") {
            await refreshCredential(event.sessionId);
          }
        } catch (error) {
          toast.error(resultMessage(error, "Impossibile aggiornare la chiamata."));
          await dismissIncomingDesktopCall(event.sessionId).catch(() => false);
        }
      })();
    }) ?? undefined;
  }, [closeCallState, openCall, refreshCredential, status?.enabled]);

  useEffect(() => () => {
    for (const timer of refreshTimersRef.current.values()) clearTimeout(timer);
    locallyFailedWindowsRef.current.clear();
    const deviceId = deviceRef.current;
    if (deviceId) void doflowCallsApi.disconnect(deviceId).catch(() => undefined);
  }, []);

  const startInternalCall = useCallback(async (input: StartInternalCall) => {
    const deviceId = deviceRef.current;
    if (!statusRef.current?.enabled || !deviceId) return false;
    try {
      const call = await doflowCallsApi.create({ ...input, deviceId });
      if (call.status === "busy") {
        toast.info("Il destinatario è già impegnato");
        return false;
      }
      setOutgoingCall(call);
      toast.success(input.type === "video" ? "Videochiamata avviata" : "Chiamata avviata");
      return true;
    } catch (error) {
      toast.error(resultMessage(error, "Impossibile avviare la chiamata."));
      return false;
    }
  }, []);

  const cancelOutgoingCall = useCallback(async () => {
    const deviceId = deviceRef.current;
    if (!deviceId || !outgoingCall) return false;
    try {
      const call = await doflowCallsApi.cancel(outgoingCall.callId, deviceId);
      await closeCallState(call);
      return true;
    } catch (error) {
      toast.error(resultMessage(error, "Impossibile annullare la chiamata."));
      return false;
    }
  }, [closeCallState, outgoingCall]);

  const createGuestMeeting = useCallback(async (input: { type: DoflowCallType; context?: DoflowCallContext }) => {
    const deviceId = deviceRef.current;
    if (!statusRef.current?.guestEnabled || !deviceId) return null;
    try {
      const result = await doflowCallsApi.createGuest({ ...input, deviceId });
      setGuestInvite(result.invite);
      if (!result.invite) return null;
      await openCall(result.call);
      return result.invite;
    } catch (error) {
      toast.error(resultMessage(error, "Impossibile creare il link riunione."));
      return null;
    }
  }, [openCall]);

  const revokeGuestMeeting = useCallback(async () => {
    const deviceId = deviceRef.current;
    if (!guestInvite || !deviceId) return false;
    try {
      await doflowCallsApi.revokeGuest(guestInvite.id, deviceId);
      setGuestInvite(null);
      toast.success("Link riunione revocato");
      return true;
    } catch (error) {
      toast.error(resultMessage(error, "Impossibile revocare il link."));
      return false;
    }
  }, [guestInvite]);

  const value = useMemo<CallsContextValue>(() => ({
    available: bridgeReady && Boolean(status?.enabled),
    guestAvailable: bridgeReady && Boolean(status?.guestEnabled),
    selfUserId: status?.userId || null,
    reason,
    currentCall,
    outgoingCall,
    guestInvite,
    startInternalCall,
    cancelOutgoingCall,
    createGuestMeeting,
    revokeGuestMeeting,
  }), [bridgeReady, cancelOutgoingCall, createGuestMeeting, currentCall, guestInvite, outgoingCall, reason, revokeGuestMeeting, startInternalCall, status]);

  return (
    <CallsContext.Provider value={value}>
      {children}
      {outgoingCall ? (
        <aside className="fixed bottom-4 right-4 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-2xl backdrop-blur" aria-live="polite" aria-label="Chiamata in uscita">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{outgoingCall.type === "video" ? <Video className="size-5" /> : <Phone className="size-5" />}</span>
          <span className="min-w-0"><strong className="block truncate text-sm">{outgoingCall.calleeName || "Partecipante Doflow"}</strong><small className="text-muted-foreground">Chiamata in corso…</small></span>
          <Button size="icon-sm" variant="destructive" aria-label="Annulla chiamata" onClick={() => void cancelOutgoingCall()}><PhoneOff /></Button>
        </aside>
      ) : null}
    </CallsContext.Provider>
  );
}

export function useDesktopCalls() {
  const value = useContext(CallsContext);
  if (!value) throw new Error("useDesktopCalls deve essere usato dentro DesktopCallsProvider");
  return value;
}
