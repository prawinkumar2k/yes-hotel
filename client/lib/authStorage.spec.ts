import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEY,
  clearStoredAuthUser,
  getStoredAuthToken,
  getStoredAuthUser,
  setStoredAuthUser,
} from "./authStorage";
import { api } from "./api";

const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    __store: store,
  };
};

describe("client auth storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const storage = mockLocalStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
  });

  it("stores authenticated users under the canonical key", () => {
    setStoredAuthUser({
      _id: "u1",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      role: "ADMIN",
      token: "token-123",
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      AUTH_STORAGE_KEY,
      expect.stringContaining("\"token\":\"token-123\""),
    );
    expect(localStorage.removeItem).toHaveBeenCalledWith("user");
  });

  it("reads the canonical auth token and ignores malformed storage", () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: "token-456" }));
    expect(getStoredAuthUser()).toEqual({ token: "token-456" });
    expect(getStoredAuthToken()).toBe("token-456");

    localStorage.setItem(AUTH_STORAGE_KEY, "{bad-json");
    expect(getStoredAuthUser()).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
  });

  it("clears canonical and legacy auth storage on logout", () => {
    clearStoredAuthUser();

    expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(localStorage.removeItem).toHaveBeenCalledWith("user");
  });

  it("attaches a bearer token for protected API requests", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        _id: "u1",
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "ADMIN",
        token: "token-789",
      }),
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/audit-logs");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/audit-logs",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-789",
        }),
      }),
    );
  });

  it("does not attach an authorization header when no token exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/public/settings");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/settings",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  it("drops blank authorization headers instead of sending malformed bearer values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/public/settings", { hello: "world" }, { headers: { Authorization: "   " } });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/settings",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
        }),
      }),
    );
  });
});
