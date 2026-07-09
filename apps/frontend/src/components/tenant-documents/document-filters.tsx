"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentFilters, DocumentFolder } from "@/lib/tenant-documents-api";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_ENTITY_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  categoryLabel,
  entityLabel,
  statusLabel,
  visibilityLabel,
} from "./document-utils";

type Props = {
  filters: DocumentFilters;
  folders: DocumentFolder[];
  canViewFinance: boolean;
  onChange: (filters: DocumentFilters) => void;
};

export function DocumentFiltersBar({ filters, folders, canViewFinance, onChange }: Props) {
  const update = (key: keyof DocumentFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const visibilities = canViewFinance ? DOCUMENT_VISIBILITIES : DOCUMENT_VISIBILITIES.filter((item) => item !== "finance");
  const categories = canViewFinance ? DOCUMENT_CATEGORIES : DOCUMENT_CATEGORIES.filter((item) => !["finance", "invoice", "receipt"].includes(item));

  return (
    <div className="grid gap-2 lg:grid-cols-[1.2fr_repeat(6,minmax(130px,1fr))]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={filters.search || ""}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Cerca titolo, file, descrizione..."
        />
      </div>
      <Select value={filters.folder_id || "__all__"} onValueChange={(value) => update("folder_id", value)}>
        <SelectTrigger><SelectValue placeholder="Cartella" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tutte le cartelle</SelectItem>
          {folders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.category || "__all__"} onValueChange={(value) => update("category", value)}>
        <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tutte le categorie</SelectItem>
          {categories.map((category) => <SelectItem key={category} value={category}>{categoryLabel(category)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.visibility || "__all__"} onValueChange={(value) => update("visibility", value)}>
        <SelectTrigger><SelectValue placeholder="Visibilità" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tutte le visibilità</SelectItem>
          {visibilities.map((visibility) => <SelectItem key={visibility} value={visibility}>{visibilityLabel(visibility)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.status || "active"} onValueChange={(value) => update("status", value)}>
        <SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tutti gli stati</SelectItem>
          {DOCUMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.entity_type || "__all__"} onValueChange={(value) => update("entity_type", value)}>
        <SelectTrigger><SelectValue placeholder="Entità" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tutte le entità</SelectItem>
          {DOCUMENT_ENTITY_TYPES.map((type) => <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={filters.date_from || ""} onChange={(event) => update("date_from", event.target.value)} />
        <Input type="date" value={filters.date_to || ""} onChange={(event) => update("date_to", event.target.value)} />
      </div>
    </div>
  );
}
