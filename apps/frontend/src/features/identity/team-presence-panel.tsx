"use client";

import { Clock3, RadioTower } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider";
import { PresenceIndicator } from "@/features/identity/presence-indicator";
import type {
  PresenceRecord,
  PresenceStatus,
} from "@/features/identity/presence";

const groups: Array<{ label: string; statuses: PresenceStatus[] }> = [
  { label: "Disponibili", statuses: ["online"] },
  {
    label: "Occupati",
    statuses: ["busy", "do_not_disturb", "in_call", "in_meeting"],
  },
  { label: "Assenti", statuses: ["away"] },
  { label: "Offline", statuses: ["offline"] },
];

function relative(value?: string) {
  if (!value) return "Mai in questa sessione server";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60_000),
  );
  return minutes < 1
    ? "Adesso"
    : minutes === 1
      ? "1 min fa"
      : `${minutes} min fa`;
}

function elapsed(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60_000),
  );
  return minutes < 1 ? "meno di 1 min" : `${minutes} min`;
}

function operationalLabel(record: PresenceRecord) {
  const activity = record.currentActivity;
  if (!activity) return null;
  if (record.status === "in_call")
    return `In chiamata da ${elapsed(activity.startedAt)}`;
  if (record.status === "in_meeting" && activity.endsAt)
    return `In riunione fino alle ${new Date(activity.endsAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  if (record.status === "busy")
    return `Occupato da ${elapsed(activity.startedAt)}`;
  return null;
}

export function TeamPresencePanel() {
  const identity = useDoflowIdentity();
  const presence = useDoflowPresence();
  const administrator = identity.currentUser.roles.includes("administrator");
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RadioTower className="size-4" />
              Presenza del team
            </CardTitle>
            <CardDescription>
              Aggiornamento condiviso dal backend; nessun dato di presenza
              viene salvato nel browser.
            </CardDescription>
          </div>
          <Badge variant={presence.connected ? "outline" : "secondary"}>
            {presence.connected ? "Connesso" : "Riconnessione…"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 xl:grid-cols-2">
        {groups.map((group) => {
          const users = identity.users.filter((user) =>
            group.statuses.includes(presence.presenceFor(user.id).status),
          );
          return (
            <section
              key={group.label}
              className="min-w-0 overflow-hidden rounded-lg border p-3"
              aria-labelledby={`presence-${group.label}`}
            >
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                <h3
                  id={`presence-${group.label}`}
                  className="min-w-0 truncate font-medium"
                >
                  {group.label}
                </h3>
                <Badge variant="secondary">{users.length}</Badge>
              </div>
              <div className="min-w-0 space-y-2">
                {users.map((user) => {
                  const record = presence.presenceFor(user.id);
                  const duty = identity.teamDuties
                    .filter(
                      (item) =>
                        item.userId === user.id && item.status === "Attiva",
                    )
                    .sort((a, b) => b.version - a.version)[0];
                  const activityLabel = operationalLabel(record);
                  return (
                    <article
                      key={user.id}
                      data-presence-user={user.id}
                      className="flex min-w-0 items-start gap-3 overflow-hidden rounded-md bg-muted/35 p-2.5"
                    >
                      <UserAvatar
                        userId={user.id}
                        name={user.name}
                        className="size-9"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <b className="min-w-0 truncate text-sm">
                            {user.name}
                          </b>
                          <PresenceIndicator
                            status={record.status}
                            showLabel
                            showDot={false}
                          />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {duty?.title ?? user.roles.join(" · ")}
                        </p>
                        {activityLabel && (
                          <p className="mt-1 break-words text-xs">
                            {activityLabel}
                          </p>
                        )}
                        {record.expiresAt && (
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            Disponibile automaticamente dalle{" "}
                            {new Date(record.expiresAt).toLocaleTimeString(
                              "it-IT",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        )}
                        <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock3 className="size-3 shrink-0" />
                          <span className="truncate">
                            {administrator
                              ? `Ultima attività: ${record.lastSeenAt ? new Date(record.lastSeenAt).toLocaleString("it-IT") : "non disponibile"}`
                              : `Ultima attività: ${relative(record.lastSeenAt)}`}
                          </span>
                        </p>
                      </div>
                    </article>
                  );
                })}
                {!users.length && (
                  <p className="min-w-0 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Nessun collaboratore
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
