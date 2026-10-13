import { Request, Response } from "express";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { Folio, FolioStatus } from "../models/Folio";
import { postCharge } from "../services/folio.service";
import { FolioLineType } from "../models/FolioLine";
import { createAuditLog } from "../services/audit.service";
import { Room } from "../models/Room";
import { MenuItem } from "../models/MenuItem";
import { taxService } from "../services/tax.service";
import mongoose from "mongoose";
import { Booking, BookingStatus } from "../models/Booking";
import { nextSequence } from "../services/counter.service";
import { todayBusinessDate } from "../../../shared/dates";

/** The in-house stay in a room now (a CHECKED_IN booking assigned to it), from bookings, not a cached pointer. */
async function inHouseStayForRoom(roomNumber: string, session?: mongoose.ClientSession) {
  const room = await Room.findOne({ roomNumber }).session(session ?? null);
  if (!room) return { error: `Room ${roomNumber} not found` } as const;
  const booking = await Booking.findOne({ assignedRoom: room._id, status: BookingStatus.CHECKED_IN }).session(session ?? null);
  if (!booking) return { error: `Room ${roomNumber} has no checked-in guest` } as const;
  const folio = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN }).session(session ?? null);
  if (!folio) return { error: `Room ${roomNumber}: the guest has no open folio` } as const;
  return { room, booking, folio } as const;
}

async function nextKotNumber() {
  const ymd = todayBusinessDate().replace(/-/g, "");
  return `KOT-${ymd}-${String(await nextSequence(`kot:${ymd}`)).padStart(4, "0")}`;
}

/**
 * GET /api/pos/orders
 */
export const getPosOrders = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const orders = await RestaurantOrder.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Prices an order from the MenuItem catalog (never from client-sent prices) with
 * restaurant GST from taxService. Used by createPosOrder and POST /api/pos/orders/quote.
 * Throws with a user-facing message for unknown or unavailable items.
 */
export async function priceOrder(items: Array<{ menuItemId?: string; quantity?: number; specialInstructions?: string }>) {
  const menuItemIds = items.map((item) => item.menuItemId).filter(Boolean);
  if (menuItemIds.length !== items.length) throw new Error("Every order line must reference a menuItemId");

  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } }).lean();
  const menuItemById = new Map(menuItems.map((m) => [m._id.toString(), m]));

  let subtotal = 0;
  const formattedItems = items.map((item) => {
    const menuItem = menuItemById.get(String(item.menuItemId));
    if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
    if (!menuItem.isActive || !menuItem.isAvailable) throw new Error(`"${menuItem.name}" is currently unavailable`);
    const q = Math.max(1, Number(item.quantity) || 1);
    const tot = q * menuItem.price;
    subtotal += tot;
    return {
      menuItem: menuItem._id,
      name: menuItem.name,
      quantity: q,
      unitPrice: menuItem.price,
      totalPrice: tot,
      specialInstructions: item.specialInstructions,
    };
  });

  // Restaurant GST (FOOD rule); per-item MenuItem.taxRatePercent is not used for GST.
  const foodTax = await taxService.supply("FOOD", new Date(), subtotal);
  return { formattedItems, subtotal, foodTax, taxAmount: foodTax.tax, grandTotal: foodTax.total };
}

