# Domain consistency report: www.yeshotels.in vs yeshotels.in

Date: 2026-11-09. Method: read-only requests to the live site, DNS and TLS lookups, and the repository. Nothing was changed on the server.

## Recommendation

**Use `https://yeshotels.in` (no www) as the single preferred host.**

The production configuration already treats it as the main address:

| Evidence | Host it uses |
|---|---|
| Production `CLIENT_URL` (DEPLOYMENT.md, section 2) | `https://yeshotels.in` |
| `<link rel="canonical">` on every page | `yeshotels.in` |
| `sitemap.xml`, all 22 URLs | `yeshotels.in` |
| `robots.txt` Sitemap line | `yeshotels.in` |
| JSON-LD `@id`, `url`, `logo`, `image` (Hotel + Organization) | `yeshotels.in` |
| Booking-email links, sign-in cookies and CORS base | `CLIENT_URL` (non-www), www allowed as a twin |
| TLS certificate | one certificate covers both names |

Only a few places say www: `HOTEL.website` in `shared/hotel-info.ts`, the printed-document footer ("Web : www.yeshotels.in") and the Contact page fallback text. These are display text or one config value. Moving the redirect to non-www changes nothing the site already declares.

## What was found

| Check | Result |
|---|---|
| `http://yeshotels.in` and `http://www.yeshotels.in` | 301 to https on the **same** host. Good. |
| `https://yeshotels.in/` and `https://www.yeshotels.in/` | **Both 200. No redirect between them.** This is the problem. |
| DNS | `www` is a CNAME to `yeshotels.in`, which resolves to 187.127.217.225 (the VPS). |
| TLS | One Let's Encrypt certificate for both names, expires 13 Jan 2027. HSTS `max-age=31536000; includeSubDomains` is already sent. |
| Canonical on the www page | Points to the non-www URL. This limits the damage, but a canonical is a hint, not a redirect. |
| `robots.txt`, `sitemap.xml`, `llms.txt`, Search Console verification file | Identical (same size) on both hosts. |
| `sitemap.xml` | 22 URLs, all non-www. |
| `llms.txt` | No absolute URLs (relative links only), so no host mix. |
| Internal links in the page HTML | Relative; the only absolute link is the non-www home. |
| `HOTEL.website`, `sameAs` in the owner's uncommitted schema change | `https://www.yeshotels.in`: **mixes with the non-www `@id`/`url`** on the same page. |
| Trailing slash | `/rooms/` also returns 200 and its canonical is `https://yeshotels.in/rooms/` (a duplicate of `/rooms`). Separate small issue (SEO-012). |

## Risk of leaving it as is
Search engines can index both hosts or split link signals, and Search Console can show two properties with split data. Staff and guests who sign in on www and non-www have separate cookies.

## Proposed change (NOT applied)
In the nginx site `/etc/nginx/sites-enabled/yeshotels`, add a 443 server block for `www.yeshotels.in` that returns `301 https://yeshotels.in$request_uri;`, using the existing certificate. Then set `HOTEL.website` and `sameAs` to the non-www address.

```nginx
server {
    listen 443 ssl;
    server_name www.yeshotels.in;
    ssl_certificate     /etc/letsencrypt/live/yeshotels.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yeshotels.in/privkey.pem;
    return 301 https://yeshotels.in$request_uri;
}
```

I could not read the real nginx file (no server access was used), so this is a template. It must be merged with whatever the live file contains, tested with `nginx -t`, and applied only with approval. Other sites on that VPS must not be touched.

Side effects to expect: anyone signed in on www is signed out once (cookies are per host); the Google Business Profile "website" field and any Search Console property should use the non-www address.

## Verify after it is applied
`curl -I https://www.yeshotels.in/rooms` gives 301 to `https://yeshotels.in/rooms`; the audit's "host variants" line shows the redirect; `seo-agent/scripts/audit.mjs` reports no www pages.
