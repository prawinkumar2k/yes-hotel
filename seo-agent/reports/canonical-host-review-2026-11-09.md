# Canonical host and www redirect review

Date: 2026-11-09. Branch: `seo-agent/canonical-host` (from commit `498238b`, which is untouched).
Labels used: **Observed** = measured today on the live site or read in the repository. **Recommendation** = my advice. **Assumption** = not verified.

## 1. Executive summary

- **Observed:** `https://yeshotels.in` and `https://www.yeshotels.in` both return the same page, byte for byte, on all 13 routes tested. There is no redirect between them. Everything the site says about itself (canonical tags, sitemap, robots.txt, JSON-LD) already names `https://yeshotels.in`.
- **Recommendation:** non-www (`https://yeshotels.in`) is confirmed as the preferred host. Redirect www to it **in nginx**, in one hop.
- **Found and fixed locally (not deployed):** (a) `og:url` was never emitted on any page (same type of bug as the duplicate description: the server replaces an existing tag, and `index.html` had none); (b) `/rooms/` is a live duplicate of `/rooms`. A small server rule now redirects trailing slashes, and can also do the www redirect if ever wanted (off by default).
- **No blocker** to a safe implementation. Two prerequisites are listed in section 6.
- **No production change was made.** Nothing was pushed, merged or deployed.

## 2. Live behaviour (Observed, `seo-agent/scripts/host-audit.mjs`, 52 redirect chains: 4 starting addresses x 13 routes)

| Start | Result | Hops |
|---|---|---|
| `http://yeshotels.in/...` | 301 to `https://yeshotels.in/...`, then 200 | 1 |
| `http://www.yeshotels.in/...` | 301 to `https://www.yeshotels.in/...`, then 200 (**stays on www**) | 1 |
| `https://yeshotels.in/...` | 200 | 0 |
| `https://www.yeshotels.in/...` | **200 on all 13 routes** (no redirect to the apex) | 0 |

- Redirect loops: none. Chains longer than one hop: none. Broken URLs among the 13 routes: none.
- Same content on both hosts: yes. Identical bytes on all 13 routes (home, /rooms, /rooms/, /hotels-near, two area pages with and without slash, /about, /contact, a room page, /privacy-policy, /sitemap.xml, /robots.txt). So www is a pure mirror and nothing is lost by redirecting it.
- Canonical tag: `https://yeshotels.in/...` on both hosts, on every page type.
- `og:url`: **missing on all 11 HTML pages.**
- JSON-LD (`@id`, `url`, `logo`, `image`, breadcrumb `item`): all `https://yeshotels.in`. No www anywhere in live structured data.
- `sitemap.xml`: 22 URLs, all `https://yeshotels.in`, served identically on both hosts. `robots.txt`: `Sitemap: https://yeshotels.in/sitemap.xml` on both hosts.
- Trailing slash: `/rooms/` returns 200 with canonical `https://yeshotels.in/rooms/` (a duplicate of `/rooms`). `/hotels-near/begur/` returns 200 but its canonical is the slash-less address (area pages use their stored canonical), so only the rooms list was affected.
- TLS: one Let's Encrypt certificate for `yeshotels.in` with `www.yeshotels.in` in its alternative names, trusted for both, valid 15 Oct 2026 to 13 Jan 2027 (65 days left). HSTS `max-age=31536000; includeSubDomains` is sent on both hosts.
- DNS (Observed earlier today): `www` is a CNAME to `yeshotels.in`, which points straight at the VPS 187.127.217.225. **No CDN is in front.**

## 3. Repository findings (Observed)

