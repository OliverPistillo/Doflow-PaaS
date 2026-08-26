export type FlowAssetId =
  | "assistant-default"
  | "assistant-support"
  | "empty-chat"
  | "empty-notifications"
  | "empty-projects"
  | "empty-search"
  | "emoji-celebrate"
  | "sticker-applause"
  | "sticker-deal-won"
  | "sticker-video-call";

export type FlowAsset = {
  id: FlowAssetId;
  kind: "mascot" | "empty-state" | "emoji" | "sticker";
  src: string;
  alt: string;
};

export const flowAssets: Record<FlowAssetId, FlowAsset> = {
  "assistant-default": {
    id: "assistant-default",
    kind: "mascot",
    src: "/assets/flow/mascot/flow-default.webp",
    alt: "Assistente Flow",
  },
  "assistant-support": {
    id: "assistant-support",
    kind: "mascot",
    src: "/assets/flow/mascot/flow-support.webp",
    alt: "Assistente Flow pronto ad aiutare",
  },
  "empty-chat": {
    id: "empty-chat",
    kind: "empty-state",
    src: "/assets/flow/empty-states/flow-empty-chat.webp",
    alt: "Nessuna conversazione",
  },
  "empty-notifications": {
    id: "empty-notifications",
    kind: "empty-state",
    src: "/assets/flow/empty-states/flow-empty-notifications.webp",
    alt: "Nessun aggiornamento",
  },
  "empty-projects": {
    id: "empty-projects",
    kind: "empty-state",
    src: "/assets/flow/empty-states/flow-empty-projects.webp",
    alt: "Nessun Flowboard",
  },
  "empty-search": {
    id: "empty-search",
    kind: "empty-state",
    src: "/assets/flow/empty-states/flow-empty-search.webp",
    alt: "Nessun risultato",
  },
  "emoji-celebrate": {
    id: "emoji-celebrate",
    kind: "emoji",
    src: "/assets/flow/emoji/flow-celebrate.webp",
    alt: "Celebrazione",
  },
  "sticker-applause": {
    id: "sticker-applause",
    kind: "sticker",
    src: "/assets/flow/stickers/communication/flow-applause.webp",
    alt: "Applauso",
  },
  "sticker-deal-won": {
    id: "sticker-deal-won",
    kind: "sticker",
    src: "/assets/flow/stickers/crm/flow-deal-won.webp",
    alt: "Opportunità vinta",
  },
  "sticker-video-call": {
    id: "sticker-video-call",
    kind: "sticker",
    src: "/assets/flow/stickers/work/flow-video-call.webp",
    alt: "Videochiamata",
  },
};

export const flowChatAssets = [
  flowAssets["emoji-celebrate"],
  flowAssets["sticker-applause"],
  flowAssets["sticker-deal-won"],
  flowAssets["sticker-video-call"],
];
