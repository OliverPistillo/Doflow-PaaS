import { SiteProposalsAccessGate } from "@/components/tenant-site-proposals/site-proposals-access-gate";
import { SiteProposalThemes } from "@/components/tenant-site-proposals/site-proposal-themes";

export default function SiteProposalThemesPage() { return <SiteProposalsAccessGate><SiteProposalThemes /></SiteProposalsAccessGate>; }
