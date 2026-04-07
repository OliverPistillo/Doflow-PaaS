// apps/frontend/src/app/superadmin/sitebuilder/sitebuilder-client.tsx
"use client";

import React from 'react';
import SiteBuilderWizard from './SiteBuilderWizard';

export default function SitebuilderClient() {
  return (
    // Qui puoi inserire eventuali context provider specifici per il sitebuilder
    // o un layout wrapper se serve, altrimenti renderizzi direttamente il Wizard.
    <div className="sitebuilder-container">
      <SiteBuilderWizard />
    </div>
  );
}