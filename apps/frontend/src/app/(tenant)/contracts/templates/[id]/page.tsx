import { ContractTemplatesPage } from "@/components/tenant-contracts/contracts-core";

export default function Page({ params }: { params: { id: string } }) {
  return <ContractTemplatesPage templateId={params.id} />;
}
