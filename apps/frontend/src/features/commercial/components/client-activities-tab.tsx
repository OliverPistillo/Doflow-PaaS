"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { formatItalianDate, formatRelativeDeadline } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityDetailSheet } from "@/features/commercial/components/activity-detail-sheet";
import {
  CustomerActivity,
  useCommercialLeads,
} from "@/features/commercial/components/commercial-leads-provider";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

const statuses = [
  "Da fare",
  "In corso",
  "In attesa cliente",
  "Completata",
] as const;

export function ClientActivitiesTab({
  clientId,
  onNew,
  activityId,
}: {
  clientId: string;
  onNew: () => void;
  activityId?: string | null;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const customer = store.customers.find((item) => item.id === clientId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissedActivityId, setDismissedActivityId] = useState<string | null>(
    null,
  );
  if (!customer) return null;

  const activities = [
    ...(customer.onboardingActivity ? [customer.onboardingActivity] : []),
    ...(customer.activities ?? []),
  ];
  const activeActivityId =
    activityId && activityId !== dismissedActivityId ? activityId : selectedId;
  const complete = (item: CustomerActivity) => item.status === "Completata";
  const overdue = (item: CustomerActivity) =>
    !complete(item) &&
    new Date(item.dueAt).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
  const results = activities.filter(
    (item) =>
      `${item.title} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "open" && !complete(item)) ||
        (filter === "waiting" && item.status === "In attesa cliente") ||
        (filter === "completed" && complete(item))),
  );
  const change = (id: string, status: CustomerActivity["status"]) => {
    const activity = activities.find((item) => item.id === id);
    if (!activity || activity.status === status) return;
    if (status === "Completata") store.completeCustomerActivity(clientId, id);
    else if (activity.status === "Completata" && status === "Da fare")
      store.reopenCustomerActivity(clientId, id);
    else
      store.updateCustomerActivity(clientId, id, {
        status,
        completedAt: undefined,
      });
    toast.success(
      `Stato attività modificato da ${activity.status} a ${status}`,
    );
  };
  const openActivity = (id: string) => {
    setDismissedActivityId(null);
    setSelectedId(id);
  };
  const summaries = [
    ["Aperte", activities.filter((item) => !complete(item)).length, "open"],
    ["Scadute", activities.filter(overdue).length, "all"],
    [
      "In attesa cliente",
      activities.filter((item) => item.status === "In attesa cliente").length,
      "waiting",
    ],
    ["Completate", activities.filter(complete).length, "completed"],
  ] as const;

  return (
    <div className="mt-4 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map(([label, value, target]) => (
          <button
            key={label}
            className="text-left"
            onClick={() => setFilter(target)}
          >
            <Card>
              <CardHeader className="py-3">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
              </CardHeader>
            </Card>
          </button>
        ))}
      </section>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca attività"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="open">Aperte</SelectItem>
              <SelectItem value="waiting">In attesa cliente</SelectItem>
              <SelectItem value="completed">Completate</SelectItem>
            </SelectContent>
          </Select>
          <Button className="ml-auto" onClick={onNew}>
            <Plus />
            Nuova attività
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  {[
                    "Attività",
                    "Tipo",
                    "Stato",
                    "Responsabile",
                    "Priorità",
                    "Scadenza",
                    "Progetto collegato",
                    "Azioni",
                  ].map((item) => (
                    <th key={item} className="p-3">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((activity) => {
                  const project =
                    store.projects.find(
                      (item) => item.id === activity.projectId,
                    ) ??
                    store.projects.find(
                      (item) =>
                        item.clientId === clientId &&
                        item.activityIds.includes(activity.id),
                    );
                  return (
                    <tr
                      key={activity.id}
                      className="cursor-pointer border-b hover:bg-muted/40"
                      onClick={() => openActivity(activity.id)}
                    >
                      <td className="p-3">
                        <p className="font-medium">{activity.title}</p>
                        <p className="max-w-64 truncate text-xs text-muted-foreground">
                          {activity.description || "—"}
                        </p>
                      </td>
                      <td>
                        <Badge variant="secondary">{activity.type}</Badge>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <Select
                          value={activity.status}
                          onValueChange={(value) =>
                            change(
                              activity.id,
                              value as CustomerActivity["status"],
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        {identity.users.find(
                          (item) => item.id === activity.assigneeId,
                        )?.name ?? "Non assegnato"}
                      </td>
                      <td>
                        <Badge variant="secondary">{activity.priority}</Badge>
                      </td>
                      <td>
                        {formatItalianDate(activity.dueAt)}
                        <span className="block text-xs">
                          {complete(activity)
                            ? "Completata"
                            : formatRelativeDeadline(activity.dueAt)}
                        </span>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        {project ? (
                          <Link
                            href={`/dashboard/progetti/${project.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {project.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            Nessun progetto
                          </span>
                        )}
                      </td>
                      <td
                        className="p-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActivity(activity.id)}
                        >
                          Apri
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => openActivity(activity.id)}
                            >
                              Apri
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => change(activity.id, "Completata")}
                            >
                              Segna come completata
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <ActivityDetailSheet
        key={activeActivityId ?? "empty"}
        clientId={clientId}
        activityId={activeActivityId}
        open={Boolean(activeActivityId)}
        onOpenChange={(open) =>
          !open &&
          (activityId
            ? setDismissedActivityId(activityId)
            : setSelectedId(null))
        }
      />
    </div>
  );
}
