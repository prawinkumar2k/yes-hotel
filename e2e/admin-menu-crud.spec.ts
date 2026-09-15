import { test, expect } from "@playwright/test";

// Real click-through coverage for the MenuItem CRUD built during the
// production-data-integrity audit: create through the actual admin form,
// verify it renders, verify it survives a reload (real persistence, not
// component state), then disable it and verify that persists too.
test("admin can create a menu item through the UI, and it survives reload", async ({ page }) => {
  const uniqueName = `E2E Test Dish ${Date.now()}`;
  const uniqueSku = `E2E-${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@yeshotels.com");
  await page.getByLabel(/password/i).fill("Admin@123");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });

  await page.goto("/admin/menu", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /new menu item/i }).click();

  await page.getByPlaceholder("Paneer Tikka").fill(uniqueName);
  await page.getByPlaceholder("MAIN-001").fill(uniqueSku);
  await page.locator('input[type="number"]').first().fill("299");

  await page.getByRole("button", { name: /^save$/i }).click();
  // Scoped to the table row, not a bare page-wide text search: the save
  // success toast ("Notification Menu Item Created...") also contains
  // uniqueName and briefly overlaps the table on screen, so an unscoped
  // getByText(uniqueName) matches both and Playwright's strict mode
  // correctly refuses to guess which one — a real test-selector bug, not
  // a product bug (the create itself succeeds either way).
  await expect(page.locator("tr", { hasText: uniqueName })).toBeVisible({ timeout: 10000 });

  // Real persistence check: reload the page and confirm the item still
  // renders from the database, not from React state that would vanish.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("tr", { hasText: uniqueName })).toBeVisible();
  await expect(page.getByText(uniqueSku)).toBeVisible();

  // Disable it (soft-delete) and confirm that also persists across reload.
  const row = page.locator("tr", { hasText: uniqueName });
  await row.getByRole("button", { name: "Active" }).click();
  await expect(row.getByRole("button", { name: "Disabled" })).toBeVisible({ timeout: 10000 });

  await page.reload({ waitUntil: "networkidle" });
  const rowAfterReload = page.locator("tr", { hasText: uniqueName });
  await expect(rowAfterReload.getByRole("button", { name: "Disabled" })).toBeVisible();
});
