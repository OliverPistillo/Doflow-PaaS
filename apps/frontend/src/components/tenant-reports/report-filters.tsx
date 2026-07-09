"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportParams } from "@/lib/tenant-reports-api";
import { getDefaultReportParams, GROUP_LABELS, label } from "./report-utils";

export function useReportParams(): ReportParams {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const defaults = getDefaultReportParams();
    return {
      date_from: searchParams.get("date_from") || defaults.date_from,
      date_to: searchParams.get("date_to") || defaults.date_to,
      group_by: searchParams.get("group_by") || defaults.group_by,
      compare_previous: searchParams.get("compare_previous") === "true",
      project_id: searchParams.get("project_id") || "",
      company_id: searchParams.get("company_id") || "",
      status: searchParams.get("status") || "",
      include_details: searchParams.get("include_details") === "true",
    };
  }, [searchParams]);
}

export function ReportFilters({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useReportParams();
  const [form, setForm] = useState({
    date_from: String(params.date_from || ""),
    date_to: String(params.date_to || ""),
    group_by: String(params.group_by || "month"),
    compare_previous: Boolean(params.compare_previous),
    project_id: String(params.project_id || ""),
    company_id: String(params.company_id || ""),
    status: String(params.status || ""),
    include_details: Boolean(params.include_details),
  });

  const apply = () => {
    const qs = new URLSearchParams();
    Object.entries(form).forEach(([key, value]) => {
      if (value === "" || value === false || value === "__all__") return;
      qs.set(key, String(value));
    });
    router.push(`${pathname}${qs.toString() ? `?${qs.toString()}` : ""}`);
  };

  const reset = () => {
    const defaults = getDefaultReportParams();
    setForm({
      date_from: String(defaults.date_from || ""),
      date_to: String(defaults.date_to || ""),
      group_by: "month",
      compare_previous: false,
      project_id: "",
      company_id: "",
      status: "",
      include_details: false,
    });
    router.push(pathname);
  };

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div className="grid gap-2">
          <Label>Da</Label>
          <Input type="date" value={form.date_from} onChange={(e) => setForm((p) => ({ ...p, date_from: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>A</Label>
          <Input type="date" value={form.date_to} onChange={(e) => setForm((p) => ({ ...p, date_to: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Raggruppa</Label>
          <Select value={form.group_by} onValueChange={(value) => setForm((p) => ({ ...p, group_by: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(GROUP_LABELS).map((value) => <SelectItem key={value} value={value}>{label(GROUP_LABELS, value)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {!compact ? (
          <div className="grid gap-2">
            <Label>Status</Label>
            <Input placeholder="accepted, blocked..." value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} />
          </div>
        ) : null}
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={form.compare_previous} onCheckedChange={(checked) => setForm((p) => ({ ...p, compare_previous: Boolean(checked) }))} />
            Confronta periodo
          </label>
          <div className="flex gap-2">
            <Button onClick={apply}><Filter className="mr-2 h-4 w-4" /> Applica</Button>
            <Button variant="outline" onClick={reset}>Reset</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

