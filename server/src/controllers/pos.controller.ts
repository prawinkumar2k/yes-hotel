import { Request, Response } from "express";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { Folio, FolioStatus } from "../models/Folio";
import { postCharge } from "../services/folio.service";
import { FolioLineType } from "../models/FolioLine";
import { createAuditLog } from "../services/audit.service";
import { Room } from "../models/Room";
import { MenuItem } from "../models/MenuItem";

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

    // Re-price every line server-side from the MenuItem catalog. A client
    // can specify WHICH item and HOW MANY, never the price — the same
    // "never trust client-sent tax" principle already applied to GST
    // elsewhere in this codebase (folio.service.ts calculateTaxBreakdown).
    // Before this, createPosOrder took item.name/item.unitPrice directly
    // from the request body with no server-side check at all.
    const menuItemIds = items.map((item: any) => item.menuItemId).filter(Boolean);
    if (menuItemIds.length !== items.length) {
      return res.status(400).json({ success: false, message: "Every order line must reference a menuItemId" });
    }

    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } }).lean();
    const menuItemById = new Map(menuItems.map((m) => [m._id.toString(), m]));

    let subtotal = 0;
    let taxAmount = 0;
    const formattedItems = items.map((item: any) => {
      const menuItem = menuItemById.get(String(item.menuItemId));
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      if (!menuItem.isActive || !menuItem.isAvailable) {
        throw new Error(`"${menuItem.name}" is currently unavailable`);
      }

      const q = Math.max(1, Number(item.quantity) || 1);
      const tot = q * menuItem.price;
      subtotal += tot;
      taxAmount += tot * (menuItem.taxRatePercent / 100);

      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: q,
        unitPrice: menuItem.price,
        totalPrice: tot,
        specialInstructions: item.specialInstructions,
      };
    });

    taxAmount = Math.round(taxAmount * 100) / 100;
    const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;
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
      await postCharge(
        {
          folioId,
          bookingId,
          lineType: FolioLineType.RESTAURANT,
          description: `Restaurant Order ${kotNumber} (Room Service)`,
          amount: grandTotal,
          date: new Date(),
          postedBy: actorId?.toString() || "POS_SYSTEM",
        },
        { req }
      );
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
    const { status } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid order status: ${status}` });
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
      action: "pos.order_status_updated",
      resourceType: "RestaurantOrder",
      resourceId: order._id.toString(),
      metadata: { kotNumber: order.kotNumber, newStatus: status },
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

