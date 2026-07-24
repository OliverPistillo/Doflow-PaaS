import { DossierDetailPage } from "@/components/tenant-paperwork/paperwork-core";

export default function Page({ params }: { params: { id: string } }) {
  return <DossierDetailPage dossierId={params.id} />;
}
