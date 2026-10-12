import { Request, Response } from "express";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { Folio, FolioStatus } from "../models/Folio";
import { postCharge } from "../services/folio.service";
import { FolioLineType } from "../models/FolioLine";
import { createAuditLog } from "../services/audit.service";
import { Room } from "../models/Room";
import { MenuItem } from "../models/MenuItem";
import { taxService } from "../services/tax.service";

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
    const { formattedItems, subtotal, foodTax, taxAmount, grandTotal } = priced;
    const kotNumber = `KOT-${Date.now()}`;

    let folioId: string | undefined = undefined;
    let bookingId: string | undefined = undefined;

    // Room charge integration: post to live folio if roomNumber specified and chargeToFolio is true
    if (chargeToFolio && roomNumber) {
      const room = await Room.findOne({ roomNumber });
      if (!room || !room.currentBooking) {
        return res.status(400).json({
          success: false,
          message: `Cannot charge to Room ${roomNumber}: Room is not currently occupied by a checked-in guest.`,
        });
      }

      bookingId = room.currentBooking.toString();
      const folio = await Folio.findOne({ booking: room.currentBooking, status: FolioStatus.OPEN });
      if (!folio) {
        return res.status(400).json({
          success: false,
          message: `Cannot charge to Room ${roomNumber}: Guest has no open folio available for posting.`,
        });
      }

      folioId = folio._id.toString();

      // Post the taxable amount and its GST as separate lines, same
      // convention as room charges (checkIn/night-audit split CGST+SGST
      // rather than folding tax into the charge). Before this, the entire
      // grandTotal (subtotal + tax) was posted as one RESTAURANT line, so
      // folio.totalTax/cgst/sgst silently under-reported every restaurant
      // charge's GST — a real gap for GST filing, which needs cgst+sgst
      // collected across ALL revenue streams, not just room tariff.
      await postCharge(
        {
          folioId,
          bookingId,
          lineType: FolioLineType.RESTAURANT,
          description: `Restaurant Order ${kotNumber} (Room Service)`,
          amount: subtotal,
          date: new Date(),
          postedBy: actorId?.toString() || "POS_SYSTEM",
        },
        { req }
      );

      if (taxAmount > 0) {
        const { cgst, sgst } = foodTax;

        await postCharge(
          {
            folioId,
            bookingId,
            lineType: FolioLineType.TAX_CGST,
            description: `CGST on Restaurant Order ${kotNumber}`,
            amount: cgst,
            date: new Date(),
            postedBy: actorId?.toString() || "POS_SYSTEM",
          },
          { req }
        );

        await postCharge(
          {
            folioId,
            bookingId,
            lineType: FolioLineType.TAX_SGST,
            description: `SGST on Restaurant Order ${kotNumber}`,
            amount: sgst,
            date: new Date(),
            postedBy: actorId?.toString() || "POS_SYSTEM",
          },
          { req }
        );
      }
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

    const order = await RestaurantOrder.findByIdAndUpdate(id, { status }, { new: true });
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
        ...(action === "VOID" ? { voidReason: reason.trim(), voidedAmount: (existing as any).totalAmount } : {}),
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

