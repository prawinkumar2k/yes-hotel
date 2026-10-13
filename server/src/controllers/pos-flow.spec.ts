import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { MenuItem } from "../models/MenuItem";
import { Room } from "../models/Room";
import { Booking, BookingStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { createPosOrder, updateOrderStatus, settlePosOrder } from "./pos.controller";
import { computeShiftLedger } from "../services/cashier-shift.service";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const tag = String(oid()).slice(-6);
const cashier = oid();
let menuItemId = "";
let roomNumber = "";
let bookingId: any;
const orderIds: any[] = [];

function call(handler: any, role: string, body: any, params: any = {}, userId = oid()) {
  const req: any = { body, params, propertyId: P, user: { id: String(userId), role }, headers: {}, ip: "127.0.0.1" };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return handler(req, res).then(() => {
    if (res.body?.data?._id) orderIds.push(res.body.data._id);
    return res;
  });
}

async function serve(orderId: string) {
  for (const s of [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED]) {
    const r = await call(updateOrderStatus, "RESTAURANT", { status: s }, { id: orderId });
    expect(r.statusCode).toBe(200);
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const m = await MenuItem.create({ name: `Test Thali ${tag}`, sku: `TST-${tag}`, category: "MAIN_COURSE", price: 400, taxRatePercent: 5, isActive: true, isAvailable: true } as any).catch(async (e) => {
    // category enum differs between versions: fall back to the first enum value
    const { MenuItemCategory } = await import("../models/MenuItem");
    if (!/category/.test(String(e))) throw e;
    return MenuItem.create({ name: `Test Thali ${tag}`, sku: `TST-${tag}`, category: Object.values(MenuItemCategory)[0], price: 400, taxRatePercent: 5, isActive: true, isAvailable: true } as any);
  });
  menuItemId = String(m._id);
  roomNumber = `P${tag}`;
  const room = await Room.create({ propertyId: P, roomNumber, category: oid(), floor: "9" } as any);
  const b = await Booking.create({
    propertyId: P, bookingReference: `POS-${tag}`, source: "WALK_IN",
    guestDetails: { firstName: "Pos", lastName: "Guest", email: "pos@test.local", phone: "9999999999" },
    roomCategory: oid(), assignedRoom: room._id, checkInDate: new Date(), checkOutDate: new Date(Date.now() + 86400000),
    adults: 1, totalAmount: 1000, taxAmount: 0, status: BookingStatus.CHECKED_IN,
  } as any);
  bookingId = b._id;
  await Folio.create({ propertyId: P, booking: b._id, guest: b._id, room: room._id, checkInDate: new Date(), checkOutDate: new Date(), status: FolioStatus.OPEN } as any);
});

afterAll(async () => {
  await RestaurantOrder.deleteMany({ _id: { $in: orderIds } });
  await FolioLine.deleteMany({ booking: bookingId });
  await Folio.deleteMany({ booking: bookingId });
  await Booking.deleteMany({ _id: bookingId });
  await Room.deleteMany({ roomNumber });
  await MenuItem.deleteMany({ _id: menuItemId });
  await mongoose.connection.close();
});

describe("POS flow", () => {
  it("room service needs an in-house guest; nothing is posted at order time", async () => {
    const bad = await call(createPosOrder, "RESTAURANT", { roomNumber: "NO-SUCH-ROOM", chargeToFolio: true, items: [{ menuItemId, quantity: 1 }] });
    expect(bad.statusCode).toBe(400);
    const ok = await call(createPosOrder, "RESTAURANT", { roomNumber, chargeToFolio: true, items: [{ menuItemId, quantity: 2 }] });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.data.kotNumber).toMatch(/^KOT-\d{8}-\d{4}$/);
    expect(await FolioLine.countDocuments({ booking: bookingId })).toBe(0);
  });

  it("bills only through settlement, only once served; ROOM posts the charge and GST to the folio", async () => {
    const order = await RestaurantOrder.findOne({ roomNumber }).sort({ createdAt: -1 });
    const id = String(order!._id);
    expect((await call(updateOrderStatus, "CASHIER", { status: "BILLED" }, { id })).statusCode).toBe(400);
    expect((await call(settlePosOrder, "CASHIER", { mode: "ROOM" }, { id })).statusCode).toBe(400); // not served yet
    await serve(id);
    const settled = await call(settlePosOrder, "CASHIER", { mode: "ROOM" }, { id });
    expect(settled.statusCode).toBe(200);
    expect(settled.body.data.status).toBe("BILLED");
    const lines = await FolioLine.find({ booking: bookingId }).lean();
    expect(lines.find((l) => l.lineType === FolioLineType.RESTAURANT)?.amount).toBe(800);
    expect(lines.filter((l) => l.lineType === FolioLineType.TAX_CGST || l.lineType === FolioLineType.TAX_SGST).reduce((t, l) => t + l.amount, 0)).toBe(40);
    expect((await call(settlePosOrder, "CASHIER", { mode: "ROOM" }, { id })).statusCode).toBe(400); // no double billing
  });

  it("a cash bill lands in the settling cashier's drawer", async () => {
    const created = await call(createPosOrder, "RESTAURANT", { tableNumber: "T9", items: [{ menuItemId, quantity: 1 }] });
    const id = String(created.body.data._id);
    await serve(id);
    expect((await call(settlePosOrder, "CASHIER", { mode: "CARD" }, { id })).statusCode).toBe(400); // card needs a reference
    const res = await call(settlePosOrder, "CASHIER", { mode: "CASH" }, { id }, cashier);
    expect(res.statusCode).toBe(200);
    const ledger = await computeShiftLedger({ cashier, openedAt: new Date(Date.now() - 60_000), openingFloat: 1000, paidOuts: [] });
    expect(ledger.cashCollected).toBe(420);
    expect(ledger.expectedCash).toBe(1420);
  });
});
