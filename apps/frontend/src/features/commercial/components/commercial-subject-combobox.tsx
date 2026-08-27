"use client"

import { useMemo, useState } from "react"
import { ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { CommercialCustomer } from "@/features/commercial/components/commercial-leads-provider"
import type { CommercialLead } from "@/features/commercial/types"
import { cn } from "@/lib/utils"

type CommercialSubjectComboboxProps = {
  leads: CommercialLead[]
  customers: CommercialCustomer[]
  value: string
  onValueChange: (value: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  className?: string
}

type SubjectOption = {
  id: string
  kind: "lead" | "customer"
  name: string
  company: string
  contact: string
  searchValue: string
}

const normalizeSearchValue = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("it-IT")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()

const toOption = (lead: CommercialLead, kind: SubjectOption["kind"]): SubjectOption => {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim()
  const company = lead.company?.trim() ?? ""
  const contact = lead.email?.trim() || lead.phone?.trim() || "Nessun recapito"
  return {
    id: lead.id,
    kind,
    name: name || company || "Senza nome",
    company,
    contact,
    searchValue: normalizeSearchValue([name, company, lead.email, lead.phone].filter(Boolean).join(" ")),
  }
}

export function CommercialSubjectCombobox({
  leads,
  customers,
  value,
  onValueChange,
  id,
  disabled,
  placeholder = "Cerca lead o cliente…",
  className,
}: CommercialSubjectComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const options = useMemo(() => [
    ...leads
      .filter((lead) => !lead.archivedAt && !lead.mergedIntoId)
      .map((lead) => toOption(lead, "lead")),
    ...customers
      .filter((customer) => !customer.archivedAt && !customer.mergedIntoId && !customer.profile.archivedAt && !customer.profile.mergedIntoId)
      .map((customer) => toOption({ ...customer.profile, id: customer.id }, "customer")),
  ], [customers, leads])
  const selected = options.find((option) => option.id === value)
  const results = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query)
    if (!normalizedQuery) return []
    const tokens = normalizedQuery.split(" ").filter(Boolean)
    return options.filter((option) => tokens.every((token) => option.searchValue.includes(token))).slice(0, 10)
  }, [options, query])
  const leadResults = results.filter((option) => option.kind === "lead")
  const customerResults = results.filter((option) => option.kind === "customer")

  const choose = (option: SubjectOption) => {
    onValueChange(option.id)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery("") }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Lead o cliente"
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between font-normal", className)}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? `${selected.kind === "lead" ? "Lead" : "Cliente"} · ${selected.name}${selected.company && selected.company !== selected.name ? ` — ${selected.company}` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
            autoFocus
          />
          <CommandList className="max-h-80">
            {!query.trim() ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Digita un nome, un’azienda, un’email o un telefono.</p>
            ) : results.length === 0 ? (
              <CommandEmpty>Nessun risultato</CommandEmpty>
            ) : (
              <>
                {leadResults.length > 0 && <SubjectGroup heading="Lead" items={leadResults} selectedId={value} onSelect={choose} />}
                {customerResults.length > 0 && <SubjectGroup heading="Clienti" items={customerResults} selectedId={value} onSelect={choose} />}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function SubjectGroup({ heading, items, selectedId, onSelect }: { heading: string; items: SubjectOption[]; selectedId: string; onSelect: (option: SubjectOption) => void }) {
  return (
    <CommandGroup heading={heading}>
      {items.map((option) => (
        <CommandItem
          key={`${option.kind}-${option.id}`}
          value={`${option.kind}-${option.id}`}
          data-checked={selectedId === option.id}
          onSelect={() => onSelect(option)}
          className="min-h-12 items-start py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{option.name}{option.company && option.company !== option.name ? ` · ${option.company}` : ""}</p>
            <p className="truncate text-xs text-muted-foreground">{option.contact}</p>
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
