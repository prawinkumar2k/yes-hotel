# SEO plan — local visibility for YES HOTELS (Hosa Road Junction, Bengaluru)

Goal: be one of the most visible and trusted options for hotel searches around Hosa Road Junction and South Bengaluru, and turn that traffic into **direct bookings**. This document records what was researched, what was found, what has been changed in the code, what needs the owner, and the 90-day plan.

Rules this plan follows: no fake reviews, no keyword-stuffed business name, no bought or mass links, no cloaking, no doorway pages, and no invented numbers. Google's local results depend on relevance, distance and prominence; ranking cannot be bought ([Google Business Profile guidance](https://support.google.com/business/answer/7091)). The aim is top visibility, not a promise of first place.

## 1. Research done, and what it can and cannot tell us

I ran web searches for the target queries. **Limits you should know:**
- The search tool is a general web search, not Google's live results page for a phone in Bengaluru. It cannot show rank positions, the local map pack, or personalised results. **No ranking baseline exists yet.** The real baseline comes from Google Search Console (section 6) after the site is verified.
- No search volumes, competitor traffic or backlink counts were available, so none are quoted here. Do not rely on any such figures unless they come from Search Console, Google Business Profile Insights or a paid tool you subscribe to.
- Listings on booking sites contradict each other on details (address, star rating, distances), so every competitor fact below is "as listed", not verified.

### Who appeared (as listed on the web, by query group)

| Search intent | Properties and sites that appeared |
|---|---|
| Hosa Road Metro / Hosa Road Junction | Olive Hotel Hosa Road Metro (Embassy group, 3-star, opened Feb 2024, named after the station); Townhouse Singasandra Hosa Road (52 rooms, free breakfast, 24-hour desk); Keys Select Hosur Road (Singasandra); ibis Bengaluru Hosur Road (next to Hongasandra station); several OYO / "Hotel O" listings |
| Electronic City Phase 1 / 2, business travellers | Radha Regent (Phase 1, business hotel); BloomSuites Electronics City (opposite Wipro gate, meeting room); Samrudhi Park (behind Genpact, Wi-Fi and parking); Lemon Tree, The Ottera / Otium; Clarks Inn (Phase II, 45 rooms, on-site parking); ibis Hosur Road; OYO's own "business travellers" landing pages for Electronic City |
| Narayana Health City / Bommasandra | SRT Alpines, FabExpress Adya Classic, Treebo The Galaxy (opposite the hospital), Dreamz Lux Stay, Millennials Hotel, Holiday Inn Express Bommasandra; trip.com and OYO location pages |
| Kudlu Gate / Singasandra | Hotel Ekaa (Kudlu Gate, 3-star, valet parking), Flagship Kudlu Gate (OYO), Stopovers Hotel, Manipal County |
| Bommanahalli with parking / Wi-Fi / 24-hour desk | Super Townhouse Hosur Main Road Bommanahalli (OYO: free Wi-Fi, parking, 24-hour desk), Hotel A1 Inn and Green View (Madiwala), Hotel O The Royal International |
| Brand: "YES HOTELS" | Several **Expedia** pages for YES HOTELS with **conflicting addresses** (one "Hosa Road Junction, near Hosa Road Metro Station, Singasandra Village, Electronic City Phase 2", others "Begur", "Hosur Rd 51"), different star ratings and room counts |

What this shows:
1. The queries are dominated by **aggregators (OYO, Expedia, hotels.com, trip.com, travelocity, kayak)**, which have thousands of location pages. A single hotel site wins by being the most precise, most useful and most trustworthy page for a few exact places, not by out-publishing them.
2. Competitors use **specific, factual hooks**: the metro station name, the corporate campus, the hospital, parking, 24-hour desk, free breakfast.
3. **Your brand search is messy.** Third-party listings carry different addresses for the same hotel. Fixing this (one exact name, address and phone everywhere) is the highest-value off-site task.

## 2. Audit of YES HOTELS (live site, 19 Oct 2026)

