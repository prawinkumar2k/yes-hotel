export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  token: string;
}

export const AUTH_STORAGE_KEY = "yes_hotels_user";
const LEGACY_AUTH_STORAGE_KEY = "user";

const hasLocalStorage = () =>
  typeof localStorage !== "undefined" && typeof localStorage.getItem === "function";

export function getStoredAuthUser(): AuthUser | null {
  if (!hasLocalStorage()) return null;

  const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getStoredAuthToken(): string {
  const user = getStoredAuthUser();
  return typeof user?.token === "string" ? user.token : "";
}

export function setStoredAuthUser(userData: AuthUser) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

export function clearStoredAuthUser() {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}
