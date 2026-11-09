import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { canonicalRedirectTarget, canonicalUrl, canonicalUrlOptionsFromEnv, twinHost, type CanonicalUrlOptions } from "./canonical-url";

const BOTH: CanonicalUrlOptions = { canonicalOrigin: "https://yeshotels.in", redirectHost: true, redirectTrailingSlash: true };
const SLASH_ONLY: CanonicalUrlOptions = { canonicalOrigin: "https://yeshotels.in", redirectHost: false, redirectTrailingSlash: true };
const OFF: CanonicalUrlOptions = { canonicalOrigin: "https://yeshotels.in", redirectHost: false, redirectTrailingSlash: false };
const t = (host: string, url: string, opts = BOTH, method = "GET") => canonicalRedirectTarget({ method, host, url }, opts);

describe("trailing slash: one address per page", () => {
  it("redirects /rooms/ to /rooms and keeps the query", () => {
    expect(t("yeshotels.in", "/rooms/", SLASH_ONLY)).toBe("/rooms");
    expect(t("yeshotels.in", "/hotels-near/begur/", SLASH_ONLY)).toBe("/hotels-near/begur");
    expect(t("yeshotels.in", "/rooms/?checkIn=2026-11-20&adults=2", SLASH_ONLY)).toBe("/rooms?checkIn=2026-11-20&adults=2");
    expect(t("yeshotels.in", "/rooms///", SLASH_ONLY)).toBe("/rooms");
  });
  it("leaves addresses that are already canonical alone", () => {
    for (const u of ["/", "/rooms", "/rooms/deluxe-room", "/rooms?x=1", "/?utm_source=a"]) expect(t("yeshotels.in", u, SLASH_ONLY), u).toBeNull();
  });
  it("never touches the API, sockets, health checks, files or non-GET requests", () => {
    for (const u of ["/api/rooms/", "/api/", "/socket.io/?EIO=4", "/health/", "/robots.txt/", "/brand/logo.png/"]) expect(t("yeshotels.in", u, BOTH), u).toBeNull();
    expect(t("yeshotels.in", "/rooms/", SLASH_ONLY, "POST")).toBeNull();
    expect(t("yeshotels.in", "/rooms/", SLASH_ONLY, "PUT")).toBeNull();
    expect(t("yeshotels.in", "/rooms/", SLASH_ONLY, "HEAD")).toBe("/rooms");
  });
  it("can be switched off", () => {
    expect(t("yeshotels.in", "/rooms/", OFF)).toBeNull();
    expect(canonicalUrlOptionsFromEnv({ CLIENT_URL: "https://yeshotels.in", CANONICAL_TRAILING_SLASH: "off" } as any).redirectTrailingSlash).toBe(false);
    expect(canonicalUrlOptionsFromEnv({ CLIENT_URL: "https://yeshotels.in" } as any).redirectTrailingSlash).toBe(true);
  });
});

describe("www to non-www (only when switched on)", () => {
  it("is OFF unless CANONICAL_HOST_REDIRECT is on", () => {
    expect(canonicalUrlOptionsFromEnv({ CLIENT_URL: "https://yeshotels.in" } as any).redirectHost).toBe(false);
    expect(canonicalUrlOptionsFromEnv({ CLIENT_URL: "https://yeshotels.in", CANONICAL_HOST_REDIRECT: "on" } as any).redirectHost).toBe(true);
    expect(t("www.yeshotels.in", "/rooms", SLASH_ONLY)).toBeNull();
  });
  it("sends the www twin to the canonical host, keeping path and query", () => {
    expect(t("www.yeshotels.in", "/", BOTH)).toBe("https://yeshotels.in/");
    expect(t("www.yeshotels.in", "/rooms", BOTH)).toBe("https://yeshotels.in/rooms");
    expect(t("www.yeshotels.in", "/hotels-near/begur?utm_source=google", BOTH)).toBe("https://yeshotels.in/hotels-near/begur?utm_source=google");
    expect(t("WWW.YESHOTELS.IN", "/about", BOTH)).toBe("https://yeshotels.in/about");
    expect(t("www.yeshotels.in:443", "/about", BOTH)).toBe("https://yeshotels.in/about");
  });
  it("does it in ONE hop together with the trailing slash", () => {
    expect(t("www.yeshotels.in", "/rooms/", BOTH)).toBe("https://yeshotels.in/rooms");
    expect(t("www.yeshotels.in", "/hotels-near/begur/?a=1", BOTH)).toBe("https://yeshotels.in/hotels-near/begur?a=1");
  });
  it("leaves the canonical host, other hosts, IPs and localhost alone", () => {
    for (const h of ["yeshotels.in", "127.0.0.1", "187.127.217.225", "localhost", "yeshotels.in.evil.com", "evilyeshotels.in", "www.evil.com", "app.yeshotels.in"]) {
      expect(t(h, "/rooms", BOTH), h).toBeNull();
    }
  });
  it("works the other way round when the canonical host is the www one", () => {
    const wwwCanon: CanonicalUrlOptions = { canonicalOrigin: "https://www.example.in", redirectHost: true, redirectTrailingSlash: true };
    expect(t("example.in", "/rooms", wwwCanon)).toBe("https://www.example.in/rooms");
    expect(t("www.example.in", "/rooms", wwwCanon)).toBeNull();
  });
  it("only switches on for a real https host (never for http, IPs or localhost in CLIENT_URL)", () => {
    for (const c of ["http://yeshotels.in", "http://localhost:8080", "https://187.127.217.225", "http://187.127.217.225:3100", "", "not a url"]) {
      expect(canonicalUrlOptionsFromEnv({ CLIENT_URL: c, CANONICAL_HOST_REDIRECT: "on" } as any).redirectHost, c).toBe(false);
    }
  });
  it("twinHost", () => {
    expect(twinHost("yeshotels.in")).toBe("www.yeshotels.in");
    expect(twinHost("www.yeshotels.in")).toBe("yeshotels.in");
    expect(twinHost("localhost")).toBeNull();
    expect(twinHost("10.0.0.1")).toBeNull();
    expect(twinHost("yeshotels.in:3100")).toBeNull();
  });
});

