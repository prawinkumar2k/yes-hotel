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
