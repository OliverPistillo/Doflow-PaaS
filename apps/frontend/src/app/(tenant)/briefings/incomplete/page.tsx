import { BriefingListPage } from "@/components/tenant-crm/briefing-quotes";

export default function IncompleteBriefingsPage() {
  return (
    <BriefingListPage
      title="Briefing incompleti"
      description="Briefing in bozza, inviati o parzialmente completati."
      initialStatuses={["draft", "sent", "partially_completed"]}
    />
  );
}
