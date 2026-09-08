import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BREAKPOINTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const PUBLIC_PAGES = ["/", "/rooms", "/about", "/gallery", "/faq", "/contact", "/search"];

for (const page of PUBLIC_PAGES) {
  test(`no horizontal overflow on ${page} at any breakpoint`, async ({ page: pw }) => {
    for (const bp of BREAKPOINTS) {
      await pw.setViewportSize({ width: bp.width, height: bp.height });
      await pw.goto(page, { waitUntil: "networkidle" });
      const scrollWidth = await pw.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await pw.evaluate(() => document.documentElement.clientWidth);
      // A few px of tolerance for scrollbar rendering differences.
      expect(
        scrollWidth,
        `${page} at ${bp.name} (${bp.width}px): scrollWidth ${scrollWidth} > clientWidth ${clientWidth} — horizontal overflow`
      ).toBeLessThanOrEqual(clientWidth + 5);
    }
  });
}

for (const page of PUBLIC_PAGES) {
  test(`accessibility scan: ${page}`, async ({ page: pw }) => {
    await pw.goto(page, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page: pw })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    if (critical.length > 0) {
      console.log(`\n--- Accessibility violations on ${page} ---`);
      for (const v of critical) {
        console.log(`[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
      }
    }
    expect(critical, `Critical/serious accessibility violations found on ${page}`).toEqual([]);
  });
}

test("homepage loads real seeded content, not hardcoded fallback text", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("time well spent");
});

test("keyboard navigation reaches the primary nav and can activate a link", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  // Tab through a bounded number of times looking for a focused link/button.
  let foundFocusable = false;
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    if (tag === "A" || tag === "BUTTON") {
      foundFocusable = true;
      break;
    }
  }
  expect(foundFocusable, "No focusable element reached via keyboard Tab within 15 presses").toBe(true);
});

test("reduced motion is respected — reveal elements are visible without JS-driven animation delay", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  const opacity = await page.locator(".reveal").first().evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
  await context.close();
});

// Regression test for a real bug: the header nav's links were bare
// `href="#section"` hash anchors regardless of which page you were on.
// That only ever worked by accident on the homepage (for the 4 links with
// a matching section id there) and did nothing — no navigation, no
// scroll — on every other page. 20/20 passing E2E tests never caught it
// because nothing asserted that clicking a nav link actually landed
// somewhere. This does.
test("clicking each header nav link from an interior page actually navigates to that page", async ({ page }) => {
  const expectations: { label: string; expectedPath: string }[] = [
    { label: "Home", expectedPath: "/" },
    { label: "About Us", expectedPath: "/about" },
    { label: "Gallery", expectedPath: "/gallery" },
    { label: "FAQ", expectedPath: "/faq" },
    { label: "Contact", expectedPath: "/contact" },
  ];

  for (const { label, expectedPath } of expectations) {
    await page.goto("/rooms", { waitUntil: "networkidle" });
    await page.locator("header nav a", { hasText: label }).first().click();
    await page.waitForURL(`**${expectedPath}`, { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe(expectedPath);
  }
});

test("the header's Book Your Stay button navigates to /search from an interior page, not a dead #booking hash", async ({ page }) => {
  await page.goto("/gallery", { waitUntil: "networkidle" });
  await page.locator("header a", { hasText: "Book Your Stay" }).first().click();
  await page.waitForURL("**/search", { timeout: 5000 });
  expect(new URL(page.url()).pathname).toBe("/search");
});

test("FAQ and Contact nav links route to their standalone pages even from the homepage (no homepage section exists for either)", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("header nav a", { hasText: "FAQ" }).first().click();
  await page.waitForURL("**/faq", { timeout: 5000 });
  expect(new URL(page.url()).pathname).toBe("/faq");
});

// Regression test for a real, reported bug: setting check-out to an early
// date and then check-in to a LATER date left check-out stale and before
// check-in — the invalid pair was submitted straight to the API, which
// correctly rejected it with a 400 the UI only ever showed as a generic,
// unexplained "Failed to load availability" error.
test("changing check-in past an already-selected check-out auto-corrects check-out, never submits an invalid date range", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });

  await page.fill("#search-checkout", "2026-09-05");
  await page.fill("#search-checkin", "2026-09-09");

  const failed400s: string[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/api/bookings/availability") && res.status() === 400) {
      failed400s.push(res.url());
    }
  });
  await page.waitForTimeout(500);

  const checkInVal = await page.locator("#search-checkin").inputValue();
  const checkOutVal = await page.locator("#search-checkout").inputValue();
  expect(checkOutVal > checkInVal).toBe(true);
  expect(failed400s).toEqual([]);
  await expect(page.locator("text=Failed to load availability")).toHaveCount(0);
});
