# Proposal (NOT applied): keep the www address out of the JSON-LD

Both files below are owner-modified and were deliberately left untouched. This is what to change when the owner settles the draft.

## The problem (only in the owner's uncommitted draft; not live)
`seo-meta-injector.service.ts` (draft) adds to the Hotel schema:
```ts
sameAs: [ HOTEL.website, HOTEL.instagramUrl, HOTEL.mapsUrl ],
```
`HOTEL.website` in `shared/hotel-info.ts` is `https://www.yeshotels.in`. Every page's structured data would then name the www address as the hotel's own site, next to `url: https://yeshotels.in`. `HOTEL.website` is used nowhere else in the project (checked 2026-11-09), so changing it is safe.

## The change (when approved)
1. `shared/hotel-info.ts`: `website: "https://yeshotels.in"`.
2. In the injector draft, build the first `sameAs` entry from `baseUrl` (so it follows `CLIENT_URL`) instead of `HOTEL.website`:
   ```ts
   sameAs: [ baseUrl, HOTEL.instagramUrl, HOTEL.mapsUrl ],
   ```
3. Do not ship `aggregateRating` (see `reports/rating-review-2026-11-09.md`).
4. Remove the `it.todo` in `server/src/routes/seo-host-consistency.integration.spec.ts` and turn it into a real assertion: every `sameAs` URL that is on the hotel's own domain must be `https://yeshotels.in`.

Display text that says "www.yeshotels.in" (printed documents footer, Contact page fallback) is not search data; change it only if the owner wants the printed address to match.
