import { Request, Response } from "express";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { Folio, FolioStatus } from "../models/Folio";
import { postCharge } from "../services/folio.service";
import { FolioLineType } from "../models/FolioLine";
import { createAuditLog } from "../services/audit.service";
import { Room } from "../models/Room";

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

    let subtotal = 0;
    const formattedItems = items.map((item: any) => {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unitPrice) || 0;
      const tot = q * p;
      subtotal += tot;
      return {
        name: item.name,
        quantity: q,
        unitPrice: p,
        totalPrice: tot,
        specialInstructions: item.specialInstructions,
      };
    });

    const taxAmount = Math.round(subtotal * 0.05); // 5% Restaurant GST
    const grandTotal = subtotal + taxAmount;
    const kotNumber = `KOT-${Date.now()}`;

    let folioId: string | undefined = undefined;
    let bookingId: string | undefined = undefined;

    // Room charge integration: post to live folio if roomNumber specified and chargeToFolio is true
    if (chargeToFolio && roomNumber) {
      const room = await Room.findOne({ roomNumber });
      if (room && room.currentBooking) {
        bookingId = room.currentBooking.toString();
        const folio = await Folio.findOne({ booking: room.currentBooking, status: FolioStatus.OPEN });
        if (folio) {
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
      metadata: { kotNumber, grandTotal, chargeToFolio },
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

/**
 * PATCH /api/pos/orders/:id/status
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await RestaurantOrder.findByIdAndUpdate(id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
