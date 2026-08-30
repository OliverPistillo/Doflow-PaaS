"use client";

import { useMemo, useState } from "react";
import { Phone, Video } from "lucide-react";

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

  if (!calls.available) return null;

  const start = async (type: "audio" | "video") => {
    if (!recipientId || busy) return;
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

  return (
      <div className="flex items-center gap-1" data-desktop-calls-actions="true">
        {recipientId ? (
          <>
            <Button size={showLabels ? "sm" : "icon-sm"} variant="outline" aria-label="Avvia audiochiamata Desktop" disabled={busy !== null} onClick={() => void start("audio")}>
              <Phone />{showLabels ? <span className="hidden md:inline">Chiama</span> : null}
            </Button>
            <Button size={showLabels ? "sm" : "icon-sm"} variant="ghost" aria-label="Avvia videochiamata Desktop" disabled={busy !== null} onClick={() => void start("video")}>
              <Video />{showLabels ? <span className="hidden lg:inline">Videochiamata</span> : null}
            </Button>
          </>
        ) : null}
        {calls.guestAvailable ? (
          <DesktopMeetingAction context={context} compact={!showLabels} />
        ) : null}
      </div>
  );
}
