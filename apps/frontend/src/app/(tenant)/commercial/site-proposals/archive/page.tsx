import { SiteProposalsAccessGate } from "@/components/tenant-site-proposals/site-proposals-access-gate";
import { SiteProposalsArchive } from "@/components/tenant-site-proposals/site-proposals-archive";

export default function SiteProposalsArchivePage() {
  return <SiteProposalsAccessGate><SiteProposalsArchive /></SiteProposalsAccessGate>;
}
