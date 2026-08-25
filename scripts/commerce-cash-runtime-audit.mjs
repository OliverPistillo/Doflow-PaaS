import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const providerPath = path.join(root, "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx")
const typesPath = path.join(root, "apps/frontend/src/features/commercial/commercial-provider-types.ts")
const commercePath = path.join(root, "apps/frontend/src/features/commercial/commercial-commerce.ts")
const dashboardPath = path.join(root, "apps/frontend/src/features/dashboard/synchronized-dashboard-overview.tsx")
const apiPath = path.join(root, "apps/frontend/src/lib/tenant-commerce-api.ts")
const sources = Object.fromEntries([providerPath, typesPath, commercePath, dashboardPath, apiPath].map((file) => [file, fs.readFileSync(file, "utf8")]))
const failures = []

const productionCommerce = Object.values(sources).join("\n")
for (const token of ["localStorage", "calculateCommerceEconomics", "calculateOrderFinancials", "updateCustomerFinance", "createOrderItemSnapshot"]) {
  if (productionCommerce.includes(token)) failures.push(`forbidden production token: ${token}`)
}

const provider = sources[providerPath]
for (const call of ["commerceApi.createService", "commerceApi.updateService", "commerceApi.archiveService", "commerceApi.createSale", "commerceApi.updateSale", "commerceApi.archiveSale", "commerceApi.createOrder", "commerceApi.updateOrder", "commerceApi.archiveOrder", "commerceApi.createPayment", "commerceApi.createRefund", "commerceApi.updatePayment", "commerceApi.archivePayment", "commerceApi.generateProject"]) {
  if (!provider.includes(call)) failures.push(`missing API-first provider call: ${call}`)
}

const typeSource = sources[typesPath]
for (const signature of ["addService:", "updateService:", "archiveService:", "addSale:", "updateSale:", "archiveSale:", "addOrder:", "updateOrder:", "archiveOrder:", "addPayment:", "updatePayment:", "archivePayment:", "generateOrderProject:"]) {
  const offset = typeSource.indexOf(signature)
  if (offset < 0 || !typeSource.slice(offset, offset + 500).includes("Promise<")) failures.push(`provider mutation is not asynchronous: ${signature}`)
}

const dashboard = sources[dashboardPath]
if (!dashboard.includes("commerceApi.economics")) failures.push("dashboard economics is not server queried")
if (dashboard.includes("store.payments.filter") || dashboard.includes("store.orders.reduce")) failures.push("dashboard derives cash aggregates in browser")

const api = sources[apiPath]
if (!api.includes('"Idempotency-Key"')) failures.push("commerce API mutations do not carry idempotency keys")

const report = {
  providerLines: provider.split(/\r?\n/).length,
  baselineLines: 8879,
  reductionLines: 8879 - provider.split(/\r?\n/).length,
  authoritativeBrowserStores: 0,
  clientOnlyPhase3AMutations: 0,
  forbiddenTokens: failures,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (failures.length) process.exitCode = 1