Already in place (good): HTTPS; canonical tags; `robots.txt` that blocks admin, booking and API paths and points to the sitemap; a **database-backed sitemap** including room pages and ten location pages; **Hotel + Organization JSON-LD** with a live price range taken from real room rates; BreadcrumbList and **FAQPage** schema on location pages; ten published `/hotels-near/...` pages (Hosa Road, Hosa Road Metro Station, Electronic City, Bommasandra, Narayana Health City, Bommanahalli, Singasandra, Kudlu Gate, Begur, Hebbagodi) each with its own title, description, H1, overview, FAQs and room links; first-party tracking of which landing page a booking came from.

Gaps found and the action taken:

| # | Gap | Impact | Status |
|---|---|---|---|
| 1 | Page titles repeated the brand: "… \| YES HOTELS \| YES HOTELS" on every location page (a test even asserted it) | Weaker snippets in results | **Fixed in code** |
| 2 | The hotel's schema **name changed per page** ("YES HOTELS near Bommasandra"). One hotel must be one entity | Confuses entity understanding | **Fixed in code** |
| 3 | The served HTML had an **empty `<div id="root">`**. All text needed JavaScript to appear. Google can render scripts but later and less reliably; other crawlers and link previews read nothing | Slower and weaker indexing | **Fixed in code**: home, room and location pages now ship their heading, overview, highlights, FAQs and address/phone in the HTML (React replaces it on load) |
| 4 | Room pages (`/rooms/:slug`) used the home page's title and description | Duplicate metadata on money pages | **Fixed in code**: title, description, canonical and breadcrumb per room type |
| 5 | `/search` was in the sitemap: a parameter-driven page with no unique content | Wastes crawl budget, thin page | **Fixed in code**: removed from sitemap |
| 6 | No web analytics: only first-party landing-page tracking, so impressions, availability searches and funnel drop-off could not be seen | Cannot measure or prioritise | **Built, off until an ID is set** (section 6) |
| 7 | `/search` and booking steps showed the "online booking on hold" notice because of the hold I added | Search page lost its content for visitors | **Fixed**: `/search` is open again; only the guest-details and payment steps are on hold |
| 8 | Online booking is currently **on hold**. SEO traffic cannot convert to direct bookings while it is | Zero booking revenue from search | **Owner decision** (Admin → Settings → Online booking) |
| 9 | Location-page claims need real-world confirmation (section 4) | Wrong claims hurt trust and rankings | **Owner to verify** |
| 10 | JavaScript bundle is one 1.7 MB file; fonts load from Google Fonts | Slower first load on mobile | Roadmap (week 7–8) |
| 11 | No `sameAs` links, map link, `numberOfRooms` or opening hours in the Hotel schema; no review markup | Missing trust signals | Roadmap. **Review markup must only use real, collected reviews** |
| 12 | Third-party listings (Expedia and others) show conflicting addresses | Split brand signals, wrong map pins | **Owner action**: claim and correct (section 5) |

## 3. Changes made in the project (all uncommitted work stays local until you approve a deploy)

- `server/src/services/seo-meta-injector.service.ts`: brand not repeated in titles; constant hotel name; crawlable content for home, room and location pages; room-page metadata and breadcrumbs; optional analytics id meta tag.
- `server/src/routes/sitemap.routes.ts`: `/search` removed.
- `server/index.ts`: Google Analytics hosts are allowed in the content-security policy **only when `GA_MEASUREMENT_ID` is set**.
- `client/lib/analytics.ts` plus small hooks: `page_view` on public pages, `search_availability` (with rooms found), `begin_checkout`, `purchase` (value in INR, one per booking). No names, phones or emails are sent. Nothing loads unless the id is set.
- `client/App.tsx`: `/search` is not covered by the booking hold.
- Tests: `seo.integration.spec.ts` covers the title, entity name, crawlable content, the analytics id (on/off/invalid) and the sitemap. The whole suite passes: 77 files, 469 tests, and the production build succeeds.

### Second round (aggressive, still white-hat)

