/**
 * The app-wide session safety net (lib/sessionFetch.ts): an expired sign-in is renewed once and
 * the call retried — for plain fetch() calls too — and a refused renewal signs out cleanly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://hotel.test";
const store = new Map<string, string>();
const events: string[] = [];
let server: (req: Request) => Response | Promise<Response>;
const calls: { url: string; auth: string | null; body: string }[] = [];

beforeEach(() => {
  store.clear();
  events.length = 0;
  calls.length = 0;
  vi.resetModules();
  const target = new EventTarget();
  const win: any = {
    location: { href: `${ORIGIN}/admin/check-out`, origin: ORIGIN, reload: vi.fn() },
    dispatchEvent: (e: Event) => { events.push(e.type); return target.dispatchEvent(e); },
    addEventListener: target.addEventListener.bind(target),
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request && !init ? input : new Request(new URL(String((input as any).url ?? input), ORIGIN), init);
      calls.push({ url: new URL(req.url).pathname, auth: req.headers.get("Authorization"), body: req.method === "GET" ? "" : await req.clone().text() });
      return server(req);
    },
  };
  (globalThis as any).window = win;
  (globalThis as any).fetch = (...a: any[]) => win.fetch(...a);
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };
  store.set("yes_hotels_user", JSON.stringify({ _id: "u1", role: "RECEPTIONIST", token: "OLD" }));
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
async function setup() {
  const { installSessionFetch } = await import("./sessionFetch");
  delete (globalThis as any).window.__yesSessionFetch;
  installSessionFetch();
  return (globalThis as any).window.fetch as typeof fetch;
}

describe("session safety net", () => {
  it("renews an expired token once and retries the same call (body intact)", async () => {
    server = (req) => {
      const p = new URL(req.url).pathname;
      if (p === "/api/auth/refresh") return json(200, { success: true, data: { _id: "u1", token: "NEW" } });
      return req.headers.get("Authorization") === "Bearer NEW" ? json(200, { success: true }) : json(401, { success: false });
    };
    const f = await setup();
    const res = await f(`${ORIGIN}/api/folios/x/payments`, { method: "POST", headers: { Authorization: "Bearer OLD", "Content-Type": "application/json" }, body: JSON.stringify({ amount: 500 }) });
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual(["/api/folios/x/payments", "/api/auth/refresh", "/api/folios/x/payments"]);
    expect(calls[2].auth).toBe("Bearer NEW");
    expect(calls[2].body).toBe(JSON.stringify({ amount: 500 }));
    expect(JSON.parse(store.get("yes_hotels_user")!).token).toBe("NEW");
  });

  it("many screens failing at once share ONE renewal", async () => {
    server = (req) => {
      const p = new URL(req.url).pathname;
      if (p === "/api/auth/refresh") return new Promise((r) => setTimeout(() => r(json(200, { success: true, data: { _id: "u1", token: "NEW" } })), 20));
      return req.headers.get("Authorization") === "Bearer NEW" ? json(200, { ok: 1 }) : json(401, {});
    };
    const f = await setup();
    const results = await Promise.all(["/api/a", "/api/b", "/api/c", "/api/d", "/api/e"].map((u) => f(`${ORIGIN}${u}`, { headers: { Authorization: "Bearer OLD" } })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(calls.filter((c) => c.url === "/api/auth/refresh")).toHaveLength(1);
  });

  it("renewal refused → signed out cleanly with the session-expired signal", async () => {
    server = (req) => (new URL(req.url).pathname === "/api/auth/refresh" ? json(401, { success: false }) : json(401, {}));
    const f = await setup();
    const res = await f(`${ORIGIN}/api/admin/bookings`, { headers: { Authorization: "Bearer OLD" } });
    expect(res.status).toBe(401);
    expect(store.has("yes_hotels_user")).toBe(false);
    expect(events).toContain("yes:session-expired");
  });

  it("leaves other sites, sign-in calls and anonymous calls alone", async () => {
    server = () => json(401, {});
    const f = await setup();
    await f("https://other.example/api/x", { headers: { Authorization: "Bearer OLD" } });
    await f(`${ORIGIN}/api/auth/login`, { method: "POST", headers: { Authorization: "Bearer OLD" }, body: "{}" });
    await f(`${ORIGIN}/api/rooms/categories`);
    expect(calls.map((c) => c.url)).toEqual(["/api/x", "/api/auth/login", "/api/rooms/categories"]);
  });
});
