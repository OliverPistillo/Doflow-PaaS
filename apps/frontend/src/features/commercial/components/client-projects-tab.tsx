"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  CheckSquare,
  FolderKanban,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CommercialProject,
  CustomerActivity,
  useCommercialLeads,
} from "@/features/commercial/components/commercial-leads-provider";
import { ProjectStatusBadge } from "@/features/commercial/components/project-status-badge";
import {
  getProjectStatusVisual,
  projectStatuses,
} from "@/features/commercial/commercial-production";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { formatItalianDate } from "@/lib/date";

const currency = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  maximumFractionDigits: 0,
});
const money = {
  format: (value: number | undefined) => currency.format(value ?? 0),
};
const types = [
  ["website", "Sito vetrina"],
  ["ecommerce", "E-commerce"],
  ["landing", "Landing page"],
  ["branding", "Branding"],
  ["marketing", "Campagna marketing"],
  ["maintenance", "Manutenzione"],
  ["consulting", "Consulenza"],
  ["other", "Altro"],
] as const;
const statuses = projectStatuses.map(
  (status) => [status, getProjectStatusVisual(status).label] as const,
);
const priorities = [
  ["low", "Bassa"],
  ["medium", "Media"],
  ["high", "Alta"],
  ["urgent", "Urgente"],
] as const;
const activityStatus = (activity: CustomerActivity) => activity.status;
const label = (items: readonly (readonly [string, string])[], value: string) =>
  items.find(([key]) => key === value)?.[1] ?? value;
type Form = Pick<
  CommercialProject,
  | "name"
  | "service"
  | "type"
  | "ownerId"
  | "status"
  | "priority"
  | "startDate"
  | "dueDate"
  | "description"
> & { agreedValue: string; supervisorId: string };

