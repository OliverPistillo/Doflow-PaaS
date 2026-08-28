import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { shouldAutoOpenFlowWelcome } from "../../apps/frontend/src/lib/flow-preferences"
import {
  buildWhatsAppWebUrl,
  countUnreadInboxMessages,
  inboxChannels,
  type InboxMessage,
  type InboxReceipt,
} from "../../apps/frontend/src/features/inbox/customer-inbox"

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

test("welcome opens automatically only for the server-side not_started state", () => {
  assert.equal(shouldAutoOpenFlowWelcome("not_started"), true)
  assert.equal(shouldAutoOpenFlowWelcome("in_progress"), false)
  assert.equal(shouldAutoOpenFlowWelcome("dismissed"), false)
  assert.equal(shouldAutoOpenFlowWelcome("completed"), false)
  const provider = source("apps/frontend/src/features/flow/flow-experience-provider.tsx")
  assert.match(provider, /preferencesApi\.get\(\)/)
  assert.match(provider, /shouldAutoOpenFlowWelcome\(data\.onboardingStatus\)/)
  assert.match(provider, /onboardingStatus:"dismissed"/)
  assert.match(provider, /finish=useCallback\(\(status:"completed"\|"dismissed"="completed"\)/)
  assert.match(provider, /onboardingStatus:"not_started"/)
  assert.match(provider, /Reset tutorial non riuscito/)
})

test("Customer Inbox unread receipts persist independently per user", () => {
  const messages: InboxMessage[] = [
    { id: "m1", clientId: "m1", conversationId: "c1", direction: "incoming", channel: "email", sender: "Cliente", text: "Prima", attachments: [], status: "recorded", createdAt: "2026-08-28T08:00:00.000Z" },
    { id: "m2", clientId: "m2", conversationId: "c1", direction: "outgoing", channel: "email", sender: "Team", text: "Risposta", attachments: [], status: "sent", createdAt: "2026-08-28T08:05:00.000Z" },
    { id: "m3", clientId: "m3", conversationId: "c1", direction: "incoming", channel: "email", sender: "Cliente", text: "Nuova", attachments: [], status: "recorded", createdAt: "2026-08-28T08:10:00.000Z" },
  ]
  const receipts: InboxReceipt[] = [{ conversationId: "c1", userId: "user-a", readAt: "2026-08-28T08:06:00.000Z" }]
  assert.equal(countUnreadInboxMessages(messages, receipts, "c1", "user-a"), 1)
  assert.equal(countUnreadInboxMessages(messages, receipts, "c1", "user-b"), 2)
  assert.equal(countUnreadInboxMessages(messages, [{ conversationId: "c1", userId: "user-a", readAt: "2026-08-28T08:11:00.000Z" }], "c1", "user-a"), 0)
})

test("WhatsApp is a web handoff with an international number and Client Portal stays absent", () => {
  assert.equal(
    buildWhatsAppWebUrl("+39 333 123 4567", "Ciao Oliver"),
    "https://web.whatsapp.com/send?phone=393331234567&text=Ciao%20Oliver",
  )
  assert.equal(buildWhatsAppWebUrl("333 123 4567", "Ciao"), "https://web.whatsapp.com/send?phone=393331234567&text=Ciao")
  assert.equal(buildWhatsAppWebUrl("+44 20 7946 0958", "Hello"), "https://web.whatsapp.com/send?phone=442079460958&text=Hello")
  assert.equal(buildWhatsAppWebUrl("02 1234 5678", "Ciao"), "https://web.whatsapp.com/send?phone=390212345678&text=Ciao")
  assert.equal(inboxChannels.includes("portal" as never), false)
  const provider = source("apps/frontend/src/features/inbox/customer-inbox-provider.tsx")
  assert.match(provider, /addCustomerCommunication\(customer\.id[\s\S]*direction: "internal"[\s\S]*status: "recorded"/)
  assert.match(provider, /WhatsApp Web aperto\. Completa l'invio nella nuova scheda\./)
  assert.match(provider, /preserveDraft: true/)
  assert.doesNotMatch(provider, /delivered.*whatsapp|read.*whatsapp/i)
})

test("wide desktop and Pipeline retain their constrained controls while using the full card as drag handle", () => {
  const css = source("apps/frontend/src/app/doflow-reference.css")
  const dashboard = source("apps/frontend/src/features/dashboard/role-aware-dashboard.tsx")
  const pipeline = source("apps/frontend/src/features/commercial/components/commercial-pipeline-board.tsx")
  assert.match(css, /max-width: 120rem/)
  assert.match(css, /@media \(min-width: 1800px\)[\s\S]*width: 94%/)
  assert.doesNotMatch(css, /doflow-page-frame[\s\S]{0,100}max-width: 80rem/)
  assert.equal((dashboard.match(/className="shrink-0 rounded-lg"/g) || []).length, 3)
  assert.match(pipeline, /<article[\s\S]*\.\.\.\(!dragOverlay \? listeners : \{\}\)/)
  assert.match(pipeline, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/)
  assert.match(pipeline, /commercialApi\.reorderPipeline|reorderLead/)
})

test("notification bell uses new-since-seen while unread highlight remains read-based", () => {
  const menu = source("apps/frontend/src/components/notifications-menu.tsx")
  const hook = source("apps/frontend/src/hooks/use-doflow-notifications.ts")
  assert.match(menu, /const fresh = summary\.newNotifications/)
  assert.match(menu, /fresh > 0/)
  assert.match(menu, /!item\.read/)
  assert.match(hook, /markTenantNotificationsSeen/)
  assert.match(hook, /newNotifications: 0/)
})
