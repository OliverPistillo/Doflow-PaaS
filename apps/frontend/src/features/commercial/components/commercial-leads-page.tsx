"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Filter,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pipelineStages } from "@/features/commercial/data/commercial-fixtures";
import { LeadDialog } from "@/features/commercial/components/commercial-dashboard-refined";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import type {
  CommercialLead,
  PipelineStage,
} from "@/features/commercial/types";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  maximumFractionDigits: 0,
});
const stageName = (stage: PipelineStage) =>
  pipelineStages.find((entry) => entry.id === stage)?.label ?? stage;
const badgeClass: Record<PipelineStage, string> = {
  new: "bg-chart-2/10 text-chart-2",
  qualified: "bg-chart-1/10 text-chart-1",
  proposal: "bg-chart-4/10 text-chart-4",
  negotiation: "bg-destructive/10 text-destructive",
  won: "bg-chart-3/10 text-chart-3",
  unqualified: "bg-muted text-muted-foreground",
  "not-interested": "bg-muted text-muted-foreground",
  "follow-up": "bg-chart-2/10 text-chart-2",
  lost: "bg-destructive/10 text-destructive",
};
export function CommercialLeadsPage() {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const router = useRouter();
  const leads = store.leads.filter((lead) => !lead.archivedAt && !lead.mergedIntoId);
  const person = (id: string) => identity.users.find((member) => member.id === id);
  const sources = Array.from(new Set(leads.map((lead) => lead.source).filter(Boolean))).sort();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | PipelineStage>("all");
  const [assignee, setAssignee] = useState("all");
  const [source, setSource] = useState("all");
  const [range, setRange] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<CommercialLead | null>(null);
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = [...leads]
    .filter((lead) => {
          const match =
            `${lead.firstName} ${lead.lastName} ${lead.company} ${lead.email}`
              .toLowerCase()
              .includes(query.toLowerCase());
          const amount =
            range === "all" ||
            (range === "under5" && lead.value <= 5000) ||
            (range === "5to10" && lead.value > 5000 && lead.value <= 10000) ||
            (range === "10to25" && lead.value > 10000 && lead.value <= 25000) ||
            (range === "over25" && lead.value > 25000);
          return (
            match &&
            amount &&
            (stage === "all" || lead.stage === stage) &&
            (assignee === "all" || lead.assigneeId === assignee) &&
            (source === "all" || lead.source === source)
          );
    })
    .sort(
      (left, right) =>
        (left.lastContact > right.lastContact ? 1 : -1) *
        (sortAscending ? 1 : -1),
    );
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reset = () => {
    setQuery("");
    setStage("all");
    setAssignee("all");
    setSource("all");
    setRange("all");
    setPage(1);
  };
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const exportItems = (items: CommercialLead[]) => {
    const csv = [
      ["Nome", "Cognome", "Azienda", "Fonte", "Stato", "Valore"],
      ...items.map((lead) => [
        lead.firstName,
        lead.lastName,
        lead.company,
        lead.source,
        stageName(lead.stage),
        lead.value,
      ]),
    ]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "doflow-tutti-i-lead.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("CSV esportato");
  };
  const actions = (lead: CommercialLead) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Azioni ${lead.company}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setPreview(lead)}>
          Apri anteprima
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/commercial/leads/${lead.id}`)}>
          Modifica
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/attivita?create=1&leadId=${encodeURIComponent(lead.id)}`)}>
          Crea attività
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void store.updateLead(lead.id, { stage: "follow-up", status: "follow-up" })}
        >
          Cambia stato
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void store.updateLead(lead.id, { assigneeId: identity.currentUserId, owner: identity.currentUser.name })}>
          Assegna a
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => store.archiveLead(lead.id, "Archiviazione dalla lista reference") ? toast.success("Lead archiviato") : toast.error("Archiviazione non autorizzata")}
        >
          Archivia
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const filters = (
    <>
      <div className="relative min-w-56 flex-1">
        <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Cerca lead, azienda o email"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <Select
        value={stage}
        onValueChange={(value) => setStage(value as "all" | PipelineStage)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Stato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli stati</SelectItem>
          {pipelineStages.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={assignee} onValueChange={setAssignee}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Assegnato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti</SelectItem>
          {identity.users.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={source} onValueChange={setSource}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Fonte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le fonti</SelectItem>
          {sources.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={range} onValueChange={setRange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Valore" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti</SelectItem>
          <SelectItem value="under5">Fino a €5.000</SelectItem>
          <SelectItem value="5to10">€5.000–€10.000</SelectItem>
          <SelectItem value="10to25">€10.000–€25.000</SelectItem>
          <SelectItem value="over25">Oltre €25.000</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        onClick={() =>
          toast.info("Altri filtri disponibili nella prossima fase")
        }
      >
        <Filter />
        Altri filtri
      </Button>
      <Button variant="ghost" onClick={reset}>
        Azzera filtri
      </Button>
    </>
  );
  return (
    <main className="@container/main mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 @4xl/main:flex-row @4xl/main:items-end @4xl/main:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tutti i lead
          </h1>
          <p className="text-sm text-muted-foreground">
            Cerca, filtra e gestisci tutte le opportunità commerciali.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {leads.length} lead totali
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportItems(filtered)}>
            <Download />
            Esporta
          </Button>
          <LeadDialog
            onCreate={(lead) => void store.addLead(lead)}
          />
        </div>
      </header>
      <div className="grid min-w-0 gap-6 @6xl/main:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-4">
          <Card>
            <CardContent className="flex flex-wrap gap-2 p-4">
              {filters}
              <span className="self-center text-sm text-muted-foreground">
                {filtered.length} lead visualizzati su {leads.length}
              </span>
            </CardContent>
          </Card>
          {selected.length > 0 && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 p-3">
                <strong className="text-sm">
                  {selected.length} selezionati
                </strong>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void Promise.all(selected.map((id) => store.updateLead(id, { assigneeId: identity.currentUserId, owner: identity.currentUser.name }))).then(() => toast.success("Assegnazione aggiornata"));
                  }}
                >
                  Assegna
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void Promise.all(selected.map((id) => store.updateLead(id, { stage: "follow-up", status: "follow-up" }))).then(() => toast.success("Stato aggiornato"));
                  }}
                >
                  Cambia stato
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportItems(
                      leads.filter((lead) => selected.includes(lead.id)),
                    )
                  }
                >
                  Esporta selezionati
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    const archived = selected.filter((id) => store.archiveLead(id, "Archiviazione multipla dalla lista reference"));
                    setSelected([]);
                    if (archived.length === selected.length) toast.success("Lead archiviati");
                    else toast.error("Alcuni lead non sono stati archiviati");
                  }}
                >
                  Archivia
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Checkbox
                        checked={
                          visible.length > 0 &&
                          visible.every((lead) => selected.includes(lead.id))
                        }
                        onCheckedChange={(checked) =>
                          setSelected(
                            checked
                              ? Array.from(
                                  new Set([
                                    ...selected,
                                    ...visible.map((lead) => lead.id),
                                  ]),
                                )
                              : selected.filter(
                                  (id) =>
                                    !visible.some((lead) => lead.id === id),
                                ),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Azienda</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Assegnato a</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSortAscending((value) => !value)}
                      >
                        Valore {sortAscending ? <ArrowUp /> : <ArrowDown />}
                      </Button>
                    </TableHead>
                    <TableHead>Ultimo contatto</TableHead>
                    <TableHead>Prossima azione</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(lead.id)}
                          onCheckedChange={() => toggle(lead.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          className="flex items-center gap-2 text-left"
                          onClick={() => setPreview(lead)}
                        >
                          <Avatar size="sm">
                            <AvatarFallback>
                              {lead.firstName[0]}
                              {lead.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            <span className="block font-medium">
                              {lead.firstName} {lead.lastName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {lead.email}
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>
                        {lead.company}
                        <span className="block text-xs text-muted-foreground">
                          {lead.service}
                        </span>
                      </TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell>
                        <Badge className={`border-0 ${badgeClass[lead.stage]}`}>
                          {stageName(lead.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {person(lead.assigneeId)?.name}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {money.format(lead.value)}
                      </TableCell>
                      <TableCell>{lead.lastContact}</TableCell>
                      <TableCell>{lead.nextAction}</TableCell>
                      <TableCell>{actions(lead)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {visible.map((lead) => (
                <Card
                  key={lead.id}
                  onClick={() => setPreview(lead)}
                  className="cursor-pointer"
                >
                  <CardHeader className="p-4">
                    <div className="flex justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {lead.firstName} {lead.lastName}
                        </CardTitle>
                        <CardDescription>{lead.company}</CardDescription>
                      </div>
                      <Badge className={`border-0 ${badgeClass[lead.stage]}`}>
                        {stageName(lead.stage)}
                      </Badge>
                    </div>
                    <p className="font-semibold tabular-nums">
                      {money.format(lead.value)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {person(lead.assigneeId)?.name} · {lead.nextAction}
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
            {filtered.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nessun lead trovato</EmptyTitle>
                  <EmptyDescription>
                    Modifica i filtri per vedere le opportunità.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={reset}>Azzera filtri</Button>
                  <LeadDialog
                    onCreate={(lead) => void store.addLead(lead)}
                  />
                </EmptyContent>
              </Empty>
            )}
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {filtered.length} risultati
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Precedente
              </Button>
              <span className="text-sm">
                {page}/{maxPage}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page === maxPage}
                onClick={() => setPage((value) => value + 1)}
              >
                Successiva
              </Button>
            </div>
          </div>
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardDescription>Lead del mese</CardDescription>
              <CardTitle className="text-2xl">
                {
                  leads.filter((lead) => lead.createdAt.startsWith(new Date().toISOString().slice(0, 7)))
                    .length
                }
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Tasso di conversione</CardDescription>
              <CardTitle className="text-2xl">
                {(
                  (leads.filter((lead) => lead.stage === "won").length /
                    Math.max(1, leads.length)) *
                  100
                ).toFixed(1)}
                %
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Lead per stato</CardDescription>
              {pipelineStages.map((item) => (
                <p key={item.id} className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span>
                    {leads.filter((lead) => lead.stage === item.id).length}
                  </span>
                </p>
              ))}
            </CardHeader>
          </Card>
        </aside>
      </div>
      <Sheet
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {preview?.firstName} {preview?.lastName}
            </SheetTitle>
            <SheetDescription>{preview?.company}</SheetDescription>
          </SheetHeader>
          {preview && (
            <div className="space-y-3">
              <Badge className={`border-0 ${badgeClass[preview.stage]}`}>
                {stageName(preview.stage)}
              </Badge>
              <p>Valore: {money.format(preview.value)}</p>
              <p>Responsabile: {person(preview.assigneeId)?.name}</p>
              <p>Fonte: {preview.source}</p>
              <p>Email: {preview.email}</p>
              <p>Telefono: {preview.phone}</p>
              <p>Ultimo contatto: {preview.lastContact}</p>
              <p>Prossima attività: {preview.nextAction}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/commercial/leads/${preview.id}`)}
                >
                  Modifica
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/attivita?create=1&leadId=${encodeURIComponent(preview.id)}`)}
                >
                  Crea attività
                </Button>
                <Button
                  onClick={() => router.push(`/dashboard/commercial/leads/${preview.id}`)}
                >
                  Apri scheda completa
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
