"use client";

import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamMember, TeamWorkloadItem } from "@/lib/tenant-team-api";
import {
  AVAILABILITY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  OPERATIONAL_ROLE_LABELS,
  TENANT_ROLE_LABELS,
  availabilityBadgeClass,
  canManageTeam,
  label,
  roleBadgeClass,
} from "./team-utils";

export function TeamMembersList({
  members,
  workload,
  onDelete,
}: {
  members: TeamMember[];
  workload?: TeamWorkloadItem[];
  onDelete?: (member: TeamMember) => void;
}) {
  const workloadById = new Map((workload || []).map((item) => [item.team_member_id, item]));

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nessun membro team configurato.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {members.map((member) => {
        const load = workloadById.get(member.id);
        return (
          <Card key={member.id}>
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/team/members/${member.id}`} className="truncate text-base font-semibold text-primary hover:underline">
                    {member.display_name}
                  </Link>
                  <Badge variant="outline" className={roleBadgeClass(member.tenant_role)}>{label(TENANT_ROLE_LABELS, member.tenant_role)}</Badge>
                  <Badge variant="outline" className={availabilityBadgeClass(member.availability_status)}>{label(AVAILABILITY_LABELS, member.availability_status)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{member.email}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{label(OPERATIONAL_ROLE_LABELS, member.operational_role)}</span>
                  <span>·</span>
                  <span>{label(EMPLOYMENT_TYPE_LABELS, member.employment_type)}</span>
                  {member.capacity_hours_per_week ? <><span>·</span><span>{member.capacity_hours_per_week}h/settimana</span></> : null}
                  {load ? <><span>·</span><span>{load.openTasks} task aperti</span><span>·</span><span>{load.utilizationPercent}% carico</span></> : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(member.skill_items || []).slice(0, 5).map((skill) => <Badge key={skill.id} variant="outline">{skill.name}</Badge>)}
                  {(member.skills || []).slice(0, 5).map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link href={`/team/members/${member.id}`}><Eye className="mr-2 h-4 w-4" /> Apri</Link></Button>
                {canManageTeam() && onDelete ? (
                  <Button size="sm" variant="outline" onClick={() => onDelete(member)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
