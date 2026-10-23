/**
 * A paid website booking puts its guest in the Guest Directory (as walk-ins and advance reservations do),
 * matching an existing record by email or phone instead of creating a second one.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { createServer } from "../../index";
import { syncGuestOnPaymentConfirmed } from "../services/guest.service";
import { Guest } from "../models/Guest";

const tag = String(new mongoose.Types.ObjectId()).slice(-6);
const phone = `97${String(Date.now()).slice(-8)}`;
const email = `web-${tag}@example.com`;
const stay = { amount: 13000, checkInDate: new Date("2026-12-01"), checkOutDate: new Date("2026-12-03") };

beforeAll(async () => {
  createServer();
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
});
afterAll(async () => {
  await Guest.deleteMany({ phone });
});

describe("website booking → guest directory", () => {
  it("creates the guest when there is none", async () => {
    await syncGuestOnPaymentConfirmed({ email, name: `Web Guest ${tag}`, phone, ...stay });
    const g: any = await Guest.findOne({ email }).lean();
    expect(g).toMatchObject({ fullName: `Web Guest ${tag}`, phone });
    expect(g.totalSpend).toBe(13000);
  });

  it("a second paid booking by the same guest updates the same record", async () => {
    await syncGuestOnPaymentConfirmed({ email, name: `Web Guest ${tag}`, phone, ...stay });
    expect(await Guest.countDocuments({ phone })).toBe(1);
    expect((await Guest.findOne({ email }).lean() as any).totalSpend).toBe(26000);
  });

  it("the same phone with another email does not create a second person", async () => {
    await syncGuestOnPaymentConfirmed({ email: `other-${tag}@example.com`, name: `Web Guest ${tag}`, phone, ...stay });
    expect(await Guest.countDocuments({ phone })).toBe(1);
  });
});
