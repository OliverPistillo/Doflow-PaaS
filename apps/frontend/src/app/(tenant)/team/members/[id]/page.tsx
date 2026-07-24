import { TeamMemberDetailPage } from "@/components/tenant-team/team-member-detail";

export default function TeamMemberDetailRoute({ params }: { params: { id: string } }) {
  return <TeamMemberDetailPage memberId={params.id} />;
}
