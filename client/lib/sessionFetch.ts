/**
 * App-wide session safety net for API calls.
 *
 * Sign-in tokens last one day. Many screens call the API with plain fetch() (not lib/api.ts), and
 * those never renewed an expired token — after a day they just showed 401 errors. This wraps
 * window.fetch once: an authenticated call to our own /api/ that gets 401 renews the session
 * (one shared renewal for all screens, via the httpOnly refresh cookie) and is retried once with
 * the new token. If renewal is refused (session over or revoked), lib/api.ts signs the person out
 * cleanly ("yes:session-expired") instead of leaving a broken page.
 */
import { refreshAccessToken } from "./api";
import { getStoredAuthUser } from "./authStorage";

declare global {
  interface Window { __yesSessionFetch?: boolean }
}

export function installSessionFetch() {
  if (typeof window === "undefined" || window.__yesSessionFetch) return;
  window.__yesSessionFetch = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let request: Request;
    try {
      request = new Request(input as any, init);
    } catch {
      return original(input as any, init);
    }
    const url = new URL(request.url, window.location.href);
    const ours = url.origin === window.location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/");
    const bearer = request.headers.get("Authorization");
    if (!ours || !bearer || !/^Bearer\s+\S+/.test(bearer)) return original(request);

    const retryCopy = request.clone(); // the body can only be read once
    const response = await original(request);
    if (response.status !== 401 || !getStoredAuthUser()) return response;

    const token = await refreshAccessToken();
    if (!token) return response; // signed out (or offline): the caller sees the 401
    const headers = new Headers(retryCopy.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return original(new Request(retryCopy, { headers }));
  };
}