- Home page: broader title and description built from live data ("Hotel near Hosa Road Metro & Electronic City, Bengaluru | Rooms from ₹6,500"), real crawlable body text with room types and prices, and links to every area page.
- Every area page now links to all the other areas; a new hub page `/hotels-near` lists them all with distances (in the sitemap).
- Robots meta: indexable pages allow large previews; `/search` is `noindex, follow`; admin, staff, customer, login, register and booking steps are `noindex, nofollow`.
- Honest limit: very broad searches ("hotels in Bangalore") are won by large travel sites with thousands of pages and cannot be won by one hotel's website. The achievable, valuable targets are the local searches in the list at the top of this document and the hotel's own name. More pages will not fix that; real photos, real reviews and the Business Profile will.

## 4. Facts on the location pages that the owner must confirm

The ten pages are marked "verified" in the database, all on the same date, with generic source names. I could not independently confirm them. I checked what could be checked against public station data:

- **Hosa Road Metro Station** is on the Yellow Line, opened 10 Aug 2025, at about 12.8708° N, 77.6525° E ([Wikipedia](https://en.wikipedia.org/wiki/Hosa_Road_metro_station)). The hotel's coordinates in the schema (12.8715, 77.6534) are about 120 m from that point, which is **consistent** with the "100 metres / 2-minute walk" claim. Confirm with a Google Maps walking route and, ideally, a photo of the walk.
- **Kudlu Gate** station is at about 12.8900° N, 77.6392° E ([Wikipedia](https://en.wikipedia.org/wiki/Kudlu_Gate_metro_station)); straight-line distance from the hotel is about 2.5 km, consistent with the page's 2.8 km by road. Singasandra is the next station towards Hosa Road, so 1.2 km is plausible.
- **Metro time to Bommasandra "about 10 minutes"** looks too short: from Hosa Road to the Bommasandra terminus is several stations (Beratena Agrahara, Electronic City, Konappana Agrahara, Huskur Road, Hebbagodi, Delta Electronics Bommasandra, Bommasandra). Check the real journey time on BMRCL or Google Maps and correct the page if needed. The same check applies to Hebbagodi, Electronic City and Bommanahalli.
- Distances to Narayana Health City, Electronic City campuses and Bommanahalli: re-measure by car and metro, and write the date measured. Do not publish a distance you have not measured.
- Amenity claims used across the site (free parking, lift, 24-hour desk, free Wi-Fi, free luggage storage, "2-minute walk"): confirm each is true today, because they appear in titles, descriptions and schema.

Pages should only exist where the hotel is a genuinely useful answer. The current ten are reasonable for the target list. **Do not add more** until each existing page has real photos of the route, a short real "how to reach us from X" section written by staff, and measured impressions in Search Console.

## 5. Google Business Profile and off-site work (cannot be done from code)

These need the owner's Google account and are the biggest drivers of "near me" and map-pack visibility.

1. **Claim / verify** the Google Business Profile for YES HOTELS at the exact address. Use the real business name (no keywords added).
2. Category **Hotel**; add real attributes (parking, Wi-Fi, 24-hour front desk, lift), hours, phone, website `https://yeshotels.in`, and the booking link.
3. Upload real photos: entrance, lobby, each room type, bathroom, signage, the walk from Hosa Road Metro Station. Add 3–5 new photos a month.
4. **One name, address and phone everywhere**: GBP, Expedia, Booking.com, MakeMyTrip, Goibibo, TripAdvisor, justdial, the website. Ask Expedia and the others to correct the conflicting address (the current listings disagree).
5. **Reviews: ask real guests** after checkout with a short link or QR code at the desk. Reply to every review. Never buy, filter or write reviews.
6. Post updates (offers for monthly stays, events) at a steady rhythm; answer Q&A.
7. Legitimate local links: Electronic City and Bommasandra business associations, nearby companies' travel desks and vendor lists, medical-travel facilitators for Narayana Health, local news or college event pages, partners such as taxi and airport-transfer firms, and the hotel's own social profiles. Ask for a link only where the hotel is genuinely useful to that audience.
8. Corporate outreach: a short "stay with us" page and rate sheet for HR and travel desks of Electronic City employers (needs the owner's commercial terms).

## 6. Measurement

1. **Search Console**: verify `https://yeshotels.in` as a Domain property (DNS TXT record) and submit `https://yeshotels.in/sitemap.xml`. Record impressions, clicks, average position and click-through rate by page and by query for the target groups. Capture a baseline before the next release and review weekly.
2. **GA4**: create a property, then set the server environment variable `GA_MEASUREMENT_ID=G-XXXXXXXXXX` and restart. The site then reports `page_view`, `search_availability`, `begin_checkout` and `purchase`. In GA4 mark `purchase` and `search_availability` as key events, link GA4 to Search Console, and build a report for "Organic Search" sessions → availability searches → checkouts → purchases → revenue.
3. **First-party record** (already built): each website booking stores the landing page and campaign it came from; use it as the source of truth for organic booking revenue, since GA4 can be blocked by browsers.
4. **Google Business Profile Insights**: calls, direction requests, website clicks, search terms.
5. Because booking is by phone while online booking is on hold, add a **dedicated tracking phone number or a "mention where you found us" field** at reception and log it, or direct bookings from search cannot be counted.
6. If analytics cookies are used for visitors in India, add a short privacy-policy line about analytics (the site's privacy page should be updated by whoever owns legal text).

## 7. Prioritised backlog (value ÷ effort)

| Priority | Task | Value | Effort | Owner |
|---|---|---|---|---|
| 1 | Verify Search Console and submit sitemap | High | 30 min | Owner |
| 2 | Claim/complete Google Business Profile with real photos and exact NAP | Very high | 2–3 h | Owner |
| 3 | Reopen online booking (or capture phone leads properly) | Very high | Switch | Owner |
| 4 | Confirm the facts on the ten location pages (section 4) and correct any that are wrong | High | 2 h | Owner + me |
| 5 | Deploy the code changes in section 3 (needs approval) | High | Done in code | Approval |
| 6 | Create GA4 and set `GA_MEASUREMENT_ID` | High | 30 min | Owner |
| 7 | Fix address on Expedia and other third-party listings | High | 1–2 h | Owner |
| 8 | Start a real review-request routine at checkout | High | Ongoing | Reception |
| 9 | Add real route photos and a staff-written "how to reach us" to each location page | Medium–high | 1 day | Owner + me |
| 10 | Page speed: split the JavaScript bundle, compress/size images, self-host fonts | Medium | 2–3 days | Me |
| 11 | Add `sameAs`, map link, room count, opening hours to the Hotel schema; add rating markup **only** once real reviews exist | Medium | Half day | Me |
| 12 | Original content: "Staying near Electronic City for work" guide, "Getting from the airport / Majestic / Silk Board by metro", "Visiting Narayana Health City: where to stay" (accurate, dated, useful) | Medium | Ongoing | Owner + me |
| 13 | Local link building (section 5, item 7) | Medium, slow | Ongoing | Owner |

## 8. 90-day roadmap

KPIs are measured against the baseline captured in week 1; targets are set after the baseline exists, not before.

| Week | Tasks | KPI / output | Depends on |
|---|---|---|---|
| 1 | Verify Search Console, submit sitemap. Create GA4 and set the id. Claim the Business Profile. Record baseline: impressions, clicks, average position for the nine query groups; GBP views, calls, directions | Baseline sheet filled | Owner's Google account |
| 2 | Approve and deploy section 3. Confirm location-page facts (section 4) and correct them. Decide on the online-booking hold. Complete GBP (categories, attributes, hours, 15+ real photos) | Pages indexed; GBP complete | Approval; photos |
| 3 | Correct Expedia and other listings' address and name. Start review requests (QR at desk, post-checkout message) | Listings consistent; first real reviews | Owner access to extranets |
| 4 | Route photos and a staff-written "how to reach us" on the Hosa Road, Hosa Road Metro and Singasandra pages | Pages updated | Photos |
| 5 | Same for Electronic City, Kudlu Gate, Bommanahalli pages. Review Search Console queries: which pages get impressions but few clicks → rewrite titles/descriptions | CTR change on edited pages | Week 1 baseline |
| 6 | Publish guide 1 (staying near Electronic City for work, with parking, Wi-Fi, desk hours, monthly-stay terms) | Page indexed | Owner terms |
| 7 | Page speed work: bundle splitting, image sizes, fonts | Faster load on mobile (measure in PageSpeed Insights) | — |
| 8 | Publish guide 2 (Narayana Health City visitors: transport, distance, family stays) | Page indexed | Distances measured |
| 9 | Corporate outreach pack and rate sheet; contact HR/travel desks of nearby employers | Enquiries from corporates | Commercial terms |
| 10 | Local link outreach (associations, partners, medical facilitators); Business Profile posts weekly | New real referring sites | — |
| 11 | Add `sameAs`, map link, room count and hours to schema; add rating markup if and only if real reviews exist | Rich result test passes | Reviews |
| 12 | Review funnel: Organic sessions → availability searches → checkouts → bookings → revenue; find the biggest drop and fix it | Funnel report | GA4 live ≥ 4 weeks |
| 13 | Quarter review: what grew, what did not; choose the next ten tasks; retire pages that earn nothing | 90-day report | All of the above |

## 9. The next ten actions

1. Approve the deploy of the code changes (section 3), or tell me what to change first.
2. Verify Search Console for `yeshotels.in` and submit the sitemap.
3. Claim and complete the Google Business Profile with the exact legal name and address.
4. Decide whether to reopen online booking now (Admin → Settings → Online booking on the website).
5. Walk the route from Hosa Road Metro Station to the entrance, time it, and take photos; confirm the "100 m / 2 minutes" claim.
6. Re-measure the distances and travel times on the ten location pages and give me the corrections (metro time to Bommasandra first).
7. Create a GA4 property and give me the measurement id to set on the server (it is not a secret, but keep it out of chat if you prefer to set it yourself).
8. Correct the address on Expedia and the other listings so every site shows the same name, address and phone.
9. Start asking every checked-out guest for a real review with a QR code at the desk.
10. Choose the first original guide to write (Electronic City business stay or Narayana Health City visitors) and give me the real facts to include.

## Sources used

- [Hosa Road metro station (Wikipedia)](https://en.wikipedia.org/wiki/Hosa_Road_metro_station), [Kudlu Gate metro station (Wikipedia)](https://en.wikipedia.org/wiki/Kudlu_Gate_metro_station), [Beratena Agrahara metro station (Wikipedia)](https://en.wikipedia.org/wiki/Beratena_Agrahara_metro_station)
- [YES HOTELS on Expedia India](https://www.expedia.co.in/Bengaluru-Hotels-YES-HOTELS.h133987863.Hotel-Information)
- [Townhouse Singasandra Hosa Road](https://www.travelocity.com/Bengaluru-Hotels-Townhouse-Singasandra-Hosa-Road.h103853618.Hotel-Information), [Olive Hotel Hosa Road Metro (listing)](https://all-boutique-hotels.com/bangalore-city_electronic-city/)
- [Samrudhi Park](https://www.hrs.com/en/hotel/901472), [OYO business travellers, Electronic City](https://www.oyorooms.com/hotels-in-electronic-city-bangalore/business-travellers/), [Clarks Inn Electronic City](https://spalba.com/properties/clarks-inn-bengaluru-6039)
- [Hotels near Narayana Health City (trip.com)](https://de.trip.com/hot/hotels-in-der-n%C3%A4he-narayana-health-city), [Super Townhouse Bommanahalli](https://www.lastminute.com/hotels/india/bangalore/oyo-townhouse-273-hosur-main-road-bommanahalli_hid-8714979)
- [Google Business Profile help: improve your local ranking](https://support.google.com/business/answer/7091)
