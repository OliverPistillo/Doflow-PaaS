import { ContractDetailPage } from "@/components/tenant-contracts/contracts-core";

export default function Page({ params }: { params: { id: string } }) {
  return <ContractDetailPage contractId={params.id} />;
}
