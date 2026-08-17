const AUTH_TOKEN_KEY = "doflow_token";

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function getAuthToken(): string | null {
  if (!canUseBrowserStorage()) return null;
  return (
    window.localStorage.getItem(AUTH_TOKEN_KEY) ||
    window.sessionStorage.getItem(AUTH_TOKEN_KEY)
  );
}

export function storeAuthToken(token: string, rememberMe: boolean) {
  if (!canUseBrowserStorage()) return;
  clearAuthStorage();
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(AUTH_TOKEN_KEY, token);
}

export function replaceAuthToken(token: string) {
  if (!canUseBrowserStorage()) return;
  const rememberMe = window.localStorage.getItem(AUTH_TOKEN_KEY) !== null;
  storeAuthToken(token, rememberMe);
}

export function clearAuthStorage() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isAuthRemembered() {
  return canUseBrowserStorage() && window.localStorage.getItem(AUTH_TOKEN_KEY) !== null;
}
