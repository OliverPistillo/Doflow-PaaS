import { SiteProposalsUi } from "@/components/tenant-site-proposals/site-proposals-ui";
export default function SiteProposalDetailPage({ params }: { params: { id: string } }) { return <SiteProposalsUi view="detail" id={params.id} />; }
