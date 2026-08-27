export const APP_VERSION = "1.0.0" as const
export const APP_VERSION_LABEL = "v1.0" as const
export const APP_PRODUCT_LABEL = `DoFlow ${APP_VERSION_LABEL}` as const
export const APP_RELEASE_DATE = "22 agosto 2026" as const
export const APP_RELEASE_TITLE = "Il tuo flusso operativo, finalmente unito" as const
export const APP_RELEASE_HIGHLIGHTS = [
  "Flusso Lead → Cliente → Progetto",
  "Calendario operativo",
  "Team Space",
  "Guida contestuale Flow",
  "Permessi coerenti per ruolo",
] as const

export function isSemver(value: string) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
}

export function displayVersion(value: string) {
  const [major, minor] = value.split(".")
  return `v${major}.${minor}`
}
