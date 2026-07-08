"use client";

import { Suspense } from "react";
import { ClientAcceptInvitePage } from "@/components/tenant-client-portal/client-portal-core";

export default function ClientAcceptInviteRoute() {
  return (
    <Suspense fallback={null}>
      <ClientAcceptInvitePage />
    </Suspense>
  );
}