- Single-page React app (React Router) served by Express in Docker; nginx on the VPS terminates TLS and proxies to `127.0.0.1:3100` (DEPLOYMENT.md). **The nginx file is not in the repository**, so it could not be reviewed.
- Canonical, `og:*`, JSON-LD and prerender text are injected per request by `seo-meta-injector.service.ts` from `CLIENT_URL` (production value `https://yeshotels.in`). `sitemap.xml` and a dynamic `robots.txt` are built from the same variable (`sitemap.routes.ts`); `public/robots.txt` is a second copy that agrees.
- `og:url`: the injector replaces an existing `<meta property="og:url">`, but `index.html` had none, so nothing was ever written (silent no-op).
- `HOTEL.website` (`shared/hotel-info.ts`) is `https://www.yeshotels.in` and is used only by the owner's uncommitted `sameAs` draft. At the committed code it is not live. If the draft shipped as written it would put the www address into every page's JSON-LD.
- `trust proxy` is set to 1, and `origins.ts` already allows both hosts for CORS, so a redirect does not break API calls from either host.
- There were no tests for redirects, `og:url` or host consistency.

## 4. Recommended canonical host (Recommendation)

`https://yeshotels.in` (non-www). Reasons: production `CLIENT_URL`, every canonical, the sitemap, robots.txt and the structured data already use it; changing to www would mean changing all of them; the certificate and DNS support either. Nothing observed argues for www.

## 5. Proposed redirect matrix and where to do it

| Start | Today | After (target) |
|---|---|---|
| `http://yeshotels.in/x` | 301 to https apex | 301 to `https://yeshotels.in/x` (1 hop) |
| `http://www.yeshotels.in/x` | 301 to https **www** | 301 to `https://yeshotels.in/x` (**1 hop**) |
| `https://www.yeshotels.in/x` | 200 | 301 to `https://yeshotels.in/x` (1 hop) |
| `https://yeshotels.in/x` | 200 | 200 |
| `https://yeshotels.in/rooms/` | 200 (duplicate) | 301 to `/rooms` (1 hop, app rule) |
| `https://www.yeshotels.in/rooms/` | 200 | 301 to `https://yeshotels.in/rooms` (1 hop: nginx sends it to `/rooms/`, the app rule is then a second hop; see note) |

**Level: the reverse proxy (nginx).** It is the only place that gives one hop for `http://www`, it covers every path including static files, `sitemap.xml` and `robots.txt`, and it does not depend on which Host header reaches the app. A ready-to-review file is `seo-agent/deploy/nginx-canonical-host.conf` (not applied; the real file must be edited on the server).
Not CDN (none exists). The app-level host redirect (`CANONICAL_HOST_REDIRECT=on`) is a fallback only: it cannot do `http://www` in one hop, and `sitemap.xml`, `robots.txt` and `/api` are answered before it (tested, below).
Note on the last row: with nginx redirecting www, the trailing-slash rule would run on the next request, making `https://www.yeshotels.in/rooms/` two hops. If that matters, add `rewrite ^/(.+?)/+$ https://yeshotels.in/$1 permanent;` in the www block of the proposal, **above** the `return` line (nginx runs these in order and `return` stops processing), or accept two hops for this rare address. Not tested here.

## 6. Risks and prerequisites

1. **Sessions (Observed behaviour of cookies).** Anyone signed in on `www.yeshotels.in` is signed out once. Tell staff to use `https://yeshotels.in/admin`.
2. **Webhooks and integrations (Assumption).** A 301 on a POST is dropped or turned into a GET by most senders. Razorpay is not switched on yet (docs/OPERATIONS.md), so register `https://yeshotels.in/api/webhooks/razorpay` when it is. I cannot see whether any OTA/channel-manager integration uses a www URL. Check before the change.
3. **Certificate renewal (Assumption).** The renewal method (certbot nginx plugin or webroot) is not in the repository. After the change run `certbot renew --dry-run`. The proposal keeps a commented hook for the challenge path.
4. **Search Console / Business Profile.** Use the `https://yeshotels.in` property (or a Domain property) and make sure the Business Profile website field is exactly `https://yeshotels.in`. Re-submit the sitemap.
5. **Editing nginx on a shared VPS.** Only `/etc/nginx/sites-enabled/yeshotels` may change; back it up first; `nginx -t` before reload. Rollback is a file copy and a reload.
6. **Why not simply keep both?** Both hosts return identical pages today and canonicals point at the apex, so the damage is limited, but Google treats canonical as a hint, and signals and Search Console data can split.

