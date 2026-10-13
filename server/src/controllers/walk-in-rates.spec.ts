import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { RoomCategory } from "../models/RoomCategory";
import { Room } from "../models/Room";
import { calculateRegistrationRate } from "./walk-in-registration.controller";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const P = oid();
let categoryId = "";
const rooms: string[] = [];

function call(body: any) {
  const req: any = { body, params: {}, propertyId: P, user: { id: String(oid()), role: "RECEPTIONIST" }, headers: {}, ip: "127.0.0.1" };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return calculateRegistrationRate(req, res).then(() => res);
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const c = await RoomCategory.create({ slug: `wr-${tag}`, name: `Wr ${tag}`, description: "test", basePrice: 3500, isActive: true } as any);
  categoryId = String(c._id);
  for (const n of [1, 2]) rooms.push(String((await Room.create({ propertyId: P, roomNumber: `W${tag}${n}`, category: c._id, floor: "9" } as any))._id));
});

afterAll(async () => {
  await Room.deleteMany({ _id: { $in: rooms } });
  await RoomCategory.deleteMany({ _id: categoryId });
  await mongoose.connection.close();
});

describe("walk-in tariffs", () => {
  it("each room uses its own typed tariff; extra persons use the typed per-person rates", async () => {
    const res = await call({
      roomIds: rooms,
      checkIn: "2031-08-01",
      checkOut: "2031-08-03", // 2 nights
      roomRates: { [rooms[0]]: 3000, [rooms[1]]: 4200 },
      extraPersonsNoBed: 2,
      extraChildrenWithBed: 1,
      extraRates: { extraPersonRate: 500, extraBedRate: 1500, childRateNoBed: 300, childRateWithBed: 700 },
    });
    expect(res.statusCode).toBe(200);
    const d = res.body.data;
    expect(d.rooms.map((r: any) => r.ratePerNight).sort()).toEqual([3000, 4200]);
    expect(d.roomCharges).toBe(14400); // (3000 + 4200) × 2
    expect(d.extraPersonTotal).toBe(2000); // 2 × 500 × 2
    expect(d.childWithBedTotal).toBe(1400); // 1 × 700 × 2
  });

  it("blank rates fall back to the category tariff and property defaults", async () => {
    const res = await call({ roomIds: [rooms[0]], checkIn: "2031-08-01", checkOut: "2031-08-02", extraPersonsNoBed: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.rooms[0].ratePerNight).toBe(3500);
    expect(res.body.data.extraPersonRate).toBeGreaterThan(0);
  });
});
