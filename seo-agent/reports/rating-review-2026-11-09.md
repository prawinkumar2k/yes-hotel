# Star rating review: 4.8 from 33 reviews

Date: 2026-11-09. Files inspected (not modified): `server/src/services/seo-meta-injector.service.ts`, `shared/hotel-info.ts`. Both have uncommitted changes by the owner.

## What the uncommitted change adds
In the Hotel structured data (JSON-LD, seen by Google on every page):
```
aggregateRating: { ratingValue: "4.8", reviewCount: "33", bestRating: "5", worstRating: "1" }
hasMap / sameAs: the Google Maps link, the Instagram link and HOTEL.website
```
`hotel-info.ts` changes only `mapsUrl` (from a search link to `https://www.google.com/maps?cid=15884523383505329498`).

## Where do 4.8 and 33 come from?
**Hardcoded text typed into the code. Not read from any data source.**

- The injector does not read the site's own `Review` collection (the model exists, with a moderated review flow, but nothing connects it to this markup).
- The number 33 appears nowhere else in the repository or its history. The string `reviewCount: "33"` was never committed.
- 4.8 has a history: earlier versions had `ratingValue "4.8"` with `reviewCount "142"` plus a `HOTEL.ratings` list (Google 4.8, MakeMyTrip 4.8, Trip.com 8.5, Booking.com 8.2). On 16 Oct 2026 commit `f0ce8e7` ("content: remove rating claims (home, about, sign-in page, search-engine data)") **deliberately removed all of it**. The new change brings 4.8 back with a different count.
- The live site shows no rating or review text anywhere (0 matches on the home page).

## Status: unsupported / unverified
| Test | Result |
|---|---|
| Verified business data? | **No.** Nothing in the project proves it. I cannot read the Google Business Profile, so I cannot confirm either number. |
| Hardcoded? | **Yes.** |
| Consistent with a decision already taken? | **No.** It reverses the 16 Oct removal. |
| Visible on the page? | **No.** Google's structured-data rules require rating markup to describe reviews users can see on that page. |
| Eligible for Google's review stars? | Doubtful. Google ignores or penalises self-serving ratings on a business's own page, and a mismatch can lead to a manual action against the whole site's structured data. |

## Recommendation
1. **Do not deploy the `aggregateRating` block.** Ship the rest of the change (maps link, `hasMap`, Instagram `sameAs`) after the host decision, because those are plain factual links.
2. If the owner wants ratings shown: take the real figures from the Google Business Profile, show them (with source) visibly on a page, and generate the markup from stored data, not typed numbers. Even then, expect Google not to show stars for a hotel's own page.
3. Confirm that cid `15884523383505329498` is this hotel's own profile before committing the maps link.
4. `sameAs[0]` is `HOTEL.website` (www). Change it to the preferred host chosen in the domain report.

Not changed by the agent: both files remain exactly as the owner left them.
