"use client";

import { SiteProposalsAccessGate } from "./site-proposals-access-gate";
import { SiteProposalsList } from "./site-proposals-list";
import { SiteProposalNew } from "./site-proposal-new";
import { SiteProposalImportDetail } from "./site-proposal-import-detail";
import { SiteProposalDetail } from "./site-proposal-detail";

export function SiteProposalsUi({ view, id }: { view: "list" | "new" | "import" | "detail"; id?: string }) {
  return <SiteProposalsAccessGate>{view === "list" ? <SiteProposalsList /> : view === "new" ? <SiteProposalNew /> : view === "import" && id ? <SiteProposalImportDetail id={id} /> : id ? <SiteProposalDetail id={id} /> : null}</SiteProposalsAccessGate>;
}