export function ClientProjectsTab({
  clientId,
  onGoToActivities,
}: {
  clientId: string;
  onGoToActivities: () => void;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  const customer = store.customers.find((item) => item.id === clientId);
  const projects = store.getProjectsByClientId(clientId);
  const [editing, setEditing] = useState<CommercialProject | null>(null);
  const [linking, setLinking] = useState<CommercialProject | null>(null);
  const [archiving, setArchiving] = useState<CommercialProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const activities = useMemo(
    () =>
      customer
        ? [
            ...(customer.onboardingActivity
              ? [customer.onboardingActivity]
              : []),
            ...(customer.activities ?? []),
          ]
        : [],
    [customer],
  );
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  if (!customer) return null;
  const defaults = (): Form => ({
    name: customer.profile.company,
    service: customer.profile.service,
    type: customer.profile.service.toLowerCase().includes("commerce")
      ? "ecommerce"
      : "website",
    ownerId: customer.profile.assigneeId,
    supervisorId: "none",
    status: "not_started",
    priority: "high",
    startDate: "",
    dueDate: "",
    description: "",
    agreedValue: String(customer.profile.value),
  });
  const openLink = (project: CommercialProject) => {
    setLinkedIds(project.activityIds);
    setLinking(project);
  };
  const saveLinks = async () => {
    if (!linking || saving) return;
    setSaving(true);
    await Promise.all([
      ...linkedIds.map((id) => store.linkActivityToProject(linking.id, id)),
      ...linking.activityIds
        .filter((id) => !linkedIds.includes(id))
        .map((id) => store.unlinkActivityFromProject(linking.id, id)),
    ]);
    setSaving(false);
    setLinking(null);
    toast.success("Attività collegate al progetto");
  };
  const saveForm = async (form: Form, isEdit: boolean) => {
    if (!form.name.trim() || saving) return;
    const agreedValue = Number(form.agreedValue);
    if (!Number.isFinite(agreedValue) || agreedValue < 0)
      return toast.error("Inserisci un valore valido");
    const { supervisorId, ...projectForm } = form;
    const requestedSupervisors = supervisorId === "none" ? [] : [supervisorId];
    const supervisorIds = identity.hasCapability("canManageRoles")
      ? requestedSupervisors
      : (editing?.supervisorIds ?? []);
    setSaving(true);
    const result =
      isEdit && editing
        ? await store.updateProject(editing.id, {
            ...projectForm,
            supervisorIds,
            agreedValue,
            memberIds: Array.from(
              new Set([...editing.memberIds, form.ownerId, ...supervisorIds]),
            ),
          })
        : await store.createProject({
            ...projectForm,
            supervisorIds,
            agreedValue,
            clientId,
            sourceLeadId: customer.sourceLeadId,
            memberIds: Array.from(new Set([form.ownerId, ...supervisorIds])),
            activityIds: [],
          });
    setSaving(false);
    if (!result) return toast.error("Progetto non salvato");
    toast.success(
      isEdit ? "Progetto aggiornato" : "Progetto creato correttamente",
    );
    setEditing(null);
    setCreating(false);
  };
  if (!projects.length)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <FolderKanban className="size-6" />
          </div>
          <div>
            <h2 className="font-semibold">Nessun progetto presente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea il primo progetto operativo per {customer.profile.company}.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={async () => {
                const id = await store.startCustomerOnboarding(clientId);
                if (id) toast.success("Onboarding e checklist iniziale creati");
              }}
            >
              <CheckSquare />
              Avvia onboarding guidato
            </Button>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus />
              Crea manualmente
            </Button>
            <Button variant="outline" onClick={onGoToActivities}>
              Vai alle attività
            </Button>
          </div>
          <ProjectFormDialog
            open={creating}
            onOpenChange={setCreating}
            initial={defaults()}
            mode="create"
            onSave={saveForm}
            saving={saving}
          />
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Progetti</h2>
          <p className="text-sm text-muted-foreground">
            {projects.length} progetto{projects.length === 1 ? "" : "i"}{" "}
            collegati al cliente.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Crea progetto
        </Button>
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {projects.map((project) => {
            const visual = getProjectStatusVisual(project.status);
            const StatusIcon = visual.icon;
            return (
              <div
                key={project.id}
                className="grid gap-3 p-4 text-sm md:grid-cols-[minmax(0,1.5fr)_170px_130px_120px_110px_auto] md:items-center"
              >
                <div className="min-w-0">
                  <Link
                    className="block truncate font-medium hover:underline"
                    href={`/dashboard/progetti/${project.id}`}
                  >
                    {project.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {label(types, project.type)} · {project.service}
                  </p>
                  <ProjectStatusBadge
                    status={project.status}
                    className="mt-2 md:hidden"
                  />
                </div>
                <Select
                  value={project.status}
                  onValueChange={(value) =>
                    store.updateProject(project.id, {
                      status: value as CommercialProject["status"],
                    })
                  }
                >
                  <SelectTrigger className={`h-8 ${visual.badgeClass}`}>
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusIcon className="size-3.5 shrink-0" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(([value, text]) => {
                      const option = getProjectStatusVisual(value);
                      const Icon = option.icon;
                      return (
                        <SelectItem key={value} value={value}>
                          <span className="flex items-center gap-2">
                            <Icon className="size-4" />
                            {text}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div>
                  {commercialTeam.find(
                    (member) => member.id === project.ownerId,
                  )?.name ?? "—"}
                </div>
                <Badge variant="secondary">
                  {label(priorities, project.priority)}
                </Badge>
                <div>
                  {project.dueDate
                    ? formatItalianDate(project.dueDate)
                    : "Non definita"}
                </div>
                <div className="flex items-center gap-2">
                  <span>{money.format(project.agreedValue)}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {project.activityIds.length} attività
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Azioni per ${project.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/progetti/${project.id}`}>
                          Apri progetto e fasi
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          setEditing(project);
                        }}
                      >
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          openLink(project);
                        }}
                      >
                        Collega attività
                      </DropdownMenuItem>
                      {project.status !== "delivered" &&
                      project.phases.length > 0 &&
                      project.phases.every(
                        (phase) => phase.status === "completed",
                      ) ? (
                        <DropdownMenuItem
                          onSelect={async () => {
                            const result = await store.deliverProject(project.id);
                            if (result.ok)
                              toast.success("Progetto consegnato");
                            else toast.error(result.message);
                          }}
                        >
                          Consegna progetto
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(event) => {
                          event.preventDefault();
                          setArchiving(project);
                        }}
                      >
                        <Archive />
                        Archivia
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <ProjectFormDialog
        key={editing?.id ?? (creating ? "new" : "closed")}
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        initial={editing ? toForm(editing) : defaults()}
        mode={editing ? "edit" : "create"}
        onSave={saveForm}
        saving={saving}
      />
      <LinkActivitiesDialog
        project={linking}
        activities={activities}
        projects={projects}
        selected={linkedIds}
        onToggle={(id, checked) =>
          setLinkedIds((current) =>
            checked
              ? [...new Set([...current, id])]
              : current.filter((item) => item !== id),
          )
        }
        onClose={() => setLinking(null)}
        onSave={saveLinks}
        saving={saving}
      />
      <AlertDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiviare questo progetto?</AlertDialogTitle>
            <AlertDialogDescription>
              Il progetto verrà archiviato, ma attività, cronologia e dati
              collegati non saranno eliminati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiving) {
                  store.archiveProject(archiving.id);
                  toast.success("Progetto archiviato");
                }
                setArchiving(null);
              }}
            >
              Archivia progetto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function toForm(project: CommercialProject): Form {
  return {
    name: project.name,
    service: project.service,
    type: project.type,
    ownerId: project.ownerId,
    supervisorId: project.supervisorIds?.[0] ?? "none",
    status: project.status,
    priority: project.priority,
    startDate: project.startDate ?? "",
    dueDate: project.dueDate ?? "",
    description: project.description ?? "",
    agreedValue: String(project.agreedValue ?? 0),
  };
}
function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  mode,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Form;
  mode: "create" | "edit";
  onSave: (form: Form, edit: boolean) => void;
  saving: boolean;
}) {
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  const [form, setForm] = useState(initial);
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Modifica progetto" : "Crea progetto"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome progetto">
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>
          <Field label="Servizio">
            <Input
              value={form.service}
              onChange={(event) => set("service", event.target.value)}
            />
          </Field>
          <Choice
            label="Tipo"
            value={form.type}
            items={types}
            onChange={(value) => set("type", value as Form["type"])}
          />
          <Choice
            label="Responsabile"
            value={form.ownerId}
            items={commercialTeam.map(
              (member) => [member.id, member.name] as const,
            )}
            onChange={(value) => set("ownerId", value)}
          />
          {identity.hasCapability("canManageRoles") && (
            <Choice
              label="Supervisore"
              value={form.supervisorId}
              items={[
                ["none", "Nessun supervisore"],
                ...commercialTeam.map(
                  (member) => [member.id, member.name] as const,
                ),
              ]}
              onChange={(value) => set("supervisorId", value)}
            />
          )}
          <Choice
            label="Stato"
            value={form.status}
            items={statuses}
            onChange={(value) => set("status", value as Form["status"])}
          />
          <Choice
            label="Priorità"
            value={form.priority}
            items={priorities}
            onChange={(value) => set("priority", value as Form["priority"])}
          />
          <Field label="Data di inizio">
            <Input
              type="date"
              value={form.startDate ?? ""}
              onChange={(event) => set("startDate", event.target.value)}
            />
          </Field>
          <Field label="Scadenza prevista">
            <Input
              type="date"
              value={form.dueDate ?? ""}
              onChange={(event) => set("dueDate", event.target.value)}
            />
          </Field>
          <Field label="Valore">
            <Input
              type="number"
              value={form.agreedValue}
              onChange={(event) => set("agreedValue", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Label>Descrizione</Label>
            <Textarea
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            disabled={saving || !form.name.trim()}
            onClick={() => onSave(form, mode === "edit")}
          >
            {saving
              ? "Salvataggio…"
              : mode === "edit"
                ? "Salva modifiche"
                : "Crea progetto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function LinkActivitiesDialog({
  project,
  activities,
  projects,
  selected,
  onToggle,
  onClose,
  onSave,
  saving,
}: {
  project: CommercialProject | null;
  activities: CustomerActivity[];
  projects: CommercialProject[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const commercialTeam = useCommercialTeam();
  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collega attività al progetto</DialogTitle>
          <DialogDescription>
            Seleziona le attività da collegare al progetto.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {activities.map((activity) => {
            const other = projects.find(
              (item) =>
                item.id !== project?.id &&
                item.activityIds.includes(activity.id),
            );
            return (
              <label
                key={activity.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <Checkbox
                  checked={selected.includes(activity.id)}
                  onCheckedChange={(checked) =>
                    onToggle(activity.id, checked === true)
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{activity.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {activityStatus(activity)} ·{" "}
                    {commercialTeam.find(
                      (member) => member.id === activity.assigneeId,
                    )?.name ?? "—"}{" "}
                    · {formatItalianDate(activity.dueAt)}
                  </span>
                  {other && (
                    <span className="block text-xs text-amber-600">
                      Collegata a {other.name}: verrà spostata alla conferma.
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button disabled={saving} onClick={onSave}>
            Collega selezionate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Field({
  label: text,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{text}</Label>
      {children}
    </div>
  );
}
function Choice({
  label: text,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{text}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