describe("safety: cannot be used as an open redirect", () => {
  const evil = ["//evil.com/", "///evil.com/", "/\\evil.com/", "//evil.com/rooms/", "/\\/evil.com", "//evil.com", "/\\\\evil.com/x/"];
  for (const opts of [SLASH_ONLY, BOTH]) {
    for (const host of ["yeshotels.in", "www.yeshotels.in"]) {
      it(`${host}${opts === BOTH ? " (host redirect on)" : ""}`, () => {
        for (const u of evil) {
          const target = t(host, u, opts);
          if (target === null) continue;
          expect(target.startsWith("//"), `${u} -> ${target}`).toBe(false);
          expect(target.startsWith("/\\"), `${u} -> ${target}`).toBe(false);
          expect(/^https:\/\/yeshotels\.in\/|^\/[^/\\]/.test(target), `${u} -> ${target}`).toBe(true);
          expect(new URL(target, "https://yeshotels.in").host, `${u} -> ${target}`).toBe("yeshotels.in");
        }
      });
    }
  }
});

describe("no loops and no chains", () => {
  const hosts = ["yeshotels.in", "www.yeshotels.in", "127.0.0.1", "localhost"];
  const paths = ["/", "/rooms", "/rooms/", "/rooms//", "/hotels-near/begur/", "//rooms/", "/about/?a=1", "/rooms/deluxe-room/", "/x.y/", "/api/x/"];
  it("every request needs at most one redirect, and the redirected address is final", () => {
    for (const opts of [SLASH_ONLY, BOTH, OFF]) {
      for (const h of hosts) {
        for (const p of paths) {
          const first = t(h, p, opts);
          if (first === null) continue;
          const nextHost = first.startsWith("https://") ? new URL(first).host : h;
          const nextUrl = first.startsWith("https://") ? first.slice(first.indexOf("/", 8)) : first;
          expect(t(nextHost, nextUrl, opts), `${h}${p} -> ${first}`).toBeNull();
        }
      }
    }
  });
});

describe("through a real HTTP server (Host header and 301 status)", () => {
  let server: http.Server;
  let port = 0;
  const get = (host: string, url: string, method = "GET") =>
    new Promise<{ status: number; location?: string; body: string }>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path: url, method, headers: { Host: host } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode!, location: res.headers.location as string | undefined, body }));
      });
      req.on("error", reject);
      req.end();
    });
  beforeAll(async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(canonicalUrl(BOTH));
    app.get("/rooms", (_req, res) => res.send("rooms page"));
    app.get("/", (_req, res) => res.send("home"));
    app.get("/api/ping/", (_req, res) => res.send("api ok"));
    await new Promise<void>((r) => (server = app.listen(0, "127.0.0.1", () => r())));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => server?.close());

  it("301 from www with a trailing slash goes to the canonical page in one step", async () => {
    const r = await get("www.yeshotels.in", "/rooms/?a=1");
    expect(r.status).toBe(301);
    expect(r.location).toBe("https://yeshotels.in/rooms?a=1");
  });
  it("301 for the trailing slash on the canonical host", async () => {
    const r = await get("yeshotels.in", "/rooms/");
    expect(r.status).toBe(301);
    expect(r.location).toBe("/rooms");
  });
  it("200 on the canonical address, no redirect", async () => {
    expect((await get("yeshotels.in", "/rooms")).status).toBe(200);
    expect((await get("yeshotels.in", "/")).status).toBe(200);
  });
  it("the API is never redirected", async () => {
    const r = await get("www.yeshotels.in", "/api/ping/");
    expect(r.status).toBe(200);
    expect(r.body).toBe("api ok");
  });
  it("an open-redirect attempt stays on the site", async () => {
    const r = await get("yeshotels.in", "//evil.com/");
    expect(r.status).toBe(301);
    // "//evil.com/" becomes the local path "/evil.com/" (looks like a file name, so its slash is kept). It never leaves the site.
    expect(r.location).toBe("/evil.com/");
    expect(r.location!.startsWith("//")).toBe(false);
  });
  it("HEAD is redirected like GET", async () => {
    expect((await get("www.yeshotels.in", "/rooms/", "HEAD")).status).toBe(301);
  });
});
