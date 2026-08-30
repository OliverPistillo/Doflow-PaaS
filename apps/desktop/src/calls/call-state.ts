export type CallPhase = "loading" | "connecting" | "active" | "reconnecting" | "ended" | "error";

export interface CallUiState {
  phase: CallPhase;
  message: string;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  participantPresent: boolean;
  permissionError: string | null;
}

export type CallUiAction =
  | { type: "connect" }
  | { type: "connected" }
  | { type: "reconnecting" }
  | { type: "reconnected" }
  | { type: "participant"; present: boolean }
  | { type: "microphone"; enabled: boolean }
  | { type: "camera"; enabled: boolean }
  | { type: "screen"; enabled: boolean }
  | { type: "permission-error"; message: string }
  | { type: "error"; message: string }
  | { type: "ended"; message?: string };

export const initialCallUiState: CallUiState = {
  phase: "loading",
  message: "Preparazione della chiamata…",
  microphoneEnabled: false,
  cameraEnabled: false,
  screenShareEnabled: false,
  participantPresent: false,
  permissionError: null,
};

export function callUiReducer(state: CallUiState, action: CallUiAction): CallUiState {
  switch (action.type) {
    case "connect":
      return { ...state, phase: "connecting", message: "Connessione protetta…", permissionError: null };
    case "connected":
      return { ...state, phase: "active", message: "Connesso" };
    case "reconnecting":
      return { ...state, phase: "reconnecting", message: "Riconnessione in corso…" };
    case "reconnected":
      return { ...state, phase: "active", message: "Connessione ripristinata" };
    case "participant":
      return {
        ...state,
        participantPresent: action.present,
        message: action.present ? "Partecipante connesso" : "In attesa del partecipante…",
      };
    case "microphone":
      return { ...state, microphoneEnabled: action.enabled };
    case "camera":
      return { ...state, cameraEnabled: action.enabled };
    case "screen":
      return { ...state, screenShareEnabled: action.enabled };
    case "permission-error":
      return { ...state, permissionError: action.message, message: action.message };
    case "error":
      return { ...state, phase: "error", message: action.message };
    case "ended":
      return {
        ...state,
        phase: "ended",
        message: action.message || "Chiamata terminata",
        microphoneEnabled: false,
        cameraEnabled: false,
        screenShareEnabled: false,
      };
  }
}

export function formatCallDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
}

export function mediaErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Permesso per microfono o videocamera negato. Abilitalo nelle impostazioni di Windows.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Nessun dispositivo multimediale compatibile disponibile.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Il dispositivo è già in uso o non può essere avviato.";
  }
  return "Non è stato possibile avviare il dispositivo selezionato.";
}
