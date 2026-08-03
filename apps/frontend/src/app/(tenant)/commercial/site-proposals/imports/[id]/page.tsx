import { SiteProposalsUi } from "@/components/tenant-site-proposals/site-proposals-ui";
export default function SiteProposalImportPage({ params }: { params: { id: string } }) { return <SiteProposalsUi view="import" id={params.id} />; }
