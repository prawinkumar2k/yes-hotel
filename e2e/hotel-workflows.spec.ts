/**
 * The hotel's main workflows, end to end in a real browser (local test database only):
 *   1. Website booking without online payment → "Booking Received", WEB- reference, booking email,
 *      enquiry converted with its stage history.
 *   2. Group walk-in (2 rooms) → extend only one ticked room → that room's GRC and invoice show
 *      "Stay extended"; the other room is unchanged.
 *   3. Live chat: a guest opening the chat shows "Online now" to Reception, with what they type.
 * Needs E2E_MONGODB_URI (the same test database the server uses) for the database checks.
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import mongoose from "mongoose";

const DB_URI = process.env.E2E_MONGODB_URI || "mongodb://127.0.0.1:27027/yes_hotels_e2e";
if (!/_(test|e2e)(\?|$)/.test(new URL(DB_URI.replace(/^mongodb:/, "http:")).pathname + "")) {
  throw new Error("hotel-workflows runs only against a *_test or *_e2e database");
}
const tag = Date.now().toString(36);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => ymd(new Date(Date.now() + n * 864e5));
let db: mongoose.mongo.Db;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await mongoose.connect(DB_URI);
  db = mongoose.connection.db!;
});
test.afterAll(async () => { await mongoose.disconnect(); });

async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const r = await request.post("/api/auth/login", { data: { email, password } });
  expect(r.status(), `login ${email}`).toBe(200);
  return (await r.json()).data.token as string;
}
async function uiLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
}

test("website booking without online payment: received, emailed, enquiry converted", async ({ page, request }) => {
  const cats = (await (await request.get("/api/rooms/categories")).json()).data as any[];
  const deluxe = cats.find((c) => c.slug === "deluxe-room");
  expect(deluxe, "Deluxe Room is on sale").toBeTruthy();
  const email = `web-${tag}@example.com`;
  const ci = plusDays(10), co = plusDays(12);

  await page.goto(`/booking/guest-details?category=${deluxe._id}&checkIn=${ci}&checkOut=${co}&adults=2&children=0`);
  const text = page.locator('form#guest-form input[type="text"]');
  await text.nth(0).fill("Web");
  await text.nth(1).fill(`Guest ${tag}`);
  await page.fill('form#guest-form input[type="email"]', email);
  await page.fill('form#guest-form input[type="tel"]', "9845012399");
  await page.waitForTimeout(2500); // the enquiry records "Website: guest details"
  await page.getByRole("button", { name: /continue to payment/i }).click();

  const confirm = page.getByRole("button", { name: /confirm booking · pay .* at hotel/i });
  await expect(confirm).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500); // "Website: payment page"
  await confirm.click();
  await page.waitForURL(/\/booking\/confirmation\?ref=WEB-/, { timeout: 15000 });
  await expect(page.locator("h1")).toContainText(/booking received/i);
  const ref = new URL(page.url()).searchParams.get("ref")!;

  const booking: any = await db.collection("bookings").findOne({ bookingReference: ref });
  expect(booking).toMatchObject({ status: "PENDING" });
  await expect.poll(async () => db.collection("notificationlogs").countDocuments({ recipientEmail: email, type: "BOOKING_CONFIRMATION" })).toBe(1);
  const enq: any = await db.collection("bookingenquiries").findOne({ email });
  expect(enq).toMatchObject({ status: "CONVERTED", bookingStage: "BOOKING_COMPLETED" });
  expect(enq.stageHistory.map((h: any) => h.stage)).toEqual(expect.arrayContaining(["WEBSITE_GUEST_DETAILS", "WEBSITE_PAYMENT_PAGE", "BOOKING_COMPLETED"]));
});

test("group walk-in: extend only the ticked room; GRC and invoice show the extension", async ({ page, request }) => {
  const token = await apiLogin(request, "reception@yeshotels.com", "Reception@123");
  const auth = { Authorization: `Bearer ${token}` };
  const today = (await (await request.get("/api/front-desk/summary", { headers: auth })).json()).data?.businessDate || ymd(new Date());
  const ci = String(today).slice(0, 10), co = plusDays(1) > ci ? plusDays(1) : ymd(new Date(new Date(ci).getTime() + 864e5));
  const avail = (await (await request.get(`/api/front-desk/registration/available-rooms?checkIn=${ci}&checkOut=${co}&adults=1`, { headers: auth })).json()).data as any[];
  const rooms = avail.filter((r: any) => r.available !== false && !r.unavailableReason).slice(0, 2);
  expect(rooms.length, "two free rooms").toBe(2);
  const [r1, r2] = rooms.map((r: any) => String(r._id));

  const reg = await request.post("/api/front-desk/registration/walk-in", {
    headers: auth,
    data: {
      firstName: "Group", lastName: `Walkin ${tag}`, guestName: `Group Walkin ${tag}`, email: `walkin-${tag}@example.com`, mobile: "9845012398",
      idType: "AADHAAR", idNumber: "123412341234", checkIn: ci, checkOut: co, adults: 1,
      roomId: r1, roomIds: [r1, r2], roomRates: { [r1]: 3000, [r2]: 3500 }, billingInstruction: "DIRECT",
    },
  });
  expect(reg.status(), await reg.text()).toBeLessThan(300);
  const created = ((await reg.json()).data.bookings ?? [(await reg.json()).data.booking]) as any[];
  expect(created).toHaveLength(2);
  for (const b of created) {
    if (b.status === "CONFIRMED") {
      const c = await request.post(`/api/front-desk/registration/${b._id}/check-in`, { headers: auth, data: {} });
      expect(c.status(), await c.text()).toBeLessThan(300);
    }
  }
  const [b1, b2] = created.map((b) => String(b._id));
  const room1 = (await db.collection("rooms").findOne({ _id: new mongoose.Types.ObjectId(r1) }))!.roomNumber;
  const room2 = (await db.collection("rooms").findOne({ _id: new mongoose.Types.ObjectId(r2) }))!.roomNumber;
  const before2: any = await db.collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(b2) });

  await uiLogin(page, "reception@yeshotels.com", "Reception@123");
  await page.goto("/admin/front-desk");
  await page.getByRole("button", { name: /in-house stays/i }).click();
  const row = page.locator("div, tr", { hasText: `Walkin ${tag}` }).filter({ has: page.getByRole("button", { name: /extend/i }) }).last();
  await row.getByRole("button", { name: /extend/i }).first().click();

  await expect(page.getByText("Extend Guest Stay")).toBeVisible();
  const boxes = page.locator('input[type="checkbox"]');
  await expect(boxes).toHaveCount(2, { timeout: 15000 });
  await expect(boxes.nth(0)).toBeChecked();
  await expect(boxes.nth(1)).toBeChecked();
  // Untick the second room: only room 1 is extended.
  await page.locator("label", { hasText: `Room ${room2}` }).locator('input[type="checkbox"]').uncheck();
  await page.getByRole("button", { name: /confirm extension/i }).click();
  await expect(page.getByText(/stay extended/i).first()).toBeVisible({ timeout: 15000 });

  const after1: any = await db.collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(b1) });
  const after2: any = await db.collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(b2) });
  expect(after1.stayExtensions).toHaveLength(1);
  expect(after1.stayExtensions[0].nights).toBe(1);
  expect(after2.stayExtensions ?? []).toHaveLength(0);
  expect(new Date(after2.checkOutDate).getTime()).toBe(new Date(before2.checkOutDate).getTime());

  for (const path of [`/admin/bookings/${b1}/grc-print`, `/admin/bookings/${b1}/folio-print`]) {
    await page.goto(path);
    await expect(page.getByText(/stay extended/i).first(), `${path} shows the extension (room ${room1})`).toBeVisible({ timeout: 15000 });
  }
  await page.goto(`/admin/bookings/${b2}/grc-print`);
  await expect(page.getByText(/date of dep/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/stay extended/i)).toHaveCount(0);
});

test("live chat: Reception sees the guest online and what they type", async ({ browser }) => {
  const staff = await (await browser.newContext()).newPage();
  await uiLogin(staff, "reception@yeshotels.com", "Reception@123");
  await staff.goto("/admin/live-chat");
  await expect(staff.getByText("Live", { exact: true })).toBeVisible({ timeout: 15000 });

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/");
  await guest.getByRole("button", { name: "Open YES Hotels concierge" }).click();
  await expect(staff.getByText(/online now/i).first()).toBeVisible({ timeout: 15000 });

  await guest.getByRole("button", { name: /talk to reception/i }).click();
  await guest.locator("#chat-guestName").pressSequentially(`Ravi${tag}`, { delay: 40 });
  await expect(staff.getByText(new RegExp(`typing: Ravi${tag}`)).first()).toBeVisible({ timeout: 15000 });

  await guest.close();
  await expect(staff.getByText(/online now/i)).toHaveCount(0, { timeout: 15000 });
});