/** POST /api/pos/orders/quote — read-only: what createPosOrder would charge for these lines. */
export const quotePosOrder = async (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.json({ success: true, data: { subtotal: 0, cgst: 0, sgst: 0, taxAmount: 0, grandTotal: 0, rate: 0 } });
    const p = await priceOrder(items);
    return res.json({
      success: true,
      data: { subtotal: p.subtotal, cgst: p.foodTax.cgst, sgst: p.foodTax.sgst, taxAmount: p.taxAmount, grandTotal: p.grandTotal, rate: p.foodTax.lines[0]?.rate ?? 0 },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/pos/orders
 * Creates a new KOT order, and optionally posts room service charge directly to Folio.
 */
export const createPosOrder = async (req: Request, res: Response) => {
  try {
    const { tableNumber, roomNumber, items, chargeToFolio, notes } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must contain at least one item" });
    }

    // Re-price every line server-side (a client sends which item and how many, never the price).
    let priced: Awaited<ReturnType<typeof priceOrder>>;
    try {
      priced = await priceOrder(items);
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
    const { formattedItems, subtotal, taxAmount, grandTotal } = priced;
    const kotNumber = await nextKotNumber();

    // A room-service order must be for an in-house guest. Nothing is posted yet: the charge goes
    // to the folio when the bill is settled (after the kitchen has served it).
    let folioId: string | undefined = undefined;
    let bookingId: string | undefined = undefined;
    if (chargeToFolio && roomNumber) {
      const stay = await inHouseStayForRoom(String(roomNumber));
      if ("error" in stay) return res.status(400).json({ success: false, message: `Cannot charge to room: ${stay.error}` });
      bookingId = String(stay.booking._id);
      folioId = String(stay.folio._id);
    }

    const order = await RestaurantOrder.create({
      kotNumber,
      tableNumber,
      roomNumber,
      bookingId,
      folioId,
      items: formattedItems,
      subtotal,
      taxAmount,
      grandTotal,
      status: OrderStatus.KITCHEN_PENDING,
      chargeToFolio: !!chargeToFolio,
      notes,
    });

    await createAuditLog({
      req,
      action: "pos.order_created",
      resourceType: "RestaurantOrder",
      resourceId: order._id.toString(),
      metadata: { kotNumber, grandTotal, chargeToFolio, folioId },
    });

    return res.json({
      success: true,
      message: `KOT Order ${kotNumber} created & sent to Kitchen KDS`,
      data: order,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// KDS lifecycle is strictly forward-moving. Without this, updateOrderStatus
// previously accepted any enum value regardless of the order's current
// status — including reverting an already-BILLED order (already invoiced,
// and if chargeToFolio, already posted to the guest's folio) straight back
// to KITCHEN_PENDING, which would resurrect it on the kitchen's live KDS
// screen. BILLED/CANCELLED are terminal; nothing transitions out of them.
const LEGAL_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.KITCHEN_PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.CANCELLED],
  [OrderStatus.SERVED]: [OrderStatus.BILLED, OrderStatus.CANCELLED],
  [OrderStatus.BILLED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * PATCH /api/pos/orders/:id/status
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid order status: ${status}` });
    }

    // RESTAURANT runs the kitchen flow, CASHIER settles (BILLED), MANAGER voids (CANCELLED).
    const action = status === OrderStatus.BILLED ? "SETTLE" : status === OrderStatus.CANCELLED ? "VOID" : "EDIT";
    const { PermissionService } = await import("../services/PermissionService");
    if (!(await PermissionService.can((req as any).user, "RESTAURANT_POS", action, String((req as any).propertyId || "default")))) {
      return res.status(403).json({ success: false, message: `Forbidden: You lack ${action} permission for RESTAURANT_POS` });
    }
    if (status === OrderStatus.BILLED) {
      return res.status(400).json({ success: false, message: "Use Settle Bill to bill an order (room folio, cash, card or UPI)" });
    }
    if (action === "VOID" && (typeof reason !== "string" || reason.trim().length < 3)) {
      return res.status(400).json({ success: false, message: "A reason (at least 3 characters) is required to void an order" });
    }

    const existing = await RestaurantOrder.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Order not found" });

    if (existing.status !== status && !LEGAL_ORDER_TRANSITIONS[existing.status as OrderStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition order from ${existing.status} to ${status}`,
      });
    }

    const order = await RestaurantOrder.findByIdAndUpdate(
      id,
      { status, ...(action === "VOID" ? { voidReason: reason.trim() } : {}) },
      { returnDocument: "after" },
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    await createAuditLog({
      req,
      action: action === "VOID" ? "pos.order_voided" : "pos.order_status_updated",
      resourceType: "RestaurantOrder",
      resourceId: order._id.toString(),
      metadata: {
        kotNumber: order.kotNumber,
        previousStatus: existing.status,
        newStatus: status,
        ...(action === "VOID" ? { voidReason: reason.trim(), voidedAmount: existing.grandTotal } : {}),
      },
    });

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


const SettleSchema = {
  modes: ["ROOM", "CASH", "CARD", "UPI"] as const,
};

/**
 * POST /api/pos/orders/:id/settle  { mode: "ROOM" | "CASH" | "CARD" | "UPI", roomNumber?, reference? }
 * Bills a SERVED order. ROOM posts the food charge and its GST to the in-house guest's folio;
 * other modes record the money taken (counted in the cashier's drawer when CASH).
 * Everything happens in one transaction.
 */
export const settlePosOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { mode, roomNumber, reference } = req.body ?? {};
    if (!SettleSchema.modes.includes(mode)) {
      return res.status(400).json({ success: false, message: "Choose how the bill is settled: ROOM, CASH, CARD or UPI" });
    }
    if ((mode === "CARD" || mode === "UPI") && !(typeof reference === "string" && reference.trim())) {
      return res.status(400).json({ success: false, message: `A ${mode} reference (approval code / UTR) is required` });
    }
    const actorId = String((req as any).user?.id || (req as any).user?._id);
    let settled: any;
    await session.withTransaction(async () => {
      const order = await RestaurantOrder.findById(req.params.id).session(session);
      if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
      if (order.status !== OrderStatus.SERVED) {
        throw Object.assign(new Error(`Only a SERVED order can be billed (this one is ${order.status})`), { status: 400 });
      }
      // GST was fixed when the order was priced (FOOD rule); split it into CGST + SGST.
      const cgst = Math.round((order.taxAmount / 2) * 100) / 100;
      const sgst = Math.round((order.taxAmount - cgst) * 100) / 100;

      if (mode === "ROOM") {
        const target = String(roomNumber || order.roomNumber || "");
        if (!target) throw Object.assign(new Error("Which room should the bill be charged to?"), { status: 400 });
        const stay = await inHouseStayForRoom(target, session);
        if ("error" in stay) throw Object.assign(new Error(`Cannot charge to room: ${stay.error}`), { status: 400 });
        const folioId = String(stay.folio._id);
        const bookingId = String(stay.booking._id);
        const post = (lineType: FolioLineType, description: string, amount: number) =>
          postCharge({ folioId, bookingId, lineType, description, amount, date: new Date(), postedBy: actorId }, { req, session });
        await post(FolioLineType.RESTAURANT, `Restaurant ${order.kotNumber}`, order.subtotal);
        if (cgst > 0) await post(FolioLineType.TAX_CGST, `CGST on ${order.kotNumber}`, cgst);
        if (sgst > 0) await post(FolioLineType.TAX_SGST, `SGST on ${order.kotNumber}`, sgst);
        order.folioId = stay.folio._id as any;
        order.bookingId = stay.booking._id as any;
        order.roomNumber = target;
        order.chargeToFolio = true;
      }
      order.settlement = { mode, amount: order.grandTotal, settledBy: actorId as any, settledAt: new Date(), reference: reference?.trim() };
      order.status = OrderStatus.BILLED;
      await order.save({ session });
      settled = order;
    });

    await createAuditLog({
      req,
      action: "pos.order_settled",
      resourceType: "RestaurantOrder",
      resourceId: String(settled._id),
      metadata: { kotNumber: settled.kotNumber, mode: settled.settlement.mode, amount: settled.grandTotal, folioId: settled.folioId ? String(settled.folioId) : undefined },
    });
    return res.json({ success: true, message: `${settled.kotNumber} billed (${settled.settlement.mode})`, data: settled });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};
