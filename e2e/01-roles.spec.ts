import { test, expect } from '@playwright/test';

// The hotel's logins (demo passwords from `pnpm seed`, local test database only).
const ROLES = [
  { email: 'admin@yeshotels.com', pass: 'Admin@123', expectPath: '/admin' },
  { email: 'manager@yeshotels.com', pass: 'Manager@123', expectPath: '/admin' },
  { email: 'reception@yeshotels.com', pass: 'Reception@123', expectPath: '/front-desk/dashboard' },
  { email: 'housekeeping@yeshotels.com', pass: 'House@123', expectPath: '/housekeeping/dashboard' },
  { email: 'customer@yeshotels.com', pass: 'Customer@123', expectPath: '/' },
];

test.describe('Role Browser Acceptance', () => {
  for (const role of ROLES) {
    test(`Login and routing for ${role.email}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto('/login');
      await page.fill('input[type="email"]', role.email);
      await page.fill('input[type="password"]', role.pass);
      await page.click('button[type="submit"]');

      await page.waitForURL('**' + role.expectPath + '**', { timeout: 10000 });
      await page.waitForTimeout(2000); // let the landing page load its data

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('Application Error');
      expect(errors, `page errors for ${role.email}`).toEqual([]);
    });
  }
});
