// apps/frontend/src/app/superadmin/sitebuilder/sitebuilder-client.tsx
"use client";

import React from 'react';
import SiteBuilderWizard from './SiteBuilderWizard';

export default function SitebuilderClient() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <SiteBuilderWizard />
    </main>
  );
}