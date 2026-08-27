import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

const api = read("apps/frontend/src/lib/tenant-feature-api.ts");
const inbox = read("apps/frontend/src/components/tenant-inbox/tenant-inbox-page.tsx");
const teamSpace = read("apps/frontend/src/components/tenant-collaboration/team-space-collaboration.tsx");
const presence = read("apps/frontend/src/components/tenant-collaboration/team-space-presence.tsx");
const callPanel = read("apps/frontend/src/components/tenant-collaboration/livekit-call-panel.tsx");
const flowboardList = read("apps/frontend/src/components/tenant-flowboard/flowboard-list.tsx");
const flowboardEditor = read("apps/frontend/src/components/tenant-flowboard/flowboard-editor.tsx");
const bonus = read("apps/frontend/src/components/tenant-bonus/bonus-page.tsx");
const intelligence = [
  read("apps/frontend/src/features/company-intelligence/company-intelligence-page.tsx"),
  read("apps/frontend/src/features/company-intelligence/company-intelligence-provider.tsx"),
].join("\n");
const experience = read("apps/frontend/src/components/flow-experience/flow-experience.tsx");
const preferencesContext = read("apps/frontend/src/components/flow-experience/flow-preferences-context.tsx");
const tenantFetch = read("apps/frontend/src/lib/tenant-fetch.ts");
const tenantShell = read("apps/frontend/src/components/layout/tenant-app-shell.tsx");
const appSidebar = read("apps/frontend/src/components/app-sidebar.tsx");
const tenantNavigation = read("apps/frontend/src/config/tenant-navigation.ts");
const assetManifest = read("apps/frontend/src/components/flow-experience/flow-assets.ts");
const guidedCall = read("apps/frontend/src/features/commercial/components/guided-call-sheet.tsx");
const guidedCallModel = read("apps/frontend/src/features/commercial/commercial-guided-calls.ts");
const commercialStageAdapter = read("apps/frontend/src/features/commercial/pipeline-stages.ts");
const commercialProvider = read("apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx");
const leadDetailActions = read("apps/frontend/src/features/commercial/components/lead-detail/lead-detail-actions.tsx");
const leadDetailPage = read("apps/frontend/src/features/commercial/components/lead-detail/lead-detail-page.tsx");
const leadDocumentCenter = read("apps/frontend/src/features/commercial/components/lead-commercial-path.tsx");

test("tenant feature routes resolve to server-backed feature components", () => {
  const routes = new Map([
    ["apps/frontend/src/app/(tenant)/dashboard/inbox/page.tsx", "CustomerInboxPage"],
    ["apps/frontend/src/app/(tenant)/dashboard/flowboard/page.tsx", "FlowboardHomePage"],
    ["apps/frontend/src/app/(tenant)/dashboard/flowboard/[id]/page.tsx", "FlowboardEditorPage"],
    ["apps/frontend/src/app/(tenant)/dashboard/company-intelligence/page.tsx", "CompanyIntelligencePage"],
    ["apps/frontend/src/app/(tenant)/dashboard/bonus/page.tsx", "BonusPage"],
  ]);
  for (const [file, component] of routes) {
    assert.ok(existsSync(path.join(root, file)), file);
    assert.match(read(file), new RegExp(component), file);
  }
});

test("Inbox uses the existing notification authority and contains no fixture source", () => {
  assert.match(inbox, /tenant-notifications-api/);
  assert.match(inbox, /listTenantNotifications/);
  assert.match(inbox, /markTenantNotificationRead/);
  assert.match(inbox, /status:\s*filter === "unread"/);
  assert.doesNotMatch(inbox + api, /tenant\/collaboration\/inbox/);
  assert.doesNotMatch(inbox, /MESSAGES_DATA|Demo data|localStorage|sessionStorage/);
});

test("collaboration client preserves tenant server authority and rich-message contracts", () => {
  for (const contract of [
    /\/tenant\/collaboration\/conversations/,
    /\/messages/,
    /\/reactions/,
    /\/read/,
    /\/revisions/,
    /\/tenant\/collaboration\/presence/,
    /Idempotency-Key/,
    /parentMessageId/,
    /mentionUserIds/,
    /attachmentMetadata/,
  ]) {
    assert.match(api, contract);
  }
  assert.doesNotMatch(api + teamSpace + presence, /[?&](userId|tenantId)=|localStorage|sessionStorage/);
  assert.match(teamSpace, /updateMessage/);
  assert.match(teamSpace, /deleteMessage/);
  assert.match(teamSpace, /toggleReaction/);
  assert.match(teamSpace, /replyTo/);
  assert.match(teamSpace, /mentionIds/);
  assert.match(teamSpace, /receipt\.readAt/);
  assert.match(teamSpace, /const previousById = new Map/);
  assert.match(teamSpace, /participants: item\.participants\?\.length \? item\.participants : previous\.participants/);
  assert.match(teamSpace, /await loadConversations\(\);\s*await loadConversation\(selectedId\);/);
});

