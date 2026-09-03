import { getStoredAuthToken, getStoredAuthUser, setStoredAuthUser, clearStoredAuthUser } from "./authStorage";

// Refresh-in-flight de-duplication: if several requests hit a 401
// simultaneously, they should all wait on the SAME refresh call rather than
// each independently rotating the refresh token (which would revoke each
// other's token under the reuse-detection in refreshToken.service).
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          clearStoredAuthUser();
          return null;
        }
        const currentUser = getStoredAuthUser();
        setStoredAuthUser({ ...(currentUser as any), ...json.data });
        return json.data.token as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

const request = async (
  method: string,
  url: string,
  data?: any,
  options?: { headers?: Record<string, string> },
  _isRetry = false
): Promise<{ data: any }> => {
  const token = getStoredAuthToken();

  // If data is FormData, let the browser set Content-Type with the correct boundary
  const isFormData = data instanceof FormData;

  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  if (options?.headers) Object.assign(headers, options.headers);
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (!headers.Authorization?.trim()) {
    delete headers.Authorization;
  }

  const response = await fetch(`/api${url}`, {
    method,
    headers,
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
  });

  // A 401 on an authenticated request may just mean the short-lived access
  // token expired — try a silent refresh once before giving up. Only
  // attempted when we actually had a token to begin with (an anonymous/
  // guest request getting a 401 isn't a session-expiry situation).
  if (response.status === 401 && token && !_isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request(method, url, data, options, true);
    }
  }

  const json = await response.json();

  if (!response.ok) {
    const error: any = new Error(json.message || "An error occurred");
    error.response = { data: json };
    throw error;
  }

  return { data: json };
};

export const api = {
  get: (url: string) => request("GET", url),
  post: (url: string, data?: any, options?: { headers?: Record<string, string> }) => request("POST", url, data, options),
  patch: (url: string, data?: any, options?: { headers?: Record<string, string> }) => request("PATCH", url, data, options),
  delete: (url: string) => request("DELETE", url),
};
