const STORAGE_KEY = "rti.auth.return-path";
const SAFE_RETURN_PATHS = new Set(["/invitations"]);

export function rememberAuthReturnPath(path: string | null | undefined) {
  if (typeof window === "undefined" || !path || !SAFE_RETURN_PATHS.has(path)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Authentication still works if browser storage is unavailable; only the automatic return is lost.
  }
}

export function rememberAuthReturnPathFromLocation() {
  if (typeof window === "undefined") return;
  rememberAuthReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
}

export function consumeAuthReturnPath() {
  if (typeof window === "undefined") return undefined;
  try {
    const path = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    return path && SAFE_RETURN_PATHS.has(path) ? path : undefined;
  } catch {
    return undefined;
  }
}
