"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial";

type CalendarAppointmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
  defaultLeadId?: string;
  onCreated?: (appointmentId: string) => void;
};

export function CalendarAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultTime = "09:00",
  defaultLeadId = "",
  onCreated,
}: CalendarAppointmentDialogProps) {
  const { store, identity, leads, customers } = useAuthorizedCommercial();
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState(defaultLeadId);
  const [date, setDate] = useState(
    defaultDate ?? new Date().toISOString().slice(0, 10),
  );
  const [time, setTime] = useState(defaultTime);
  const savingRef = useRef(false);

  const close = () => {
    setTitle("");
    savingRef.current = false;
    onOpenChange(false);
  };

  const save = async () => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || !title.trim() || !date || !time || savingRef.current) return;
    savingRef.current = true;
    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    const customer = customers.find((item) => item.sourceLeadId === lead.id);
    const activityId = customer
      ? ((await store.addCustomerActivity(customer.id, {
          title: title.trim(),
          description: "Attività collegata ad appuntamento commerciale.",
          type: "Riunione",
          status: "Da fare",
          priority: "Media",
          assigneeId: identity.currentUserId,
          leadId: lead.id,
          dueAt: startsAt,
        })) ?? undefined)
      : undefined;
    const id = await store.addAppointment({
      title: title.trim(),
      startsAt,
      endsAt: new Date(
        new Date(startsAt).getTime() + 60 * 60_000,
      ).toISOString(),
      status: "scheduled",
      leadId: lead.id,
      customerId: customer?.id,
      assigneeId: identity.currentUserId,
      activityId,
    });
    savingRef.current = false;
    if (!id) {
      toast.error("Appuntamento non creato: verifica i permessi sul lead.");
      return;
    }
    toast.success("Appuntamento creato");
    onCreated?.(id);
    close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo appuntamento</DialogTitle>
          <DialogDescription>
            Data e ora sono precompilate; l’appuntamento usa gli stessi dati del
            Calendario operativo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label>
            Titolo
            <Input
              aria-label="Titolo appuntamento"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Label>
          <Label>
            Lead
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger aria-label="Lead appuntamento">
                <SelectValue placeholder="Seleziona lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.company} · {lead.firstName} {lead.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Label>
              Data
              <Input
                aria-label="Data appuntamento"
                value={date}
                type="date"
                onChange={(event) => setDate(event.target.value)}
              />
            </Label>
            <Label>
              Ora
              <Input
                aria-label="Ora appuntamento"
                value={time}
                type="time"
                onChange={(event) => setTime(event.target.value)}
              />
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annulla
          </Button>
          <Button disabled={!leadId || !title.trim()} onClick={save}>
            Crea appuntamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
