import { Suspense } from "react";
import { CommercialPipelinePage } from "@/components/tenant-commercial/commercial-pipeline";

export default function PipelinePage() {
  return (
    <Suspense fallback={<main className="min-w-0 max-w-full px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8">Caricamento pipeline...</main>}>
      <CommercialPipelinePage />
    </Suspense>
  );
}
