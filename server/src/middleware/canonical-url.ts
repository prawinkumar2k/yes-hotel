/**
 * One address per page.
 *
 *  - Trailing slash: GET /rooms/ is answered with a 301 to /rooms (on by default).
 *  - Host: when CANONICAL_HOST_REDIRECT=on, GET www.yeshotels.in/... is answered with a 301 to the CLIENT_URL host
 *    (OFF by default; the recommended place for this redirect is the reverse proxy, see seo-agent/deploy/nginx-canonical-host.conf).
 *
 * Both are done in ONE hop (www + trailing slash becomes a single redirect), only for GET/HEAD page requests, never for
 * /api, /socket.io, /health or file-like paths, and the Location is always either an absolute URL on the canonical host or a
 * path that starts with exactly one "/" (so it can never be turned into an open redirect such as "//evil.com").
 */
import type { NextFunction, Request, Response } from "express";

export interface CanonicalUrlOptions {
  /** e.g. "https://yeshotels.in" (from CLIENT_URL). Only used when redirectHost is true. */
  canonicalOrigin?: string;
  redirectHost: boolean;
  redirectTrailingSlash: boolean;
}

const SKIP_PATH = /^\/(api|socket\.io|health)(\/|$)/i;

/** The www / non-www twin of a host name, or null for IPs, localhost and single-label hosts. */
export function twinHost(host: string): string | null {
  const h = host.toLowerCase();
  if (h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || !h.includes(".")) return null;
  return h.startsWith("www.") ? h.slice(4) : `www.${h}`;
}

/** Where this request should be redirected to, or null when it is already at its one canonical address. */
export function canonicalRedirectTarget(
  req: { method: string; host: string | undefined; url: string },
  opts: CanonicalUrlOptions,
): string | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const q = req.url.indexOf("?");
  const rawPath = q === -1 ? req.url : req.url.slice(0, q);
  const query = q === -1 ? "" : req.url.slice(q);
  if (!rawPath.startsWith("/") && !rawPath.startsWith("\\")) return null; // absolute-form or odd request targets: leave alone
  if (SKIP_PATH.test(rawPath)) return null;

  // One leading slash, never "//host" or "/\host" (open-redirect guard).
  let path = rawPath.replace(/^[\\/]+/, "/");
  if (SKIP_PATH.test(path)) return null;
  let changed = path !== rawPath;
  if (opts.redirectTrailingSlash && path.length > 1 && path.endsWith("/") && !/\.[A-Za-z0-9]+\/+$/.test(path)) {
    path = path.replace(/\/+$/, "") || "/";
    changed = true;
  }

  let origin = "";
  if (opts.redirectHost && opts.canonicalOrigin && req.host) {
    let canonicalHost: string;
    try { canonicalHost = new URL(opts.canonicalOrigin).host.toLowerCase(); } catch { return changed ? path + query : null; }
    const requested = req.host.toLowerCase().replace(/:\d+$/, "");
    if (requested !== canonicalHost && requested === twinHost(canonicalHost)) {
      origin = opts.canonicalOrigin.replace(/\/+$/, "");
      changed = true;
    }
  }
  // Nothing to change means no redirect (a redirect to the same address would loop).
  if (!changed) return null;
  return origin + path + query;
}

export function canonicalUrlOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): CanonicalUrlOptions {
  const on = (v: string | undefined) => /^(1|true|on|yes)$/i.test(String(v ?? "").trim());
  const off = (v: string | undefined) => /^(0|false|off|no)$/i.test(String(v ?? "").trim());
  const base = (env.CLIENT_URL || "").replace(/\/+$/, "");
  let canonicalOrigin: string | undefined;
  try {
    const u = new URL(base);
    if (u.protocol === "https:" && twinHost(u.host)) canonicalOrigin = u.origin;
  } catch { /* CLIENT_URL missing or not a URL: host redirect stays off */ }
  return {
    canonicalOrigin,
    redirectHost: on(env.CANONICAL_HOST_REDIRECT) && Boolean(canonicalOrigin),
    redirectTrailingSlash: !off(env.CANONICAL_TRAILING_SLASH),
  };
}

export function canonicalUrl(opts: CanonicalUrlOptions = canonicalUrlOptionsFromEnv()) {
  return (req: Request, res: Response, next: NextFunction) => {
    const target = canonicalRedirectTarget({ method: req.method, host: req.hostname, url: req.originalUrl }, opts);
    if (!target) return next();
    return res.redirect(301, target);
  };
}
