import { ClientProjectDetailPage } from "@/components/tenant-client-portal/client-portal-core";

export default function ClientProjectDetailRoute({ params }: { params: { id: string } }) {
  return <ClientProjectDetailPage projectId={params.id} />;
}
