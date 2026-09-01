"use client";

import { useRef, useState } from "react";
import { Copy, Link2, LoaderCircle, Phone, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDesktopCalls } from "./desktop-calls-provider";
import type { DoflowCallContext, DoflowCallType } from "./doflow-calls-api";

const DESKTOP_CALL_ACTION_CLASS = "cursor-pointer border-primary/25 transition-[color,background-color,border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-sm active:translate-y-px active:scale-[0.98] focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none";

export function DesktopMeetingAction({
  context,
  type = "video",
  label = "Link riunione",
  compact = false,
  callIcon = false,
}: {
  context?: DoflowCallContext;
  type?: DoflowCallType;
  label?: string;
  compact?: boolean;
  callIcon?: boolean;
}) {
  const calls = useDesktopCalls();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [url, setUrl] = useState<string | null>(null);
  const ActionIcon = callIcon ? (type === "audio" ? Phone : Video) : Link2;
  if (!calls.guestAvailable) return null;

  const create = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const invite = await calls.createGuestMeeting({ type, ...(context ? { context } : {}) });
      if (invite) setUrl(invite.url);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link riunione copiato");
    } catch {
      toast.error("Seleziona il link e copialo manualmente.");
    }
  };
  const revoke = async () => {
    if (await calls.revokeGuestMeeting()) setUrl(null);
  };

  return (
    <>
      <Button className={DESKTOP_CALL_ACTION_CLASS} size={compact ? "icon-sm" : "sm"} variant="outline" aria-label={busy ? "Creazione link riunione" : label} aria-busy={busy} title={label} disabled={busy} onClick={() => void create()}>
        {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <ActionIcon />}{compact ? null : label}
      </Button>
      <Dialog open={Boolean(url)} onOpenChange={(open) => { if (!open) setUrl(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link riunione Doflow</DialogTitle>
            <DialogDescription>Invito temporaneo per un ospite, senza accesso al gestionale o ai dati CRM.</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">Link guest
            <Input value={url || ""} readOnly autoComplete="off" aria-label="Link riunione guest" onFocus={(event) => event.currentTarget.select()} />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => void revoke()}>Revoca link</Button>
            <Button onClick={() => void copy()}><Copy />Copia link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
