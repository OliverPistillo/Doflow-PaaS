import { ApiError } from "./api";

export const INVALID_DESKTOP_CREDENTIALS_CODE = "AUTH_INVALID_CREDENTIALS";

export function shouldInvalidateSavedDesktopCredential(error: unknown): boolean {
  return error instanceof ApiError
    && error.status === 401
    && error.code === INVALID_DESKTOP_CREDENTIALS_CODE
    && error.requestPath === "/auth/login";
}
