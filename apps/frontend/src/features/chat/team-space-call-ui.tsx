"use client";

import { useMemo, useState } from "react";
import { Phone, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDesktopCalls } from "@/features/calls/desktop-calls-provider";
import type { DoflowCallContext } from "@/features/calls/doflow-calls-api";
import { DesktopMeetingAction } from "@/features/calls/desktop-meeting-action";
import type { ChatConversation, ChatLinkedRecord } from "@/features/chat/team-chat";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

function contextFromLinkedRecord(record?: ChatLinkedRecord): DoflowCallContext | undefined {
  if (!record?.id) return undefined;
  if (record.type === "project") return { kind: "project", id: record.id };
  if (record.type === "customer") return { kind: "company", id: record.id };
  return undefined;
}

export function TeamSpaceConversationActions({
  conversation,
  showLabels = false,
  onConnected,
}: {
  conversation: ChatConversation;
  showLabels?: boolean;
  onConnected?: () => void;
}) {
  const calls = useDesktopCalls();
  const identity = useDoflowIdentity();
  const [busy, setBusy] = useState<"audio" | "video" | null>(null);
  const recipientId = useMemo(() => {
    if (conversation.kind !== "direct") return null;
    const candidates = conversation.participantIds.filter((id) => id !== identity.currentUserId);
    return candidates.length === 1 && identity.users.some((user) => user.id === candidates[0] && user.active !== false)
      ? candidates[0]
      : null;
  }, [conversation.kind, conversation.participantIds, identity.currentUserId, identity.users]);
  const context = contextFromLinkedRecord(conversation.linkedRecord);

  const start = async (type: "audio" | "video") => {
    if (!recipientId || !calls.available || busy) return;
    setBusy(type);
    const started = await calls.startInternalCall({
      calleeUserId: recipientId,
      type,
      conversationId: conversation.id,
      ...(context ? { context } : {}),
    });
    setBusy(null);
    if (started) onConnected?.();
  };

  const unavailable = () => toast.info("Le chiamate richiedono l’app Doflow Desktop collegata.");
  const internalAvailable = Boolean(recipientId && calls.available);
  const meetingAvailable = !internalAvailable && calls.guestAvailable;

  return (
      <div className="flex items-center gap-1" data-desktop-calls-actions="true">
        {internalAvailable ? (
          <>
            <Button size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label="Avvia audiochiamata Desktop" disabled={busy !== null} onClick={() => void start("audio")}>
              <Phone />{showLabels ? <span className="hidden md:inline">Avvia chiamata</span> : null}
            </Button>
            <Button size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label="Avvia videochiamata Desktop" disabled={busy !== null} onClick={() => void start("video")}>
              <Video />{showLabels ? <span className="hidden lg:inline">Avvia video</span> : null}
            </Button>
          </>
        ) : meetingAvailable ? <>
          <DesktopMeetingAction context={context} type="audio" label="Avvia chiamata" compact={!showLabels} callIcon />
          <DesktopMeetingAction context={context} type="video" label="Avvia video" compact={!showLabels} callIcon />
        </> : <>
          <Button size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label="Avvia chiamata" onClick={unavailable}><Phone />{showLabels ? <span className="hidden md:inline">Avvia chiamata</span> : null}</Button>
          <Button size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label="Avvia video" onClick={unavailable}><Video />{showLabels ? <span className="hidden lg:inline">Avvia video</span> : null}</Button>
        </>}
      </div>
  );
}
