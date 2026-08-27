"use client";

import { useState } from "react";
import { MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider";
import { useFlowboards } from "@/features/flowboard/flowboard-provider";
import type {
  Flowboard,
  FlowboardCollaborator,
} from "@/features/flowboard/flowboard-types";
import { cn } from "@/lib/utils";

const presenceTone: Record<string, string> = {
  online: "bg-emerald-500",
  busy: "bg-red-500",
  away: "bg-amber-500",
  offline: "bg-slate-400",
  dnd: "bg-red-700",
  in_call: "bg-violet-500",
  in_meeting: "bg-sky-500",
};

export function FlowboardShareDialog({
  board,
  canManage,
  onShareChat,
}: {
  board: Flowboard;
  canManage: boolean;
  onShareChat: () => void;
}) {
  const identity = useDoflowIdentity();
  const presence = useDoflowPresence();
  const flowboards = useFlowboards();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FlowboardCollaborator[]>(
    board.collaborators,
  );
  const [saving, setSaving] = useState(false);
  const setPermission = (
    userId: string,
    permission: "none" | "view" | "edit",
  ) =>
    setDraft((items) =>
      permission === "none"
        ? items.filter((item) => item.userId !== userId)
        : [
            ...items.filter((item) => item.userId !== userId),
            { userId, permission },
          ],
    );
  const save = async () => {
    setSaving(true);
    const result = await flowboards.updateBoard(board.id, {
      collaborators: draft,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Collaboratori aggiornati");
      setOpen(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(board.collaborators);
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Condividi Flowboard">
          <Share2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Condividi Flowboard</DialogTitle>
          <DialogDescription>
            Invita collaboratori in visualizzazione o modifica. I permessi
            vengono verificati anche dal backend.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {identity.users
            .filter((user) => user.id !== board.ownerId)
            .map((user) => {
              const status = presence.presenceFor(user.id).status;
              const permission =
                draft.find((item) => item.userId === user.id)?.permission ??
                "none";
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="relative">
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background",
                        presenceTone[status] ?? presenceTone.offline,
                      )}
                      aria-label={`Stato ${status}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.roles.join(" · ")}
                    </p>
                  </div>
                  <Select
                    value={permission}
                    onValueChange={(value) =>
                      setPermission(user.id, value as "none" | "view" | "edit")
                    }
                    disabled={!canManage}
                  >
                    <SelectTrigger
                      className="w-32"
                      aria-label={`Permesso ${user.name}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      <SelectItem value="view">Visualizza</SelectItem>
                      <SelectItem value="edit">Modifica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onShareChat();
              setOpen(false);
            }}
          >
            <MessageCircle />
            Condividi in Chat
          </Button>
          {canManage && (
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Salvataggio…" : "Salva accessi"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
