"use client";

import { useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDesktopCalls } from "./desktop-calls-provider";
import type { DoflowCallContext, DoflowCallType } from "./doflow-calls-api";

export function DesktopMeetingAction({
  context,
  type = "video",
  label = "Link riunione",
  compact = false,
}: {
  context?: DoflowCallContext;
  type?: DoflowCallType;
  label?: string;
  compact?: boolean;
}) {
  const calls = useDesktopCalls();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  if (!calls.guestAvailable) return null;

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const invite = await calls.createGuestMeeting({ type, ...(context ? { context } : {}) });
    setBusy(false);
    if (invite) setUrl(invite.url);
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
      <Button size={compact ? "icon-sm" : "sm"} variant="outline" aria-label={label} disabled={busy} onClick={() => void create()}>
        <Link2 />{compact ? null : (busy ? "Creazione…" : label)}
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
