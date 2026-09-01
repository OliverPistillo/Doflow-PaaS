"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Phone, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDesktopCalls } from "./desktop-calls-provider";
import type { DoflowCallContext, DoflowCallType } from "./doflow-calls-api";

const DESKTOP_CALL_ACTION_CLASS = "cursor-pointer border-primary/25 transition-[color,background-color,border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-sm active:translate-y-px active:scale-[0.98] focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none";

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
  const pending = useRef(false);
  const recipientId = String(userId || "").trim();
  if (
    !calls.available
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId)
    || recipientId === calls.selfUserId
  ) return null;

  const start = async (type: DoflowCallType) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(type);
    try {
      await calls.startInternalCall({
        calleeUserId: recipientId,
        type,
        ...(context ? { context } : {}),
      });
    } finally {
      pending.current = false;
      setBusy(null);
    }
  };

  return (
    <span className="inline-flex items-center gap-1" data-desktop-crm-call-actions="true">
      <Button className={DESKTOP_CALL_ACTION_CLASS} size={compact ? "icon-sm" : "sm"} variant="outline" disabled={busy !== null} aria-label={busy === "audio" ? `Avvio chiamata a ${label}` : `Chiama ${label}`} aria-busy={busy === "audio"} title={`Chiama ${label}`} onClick={() => void start("audio")}>
        {busy === "audio" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Phone />}{compact ? null : "Chiama"}
      </Button>
      <Button className={DESKTOP_CALL_ACTION_CLASS} size={compact ? "icon-sm" : "sm"} variant="ghost" disabled={busy !== null} aria-label={busy === "video" ? `Avvio videochiamata a ${label}` : `Videochiama ${label}`} aria-busy={busy === "video"} title={`Videochiama ${label}`} onClick={() => void start("video")}>
        {busy === "video" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Video />}{compact ? null : "Video"}
      </Button>
    </span>
  );
}
