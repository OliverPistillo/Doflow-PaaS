"use client";

import { useState } from "react";
import { Phone, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDesktopCalls } from "./desktop-calls-provider";
import type { DoflowCallContext, DoflowCallType } from "./doflow-calls-api";

export function DesktopUserCallActions({
  userId,
  context,
  compact = false,
  label = "responsabile",
}: {
  userId?: string | null;
  context?: DoflowCallContext;
  compact?: boolean;
  label?: string;
}) {
  const calls = useDesktopCalls();
  const [busy, setBusy] = useState<DoflowCallType | null>(null);
  const recipientId = String(userId || "").trim();
  if (
    !calls.available
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId)
    || recipientId === calls.selfUserId
  ) return null;

  const start = async (type: DoflowCallType) => {
    if (busy) return;
    setBusy(type);
    try {
      await calls.startInternalCall({
        calleeUserId: recipientId,
        type,
        ...(context ? { context } : {}),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <span className="inline-flex items-center gap-1" data-desktop-crm-call-actions="true">
      <Button size={compact ? "icon-sm" : "sm"} variant="outline" disabled={busy !== null} aria-label={`Chiama ${label}`} onClick={() => void start("audio")}>
        <Phone />{compact ? null : "Chiama"}
      </Button>
      <Button size={compact ? "icon-sm" : "sm"} variant="ghost" disabled={busy !== null} aria-label={`Videochiama ${label}`} onClick={() => void start("video")}>
        <Video />{compact ? null : "Video"}
      </Button>
    </span>
  );
}