## 7. Files changed (all local, on branch `seo-agent/canonical-host`)

- `index.html`: added one line, `<meta property="og:url" content="https://yeshotels.in/" />`, which the server rewrites per page.
- `server/src/middleware/canonical-url.ts` (new): trailing-slash 301 (on by default); www to apex 301 (off by default, `CANONICAL_HOST_REDIRECT=on`). One hop, GET/HEAD only, skips `/api`, `/socket.io`, `/health` and file-like paths, cannot produce an open redirect.
- `server/node-build.ts`: registers it before static files (4 lines).
- `.env.example`: documents the two settings.
- `server/src/middleware/canonical-url.spec.ts` (new, 22 tests) and `server/src/routes/seo-host-consistency.integration.spec.ts` (new, 24 entries).
- `seo-agent/scripts/host-audit.mjs` (new, read-only; re-run it to verify any real change), `seo-agent/deploy/nginx-canonical-host.conf` (proposal), `seo-agent/tasks/proposals/jsonld-sameas-host.md`, this report, task queue and state updates.
- **Not changed:** `seo-meta-injector.service.ts`, `shared/hotel-info.ts` (owner's files, hashes identical before and after), the Maps URL, any rating, any server, nginx, DNS, database or scheduler. No dependency was added.

## 8. Tests and build

| Check | Result |
|---|---|
| `canonical-url.spec.ts` | 22 passed: slash rules, query kept, API/files/POST skipped, switches, www to apex incl. case and port, one hop with slash, IPs/localhost/look-alike hosts untouched, open-redirect attempts, no loops and every address final after one redirect, real HTTP server with Host header |
| `seo-host-consistency.integration.spec.ts` | 23 passed, 1 todo (13 page types: one canonical and one `og:url`, both on `https://yeshotels.in` and equal; JSON-LD own URLs; sitemap; both robots.txt copies). The todo is the `sameAs` check, blocked by the owner's files |
| Earlier SEO suites (`seo-description`, `seo.integration`, `no-invented-hotel-details`) | all pass. Total 77 passed, 1 todo, 0 failed |
| Type check of the new files | clean |
| Client and server production builds | pass; built `index.html` contains the `og:url` tag |
| **Real boot of the built server** (local, test database, `CANONICAL_HOST_REDIRECT=on`) | apex `/` and `/rooms` 200; `/rooms/` 301 to `/rooms`; `/hotels-near/begur/?x=1` 301 keeping the query; `www /` 301 to `https://yeshotels.in/`; `www /rooms/` 301 to `https://yeshotels.in/rooms` (one hop); `//evil.com/` stays a local path; `/api/ready`, `/sitemap.xml`, `/robots.txt` on www still 200; canonical and `og:url` equal on `/` and `/rooms` |

An honest limit: http-to-https and the nginx redirect cannot be tested locally (they live in nginx, which is not in the repository). They can only be verified with `host-audit.mjs` after the real change.
Also observed while testing: a test of the injector would have failed for any page whose JSON-LD contains the www address, which is exactly what the owner's draft does; that is why `sameAs` is a documented todo, not a silent pass.

## 9. Production steps that need approval

1. Merge and deploy `seo-agent/canonical-host` (adds `og:url` and the `/rooms/` redirect; the host redirect stays off). A push to `hardening/phase-1` deploys automatically.
2. Edit nginx on the VPS as in `nginx-canonical-host.conf`, after the prerequisites in section 6 are checked, then run `host-audit.mjs` and `certbot renew --dry-run`.
3. Decide the `HOTEL.website` / `sameAs` change (proposal file) together with the rating decision.
4. Update Search Console, Business Profile and any integration to the apex address.

## 10. Production status

No production change was made: no push, no merge, no deployment, no nginx, DNS or server change, no redirect enabled, no scheduler, no database or data change. The only contact with the live site was read-only GET requests.
