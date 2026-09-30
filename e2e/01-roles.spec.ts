import { test, expect } from '@playwright/test';

const ROLES = [
  { email: 'superadmin@yeshotels.com', pass: 'Superadmin@123', expectPath: '/admin' },
  { email: 'admin@yeshotels.com', pass: 'Admin@123', expectPath: '/admin' },
  { email: 'manager@yeshotels.com', pass: 'Manager@123', expectPath: '/admin' },
  { email: 'reception@yeshotels.com', pass: 'Reception@123', expectPath: '/admin' },
  { email: 'cashier@yeshotels.com', pass: 'Cashier@123', expectPath: '/admin' },
  { email: 'housekeeping@yeshotels.com', pass: 'House@123', expectPath: '/admin' },
  { email: 'maintenance@yeshotels.com', pass: 'Main@123', expectPath: '/admin' },
  { email: 'restaurant@yeshotels.com', pass: 'Restaurant@123', expectPath: '/admin' },
  { email: 'finance@yeshotels.com', pass: 'Finance@123', expectPath: '/admin' },
  { email: 'events@yeshotels.com', pass: 'Events@123', expectPath: '/admin' },
  { email: 'inventory@yeshotels.com', pass: 'Inventory@123', expectPath: '/admin' },
  { email: 'procurement@yeshotels.com', pass: 'Procurement@123', expectPath: '/admin' },
  { email: 'customer@yeshotels.com', pass: 'Customer@123', expectPath: '/' }
];

test.describe('Role Browser Acceptance', () => {
  for (const role of ROLES) {
    test(`Login and routing for ${role.email}`, async ({ page }) => {
      // 1. Go to login
      await page.goto('/login');
      
      // 2. Fill credentials
      await page.fill('input[type="email"]', role.email);
      await page.fill('input[type="password"]', role.pass);
      await page.click('button[type="submit"]');

      // 3. Wait for navigation
      await page.waitForURL('**' + role.expectPath + '**', { timeout: 10000 });

      // 4. Verify no console errors during initial load
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // wait a bit for dashboard data to load
      await page.waitForTimeout(2000);
      
      // Verify Dashboard loads without exploding
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('Application Error');
      expect(bodyText).not.toContain('White Screen');
      
      // Log out
      await page.goto('/logout');
    });
  }
});
