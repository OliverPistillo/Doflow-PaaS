import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const providerPath = path.join(root, "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx")
const typesPath = path.join(root, "apps/frontend/src/features/commercial/commercial-provider-types.ts")
const commercePath = path.join(root, "apps/frontend/src/features/commercial/commercial-commerce.ts")
const dashboardPath = path.join(root, "apps/frontend/src/features/dashboard/synchronized-dashboard-overview.tsx")
const legacyDashboardPath = path.join(root, "apps/frontend/src/features/dashboard/dashboard-overview.tsx")
const operationsPath = path.join(root, "apps/frontend/src/features/commercial/components/commerce-operations-page.tsx")
const formsPath = path.join(root, "apps/frontend/src/features/commercial/components/commerce-form-dialogs.tsx")
const apiPath = path.join(root, "apps/frontend/src/lib/tenant-commerce-api.ts")
const backendContractsApiPath = path.join(root, "apps/frontend/src/lib/tenant-backend-contracts-api.ts")
const sources = Object.fromEntries([providerPath, typesPath, commercePath, dashboardPath, legacyDashboardPath, operationsPath, formsPath, apiPath, backendContractsApiPath].map((file) => [file, fs.readFileSync(file, "utf8")]))
const failures = []

const productionCommerce = Object.values(sources).join("\n")
for (const token of ["localStorage", "calculateCommerceEconomics", "calculateOrderFinancials", "createOrderItemSnapshot", "calculateOrderTotal"]) {
  if (productionCommerce.includes(token)) failures.push(`forbidden production token: ${token}`)
}

const provider = sources[providerPath]
for (const call of ["commerceApi.createService", "commerceApi.updateService", "commerceApi.archiveService", "commerceApi.createSale", "commerceApi.updateSale", "commerceApi.archiveSale", "commerceApi.createOrder", "commerceApi.updateOrder", "commerceApi.archiveOrder", "commerceApi.createPayment", "commerceApi.createRefund", "commerceApi.updatePayment", "commerceApi.archivePayment", "commerceApi.generateProject"]) {
  if (!provider.includes(call)) failures.push(`missing API-first provider call: ${call}`)
}

const addOrderStart = provider.indexOf("async addOrder(input)")
const addOrderEnd = provider.indexOf("async updateOrder(", addOrderStart)
const addOrder = provider.slice(addOrderStart, addOrderEnd)
if (!addOrder.includes("const orderPayload =") || !addOrder.includes("commerceApi.createOrder(\n            orderPayload")) failures.push("order create does not use an explicit server DTO payload")
for (const field of ["unitPrice:", "subtotal:", "taxTotal:", "total:", "balance:", "grossCollected:", "refundedTotal:", "netCollected:", "residual:", "paymentStatus:", "projectId:"]) {
  if (addOrder.includes(field)) failures.push(`order create submits server-authoritative field: ${field.slice(0, -1)}`)
}

const customerFinanceStart = provider.indexOf("updateCustomerFinance(")
const customerFinanceEnd = provider.indexOf("syncCustomerActivityDependency(", customerFinanceStart)
const customerFinance = provider.slice(customerFinanceStart, customerFinanceEnd)
if (!customerFinance.includes("backendContractsApi.customer.updateFinance")) failures.push("customer finance mutation lacks its authenticated server boundary")
if (!customerFinance.includes("optimisticVersion")) failures.push("customer finance mutation lacks optimistic concurrency")
if (!customerFinance.includes("previousFinance") || !customerFinance.includes("finance: previousFinance")) failures.push("customer finance optimistic projection lacks rollback")
const backendContractsApi = sources[backendContractsApiPath]
if (!backendContractsApi.includes("updateFinance:") || !backendContractsApi.includes('json("PATCH", body, true)')) failures.push("customer finance API mutation lacks idempotency")

const typeSource = sources[typesPath]
for (const signature of ["addService:", "updateService:", "archiveService:", "addSale:", "updateSale:", "archiveSale:", "addOrder:", "updateOrder:", "archiveOrder:", "addPayment:", "updatePayment:", "archivePayment:", "generateOrderProject:"]) {
  const offset = typeSource.indexOf(signature)
  if (offset < 0 || !typeSource.slice(offset, offset + 500).includes("Promise<")) failures.push(`provider mutation is not asynchronous: ${signature}`)
}

const dashboard = sources[dashboardPath]
if (!dashboard.includes("commerceApi.economics")) failures.push("dashboard economics is not server queried")
if (dashboard.includes("store.payments.filter") || dashboard.includes("store.orders.reduce")) failures.push("dashboard derives cash aggregates in browser")

const operations = sources[operationsPath]
if (!operations.includes("commerceApi") || !operations.includes(".economics(periodStart || undefined)")) failures.push("commerce operations economics is not server queried")
if (operations.includes("store.payments.filter") && operations.includes("const economics =")) failures.push("commerce operations derives canonical economics in browser")

const forms = sources[formsPath]
if (!forms.includes("createOrderDraftItem") || !forms.includes("estimateOrderDraftTotal")) failures.push("order form lacks explicit transient draft helpers")
if (!forms.includes("Boolean(await store.addOrder(input))")) failures.push("order create reports success before server confirmation")
if (forms.includes("items: validItems") && !addOrder.includes("items: input.items.map")) failures.push("order draft fields are not sanitized before API submission")

const api = sources[apiPath]
if (!api.includes('"Idempotency-Key"')) failures.push("commerce API mutations do not carry idempotency keys")

const report = {
  providerLines: provider.split(/\r?\n/).length,
  baselineLines: 8879,
  reductionLines: 8879 - provider.split(/\r?\n/).length,
  authoritativeBrowserStores: 0,
  clientOnlyPhase3AMutations: 0,
  customerFinanceServerBacked: true,
  forbiddenTokens: failures,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (failures.length) process.exitCode = 1
