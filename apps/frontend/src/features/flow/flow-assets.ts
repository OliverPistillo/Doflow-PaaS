import manifest from "../../../public/assets/flow/manifest.json"

export type FlowAssetCategory = "mascot" | "emoji" | "onboarding" | "empty-states" | "system" | `stickers/${string}`
export type FlowAsset = {
  id: string
  name: string
  category: FlowAssetCategory
  path: string
  width: number
  height: number
  format: "webp"
  usage: string
  recommendedSize: string
  available: boolean
}

type ManifestAsset = { id?: unknown; name?: unknown; category?: unknown; path?: unknown; width?: unknown; height?: unknown; format?: unknown }

// Questi file sono presenti ma vuoti nel pacchetto consegnato. Restano nel manifest,
// ma non vengono mai montati per evitare immagini rotte o richieste 404.
export const unavailableFlowAssetIds = new Set(["flow-bug-fix", "flow-shush", "flow-cool", "flow-access-denied"])

const usageFor = (category: string) => category === "onboarding"
  ? "Tour e primo accesso"
  : category === "empty-states"
    ? "Stato vuoto contestuale"
    : category === "system"
      ? "Stato di sistema"
      : category.startsWith("stickers/")
        ? "Messaggio strutturato nella Chat"
        : "Assistenza contestuale"

const normalize = (value: ManifestAsset): FlowAsset | undefined => {
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.category !== "string" || typeof value.path !== "string" || typeof value.width !== "number" || typeof value.height !== "number" || value.format !== "webp") return undefined
  if (!value.path.startsWith("/assets/flow/") || value.path.includes("..")) return undefined
  return { id:value.id, name:value.name, category:value.category as FlowAssetCategory, path:value.path, width:value.width, height:value.height, format:"webp", usage:usageFor(value.category), recommendedSize:`${value.width}×${value.height}`, available:!unavailableFlowAssetIds.has(value.id) }
}

export const flowManifestVersion = typeof manifest.version === "number" ? manifest.version : 0
export const flowAssets = (Array.isArray(manifest.assets) ? manifest.assets : []).flatMap((asset) => normalize(asset) ?? [])

export const getFlowAsset = (id?: string) => id ? flowAssets.find((asset) => asset.id === id && asset.available) : undefined
export const getFlowAssetsByCategory = (category: FlowAssetCategory) => flowAssets.filter((asset) => asset.available && asset.category === category)
export const getFlowStickerPack = (pack: string) => getFlowAssetsByCategory(`stickers/${pack}`)

const mascotAssets = {
  default:"flow-tour-welcome", welcome:"flow-tour-welcome", thinking:"flow-thinking", working:"flow-working",
  success:"flow-secure-success", warning:"flow-warning", error:"flow-critical-error", support:"flow-integration-required", celebration:"flow-celebrate",
} as const

export type FlowMascotVariant = keyof typeof mascotAssets
export const getFlowMascot = (variant: FlowMascotVariant) => getFlowAsset(mascotAssets[variant])

// Il manifest v1 descrive le espressioni Flow nel pack emotions. Il pacchetto
// consegnato include anche le controparti ottimizzate per il picker /emoji/.
// La derivazione resta centralizzata qui e non viene duplicata nei componenti.
export const getFlowEmojiAssets = () => getFlowStickerPack("emotions").map((asset) => ({
  ...asset,
  category:"emoji" as const,
  path:asset.path.replace("/stickers/emotions/", "/emoji/"),
  usage:"Emoji proprietaria Flow",
}))

export const flowAssetById = getFlowAsset