test("LiveKit callers stay absent when the server feature flag is off", () => {
  assert.match(api, /\/tenant\/collaboration\/calls\/status/);
  assert.match(api, /\/tenant\/collaboration\/calls\/token/);
  assert.match(api, /\/tenant\/collaboration\/calls\/" \+ encodeURIComponent\(callId\)/);
  assert.match(teamSpace, /\{callStatus\.enabled \? \([\s\S]*<LiveKitCallPanel/);
  assert.match(callPanel, /if \(!status\.enabled\) return null/);
  assert.match(callPanel, /RoomEvent\.Reconnecting/);
  assert.match(callPanel, /setMicrophoneEnabled/);
  assert.match(callPanel, /setCameraEnabled/);
  assert.match(callPanel, /setScreenShareEnabled/);
  assert.match(api, /canPublish: row\.canPublish/);
  assert.match(callPanel, /const canPublish = nextAccess\.canPublish !== false/);
  assert.match(callPanel, /if \(canPublish\) \{/);
  assert.match(callPanel, /Partecipazione in ascolto/);
  assert.doesNotMatch(api + callPanel, /NEXT_PUBLIC_LIVEKIT|LIVEKIT_API_SECRET|LIVEKIT_API_KEY/);

  const dashboardRoot = path.join(root, "apps/frontend/src/app/(tenant)/dashboard");
  const routeNames = readdirSync(dashboardRoot, { recursive: true }).map(String);
  assert.equal(routeNames.some((entry) => /(^|[\\/])(call|calls|video-call)([\\/]|$)/i.test(entry)), false);
});

test("Flowboard uses XYFlow and optimistic server persistence", () => {
  assert.match(flowboardEditor, /from "@xyflow\/react"/);
  assert.match(flowboardEditor, /ReactFlow/);
  assert.match(flowboardEditor, /colorMode=\{resolvedTheme === "dark" \? "dark" : "light"\}/);
  assert.match(flowboardEditor, /flowboardApi\.save/);
  assert.match(api, /async update\(id/);
  assert.match(api, /collaborators/);
  assert.match(api, /\/tenant\/flowboards\/" \+ encodeURIComponent\(id\) \+ "\/save"/);
  assert.match(api, /optimisticVersion:\s*body\.revision/);
  assert.match(api, /raw\.comments/);
  assert.match(flowboardEditor, /flowboardApi\.comment/);
  assert.match(flowboardEditor, /Condividi Flowboard/);
  assert.match(flowboardEditor, /teamApi\.members/);
  assert.match(flowboardList, /useOptionalTenantAccess/);
  assert.match(flowboardList, /hasCapability\("canCreateProject"\)/);
  assert.match(flowboardList, /tenantAccess\?\.canCreate\("projects"\)/);
  assert.match(flowboardList, /\{canCreateBoard \? \(/);
  assert.match(flowboardEditor, /hasCapability\("canEditProject"\)/);
  assert.match(flowboardEditor, /tenantAccess\?\.canUpdate\("projects"\)/);
  assert.match(flowboardEditor, /const canEdit = Boolean\(board && board\.role !== "viewer" && canUpdateBoard\)/);
  assert.match(flowboardEditor, /const canCreateComment =/);
  assert.match(flowboardEditor, /\{canCreateComment \? \(/);
  assert.doesNotMatch(flowboardEditor + api, /localStorage|sessionStorage|Prisma|sqlite/i);
});

test("Bonus normalization maps the PostgreSQL ledger and never fabricates a wallet", () => {
  assert.match(api, /walletRow\.balance/);
  assert.match(api, /item\.points \?\? item\.amount/);
  assert.match(api, /item\.created_at/);
  assert.match(api, /\/tenant\/bonus\/requests/);
  assert.match(bonus, /bonusApi\.dashboard/);
  assert.match(bonus, /bonusApi\.request/);
  for (const contract of [
    /bonusApi\.decide/,
    /bonusApi\.adjustment/,
    /bonusApi\.policy/,
    /bonusApi\.consolidate/,
    /pendingRequests/,
    /canManage/,
    /currentUserId/,
  ]) assert.match(bonus + api, contract);
  assert.match(bonus, /request\.userId !== dashboard\.currentUserId/);
  assert.doesNotMatch(bonus + api, /arcade|flow.breaker|grantArcade/i);
  assert.doesNotMatch(bonus, /const\s+(wallet|ledger|requests)\s*=\s*\[/);
});

test("guided commercial calls use the server workflow aggregate while LiveKit remains independent", () => {
  assert.match(guidedCallModel, /guidedCallPhases/);
  assert.match(guidedCallModel, /guidedCallOutcomes/);
  assert.match(guidedCall, /store\.startGuidedCall/);
  assert.match(guidedCall, /store\.updateGuidedCall/);
  assert.match(guidedCall, /store\.completeGuidedCall/);
  const guidedStart = commercialProvider.indexOf("startGuidedCall(leadId)");
  const guidedBoundary = commercialProvider.slice(
    guidedStart,
    commercialProvider.indexOf("async updateRankingConfig", guidedStart),
  );
  assert.match(guidedBoundary, /backendContractsApi\.guidedCalls\.create/);
  assert.match(guidedBoundary, /backendContractsApi\.guidedCalls\.update/);
  assert.match(guidedBoundary, /backendContractsApi\.guidedCalls\.message/);
  assert.match(guidedBoundary, /backendContractsApi\.guidedCalls\.messageStatus/);
  assert.match(guidedBoundary, /backendContractsApi\.guidedCalls\.complete/);
  assert.match(guidedBoundary, /optimisticVersion/);
  assert.match(guidedBoundary, /setGuidedCalls/);
  assert.doesNotMatch(guidedBoundary, /BLOCKED — MISSING PERSISTENCE CONTRACT/);
  assert.doesNotMatch(guidedCall + guidedCallModel, /localStorage|sessionStorage|indexedDB|Prisma|sqlite/i);
});

test("commercial lead actions wait for real CRM, collaboration and quote authorities", () => {
  assert.match(leadDetailActions, /await onSave/);
  assert.match(leadDetailActions, /await onChangeOutcome/);
  assert.match(leadDetailPage, /params\.set\("collaboration", `lead:\$\{lead\.id\}`\)/);
  assert.match(leadDetailPage, /commercialStore\.moveLead/);
  assert.match(leadDocumentCenter, /store\.quotes/);
  assert.match(leadDocumentCenter, /await store\.updateQuote/);
  assert.match(leadDocumentCenter, /await store\.createQuoteVersion/);
  assert.match(leadDocumentCenter, /await store\.addQuote/);
  assert.doesNotMatch(leadDocumentCenter, /updateLead\([^\n]*proposal/);
  assert.doesNotMatch(leadDetailActions + leadDocumentCenter, /sarà disponibile nella prossima fase|window\.setTimeout/);
  assert.match(commercialProvider, /async updateLead\(/);
  assert.match(commercialProvider, /commercialApi\.updateOpportunity/);
  assert.match(commercialProvider, /documentRevenueApi\.createQuote/);
  assert.match(commercialProvider, /return true;[\s\S]*catch \(error\)[\s\S]*return false;/);
});

test("canonical commercial rows without ui_stage map to deterministic reference columns", () => {
  for (const [canonical, ui] of [
    ["contacted", "qualified"],
    ["appointment", "proposal"],
    ["quote", "proposal"],
    ["closed-won", "won"],
    ["paused", "follow-up"],
  ]) {
    assert.match(commercialStageAdapter, new RegExp(`"?${canonical}"?:\\s*"${ui}"`));
  }
  assert.match(commercialStageAdapter, /canonicalStageFallbacks\[normalized\]/);
});

test("Company Intelligence handles a missing provider and persists supported mutations", () => {
  assert.match(api, /\/tenant\/company-intelligence/);
  assert.match(api, /domain:\s*body\.requestedUrl/);
  assert.match(api, /raw\.report === null && raw\.configured === false/);
  assert.match(intelligence, /companyIntelligenceApi\.list/);
  assert.match(intelligence, /companyIntelligenceApi\.analyze/);
  assert.match(intelligence, /if \(!report\) return \{ ok: false, message: "Provider di analisi non configurato" \}/);
  for (const mutation of [
    /companyIntelligenceApi\.share/,
    /companyIntelligenceApi\.revokeShare/,
    /companyIntelligenceApi\.addCompetitor/,
    /companyIntelligenceApi\.removeCompetitor/,
    /companyIntelligenceApi\.exportReport/,
    /companyIntelligenceApi\.remove/,
  ]) assert.match(intelligence, mutation);
  assert.match(intelligence, /await refresh\(\)/);
  assert.doesNotMatch(intelligence, /BLOCKED — MISSING PERSISTENCE CONTRACT/);
  assert.match(intelligence, /hasCapability\("canViewCompanyIntelligence"\)/);
  assert.match(intelligence, /if \(!canView\)/);
  assert.match(intelligence, /activeModules\.has\("crm\.sales-intel"\)/);
  assert.match(intelligence, /hasCapability\("canRunCompanyIntelligence"\)/);
  for (const contract of [
    /shortDescription/,
    /employeeCount/,
    /annualRevenue/,
    /techStack/,
    /fundingEvents/,
    /people/,
    /Qualità sito/,
    /Identità e presenza/,
  ]) assert.match(api + intelligence, contract);
  assert.doesNotMatch(intelligence, /fake|mock|demo/i);
  assert.doesNotMatch(intelligence, /const\s+reports\s*=\s*\[/);
  assert.match(appSidebar, /item\.url !== "\/dashboard\/company-intelligence" \|\| activeModules\.has\("crm\.sales-intel"\)/);
  assert.match(tenantNavigation, /featureKey: "crm\.sales-intel"/);
  assert.match(tenantShell, /activeModules\.has\("crm\.sales-intel"\)/);
});

test("preferences and releases unwrap the actual backend envelopes", () => {
  assert.match(api, /raw\.preferences \|\| raw/);
  assert.match(api, /raw\.after \|\| raw\.preferences \|\| raw/);
  assert.match(api, /completedTours/);
  assert.match(api, /contextualMascotEnabled/);
  assert.match(api, /nested\.releases/);
  assert.match(preferencesContext, /preferencesApi\.get/);
  assert.match(preferencesContext, /preferencesApi\.update/);
  assert.match(tenantShell, /FlowExperiencePreferencesProvider/);
  for (const preference of [
    /data-flow-animations/,
    /data-flow-reduced-motion/,
    /data-flow-illustrated-empty-states/,
    /data-flow-suggestions/,
    /data-flow-contextual-assistant/,
  ]) assert.match(preferencesContext, preference);
  assert.match(experience, /preferences\?\.illustratedEmptyStates !== false/);
  assert.match(experience, /preferences\.suggestionsEnabled === false/);
  assert.match(experience, /preferences\?\.contextualAssistant !== false/);
  assert.match(experience, /releasesApi\.list/);
  assert.match(experience, /releasesApi\.read/);
  assert.doesNotMatch(experience + api, /localStorage|sessionStorage/);
});

test("shared app hosts never spoof public after an authenticated navigation", () => {
  assert.match(tenantFetch, /hostTenant === "public"\) return isAuthOrPublicPath\(pathname\) \? "public" : null/);
  assert.match(tenantFetch, /x-doflow-tenant-id/);
  assert.doesNotMatch(tenantFetch, /hostTenant === "public"\) return "public"/);
});

test("only the allowlisted non-Arcade Flow assets are present", () => {
  const expected = [
    "emoji/flow-celebrate.webp",
    "empty-states/flow-empty-chat.webp",
    "empty-states/flow-empty-notifications.webp",
    "empty-states/flow-empty-projects.webp",
    "empty-states/flow-empty-search.webp",
    "mascot/flow-default.webp",
    "mascot/flow-support.webp",
    "stickers/communication/flow-applause.webp",
    "stickers/crm/flow-deal-won.webp",
    "stickers/work/flow-video-call.webp",
  ];
  for (const asset of expected) {
    assert.ok(existsSync(path.join(root, "apps/frontend/public/assets/flow", asset)), asset);
    assert.match(assetManifest, new RegExp(asset.replaceAll("/", "\\/").replace(".", "\\.")));
  }
  assert.doesNotMatch(assetManifest, /arcade|arena|breaker/i);
  assert.equal(existsSync(path.join(root, "apps/frontend/public/assets/flow/arcade")), false);
});

test("new feature surfaces use universal semantic UI tokens", () => {
  const source = [
    api,
    inbox,
    teamSpace,
    presence,
    callPanel,
    flowboardEditor,
    bonus,
    intelligence,
    experience,
    preferencesContext,
    guidedCall,
    guidedCallModel,
  ].join("\n");
  assert.doesNotMatch(source, /\bdf-|bg-white|text-slate-|border-slate-|bg-indigo-/);
  assert.doesNotMatch(source, /client.?portal|flow.?arcade/i);
});
