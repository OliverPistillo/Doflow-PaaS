"use client";

import { useMemo, useRef, useState } from "react";
import { LoaderCircle, Phone, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDesktopCalls } from "@/features/calls/desktop-calls-provider";
import type { DoflowCallContext } from "@/features/calls/doflow-calls-api";
import { DesktopMeetingAction } from "@/features/calls/desktop-meeting-action";
import type { ChatConversation, ChatLinkedRecord } from "@/features/chat/team-chat";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

const DESKTOP_CALL_ACTION_CLASS = "cursor-pointer border-primary/25 transition-[color,background-color,border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-sm active:translate-y-px active:scale-[0.98] focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none";

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
  const pending = useRef(false);
  const recipientId = useMemo(() => {
    if (conversation.kind !== "direct") return null;
    const candidates = conversation.participantIds.filter((id) => id !== identity.currentUserId);
    return candidates.length === 1 && identity.users.some((user) => user.id === candidates[0] && user.active !== false)
      ? candidates[0]
      : null;
  }, [conversation.kind, conversation.participantIds, identity.currentUserId, identity.users]);
  const context = contextFromLinkedRecord(conversation.linkedRecord);
  const internalAvailable = Boolean(recipientId && calls.available);
  const meetingAvailable = !internalAvailable && calls.guestAvailable;

  if (!internalAvailable && !meetingAvailable) return null;

  const start = async (type: "audio" | "video") => {
    if (!recipientId || !calls.available || pending.current) return;
    pending.current = true;
    setBusy(type);
    try {
      const started = await calls.startInternalCall({
        calleeUserId: recipientId,
        type,
        conversationId: conversation.id,
        ...(context ? { context } : {}),
      });
      if (started) onConnected?.();
    } finally {
      pending.current = false;
      setBusy(null);
    }
  };

  return (
      <div className="flex items-center gap-1" data-desktop-calls-actions="true">
        {internalAvailable ? (
          <>
            <Button className={DESKTOP_CALL_ACTION_CLASS} size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label={busy === "audio" ? "Avvio audiochiamata Desktop" : "Avvia audiochiamata Desktop"} aria-busy={busy === "audio"} title="Avvia audiochiamata Desktop" disabled={busy !== null} onClick={() => void start("audio")}>
              {busy === "audio" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Phone />}{showLabels ? <span className="hidden md:inline">Avvia chiamata</span> : null}
            </Button>
            <Button className={DESKTOP_CALL_ACTION_CLASS} size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label={busy === "video" ? "Avvio videochiamata Desktop" : "Avvia videochiamata Desktop"} aria-busy={busy === "video"} title="Avvia videochiamata Desktop" disabled={busy !== null} onClick={() => void start("video")}>
              {busy === "video" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Video />}{showLabels ? <span className="hidden lg:inline">Avvia video</span> : null}
            </Button>
          </>
        ) : meetingAvailable ? <>
          <DesktopMeetingAction context={context} type="audio" label="Avvia chiamata" compact={!showLabels} callIcon />
          <DesktopMeetingAction context={context} type="video" label="Avvia video" compact={!showLabels} callIcon />
        </> : null}
      </div>
  );
}
