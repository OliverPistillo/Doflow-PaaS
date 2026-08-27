const integerFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 })
const compactCurrencyFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 0 })
const currencyFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always", maximumFractionDigits: 0 })
const percentFormatter = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 })

export const formatCurrency = (value: number) => currencyFormatter.format(value)
export const formatCurrencySuffix = (value: number) => {
  const parts = currencyFormatter.formatToParts(value)
  const currency = parts.find((part) => part.type === "currency")?.value ?? "€"
  const numeric = parts.filter((part) => part.type !== "currency" && part.type !== "literal").map((part) => part.value).join("")
  return `${numeric} ${currency}`
}
export const formatCompactCurrency = (value: number) => compactCurrencyFormatter.format(value)
export const formatInteger = (value: number) => integerFormatter.format(value)
export const formatPercent = (value: number) => percentFormatter.format(value)
