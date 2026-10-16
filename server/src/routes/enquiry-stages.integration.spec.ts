/**
 * Website / chatbot leads on the Enquiries page: email is required, one enquiry per guest moves
 * through the stages (with history and last activity), the room type id becomes its name, the
 * failure reason is kept, and making the booking marks the enquiry converted / completed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { createServer } from "../../index";

const tag = new mongoose.Types.ObjectId().toString().slice(-6);
const phone = `98${tag.replace(/[a-f]/g, "7")}11`.slice(0, 10);
const email = `lead-${tag}@example.com`;
const categoryId = new mongoose.Types.ObjectId();
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;

const post = async (body: Record<string, unknown>) => {
  const res = await fetch(base + "/api/booking-enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const lead = (extra: Record<string, unknown> = {}) => ({
  guestName: `Lead ${tag}`, email, phone, checkIn: "2026-12-01", checkOut: "2026-12-03", adults: 2, source: "WEBSITE", ...extra,
});

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  await db().collection("roomcategories").insertOne({ _id: categoryId, name: `Executive ${tag}`, slug: `exec-lead-${tag}` });
});

afterAll(async () => {
  await db().collection("bookingenquiries").deleteMany({ phone });
  await db().collection("roomcategories").deleteMany({ _id: categoryId });
  await new Promise((r) => server.close(r));
});

describe("Website / chatbot enquiry stages", () => {
  it("refuses a lead without a valid email", async () => {
    expect((await post(lead({ email: "" }))).status).toBe(400);
    expect((await post(lead({ email: "not-an-email" }))).status).toBe(400);
  });

  it("refuses an unknown stage", async () => {
    expect((await post(lead({ bookingStage: "BOOKING_COMPLETED" }))).status).toBe(400);
  });

  it("records each stage on one enquiry, with history, the room type name and the failure reason", async () => {
    const a = await post(lead({ bookingStage: "WEBSITE_GUEST_DETAILS", roomCategoryId: String(categoryId), roomType: "Room" }));
    expect(a.status).toBe(201);
    const b = await post(lead({ bookingStage: "WEBSITE_PAYMENT_PAGE", roomCategoryId: String(categoryId), roomType: "Room" }));
    expect(b.status).toBe(200);
    const c = await post(lead({ bookingStage: "WEBSITE_BOOKING_FAILED", reason: "Room just sold out", roomCategoryId: String(categoryId), roomType: "Room" }));
    expect(c.status).toBe(200);
    expect(c.json.data.id).toBe(a.json.data.id);

    const enq: any = await db().collection("bookingenquiries").findOne({ _id: new mongoose.Types.ObjectId(a.json.data.id) });
    expect(enq.bookingStage).toBe("WEBSITE_BOOKING_FAILED");
    expect(enq.stageHistory.map((h: any) => h.stage)).toEqual(["WEBSITE_GUEST_DETAILS", "WEBSITE_PAYMENT_PAGE", "WEBSITE_BOOKING_FAILED"]);
    expect(enq.stageHistory[2].reason).toBe("Room just sold out");
    expect(enq.roomType).toBe(`Executive ${tag}`);
    expect(enq.email).toBe(email);
    expect(enq.lastActivityAt).toBeInstanceOf(Date);
  });

  it("the same stage again doesn't repeat in the history", async () => {
    await post(lead({ bookingStage: "WEBSITE_BOOKING_FAILED" }));
    const enq: any = await db().collection("bookingenquiries").findOne({ phone });
    expect(enq.stageHistory.filter((h: any) => h.stage === "WEBSITE_BOOKING_FAILED" && !h.reason)).toHaveLength(0);
  });
});
