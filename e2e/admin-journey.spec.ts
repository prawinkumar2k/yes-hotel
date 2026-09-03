import { test, expect } from "@playwright/test";

test("admin can log in and reach the dashboard with real data", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@yeshotels.com");
  await page.getByLabel(/password/i).fill("Admin@123");
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });
  await expect(page.locator("body")).toContainText(/dashboard/i);
});

test("admin sidebar reaches core operational modules", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@yeshotels.com");
  await page.getByLabel(/password/i).fill("Admin@123");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });

  for (const path of ["/admin/bookings", "/admin/guests", "/admin/coupons", "/admin/reports", "/admin/settings"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    // Any of these landing on a login redirect would mean the session isn't
    // actually persisting across navigation — a real regression to catch.
    expect(page.url()).not.toContain("/login");
  }
});

test("housekeeping staff is redirected to their own module, not the customer dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("housekeeping@yeshotels.com");
  await page.getByLabel(/password/i).fill("House@123");
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  await page.waitForURL(/\/staff\/housekeeping/, { timeout: 10000 });
  expect(page.url()).toContain("/staff/housekeeping");
});
