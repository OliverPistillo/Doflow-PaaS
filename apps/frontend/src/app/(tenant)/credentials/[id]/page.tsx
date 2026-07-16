import { CredentialDetailPage } from "@/components/tenant-credentials/credential-detail";

export default function CredentialDetailRoute({ params }: { params: { id: string } }) {
  return <CredentialDetailPage credentialId={params.id} />;
}

