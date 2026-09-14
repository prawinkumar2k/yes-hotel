import { Request, Response } from "express";
import { PurchaseOrder, PurchaseOrderStatus } from "../models/PurchaseOrder";
import { Vendor } from "../models/Vendor";
import { InventoryItem } from "../models/InventoryItem";
import { StockTransaction, TransactionType } from "../models/StockTransaction";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/procurement/purchase-orders
 */
export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const orders = await PurchaseOrder.find(filter).sort({ createdAt: -1 }).populate("vendor", "name vendorCode").lean();
    return res.json({ success: true, data: orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/procurement/purchase-orders
 */
export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { vendorId, items, expectedDeliveryDate, notes } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id || "ADMIN";

    if (!vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "vendorId and at least one item are required" });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    let totalAmount = 0;
    const formattedItems = [];

    for (const rawItem of items) {
      const invItem = await InventoryItem.findById(rawItem.itemId);
      if (!invItem) continue;

      const qty = Number(rawItem.quantity) || 1;
      const cost = Number(rawItem.unitCost) || invItem.unitCost;
      const tot = qty * cost;
      totalAmount += tot;

      formattedItems.push({
        item: invItem._id,
        itemName: invItem.name,
        quantity: qty,
        unitCost: cost,
        totalCost: tot,
        receivedQuantity: 0,
      });
    }

    const poNumber = `PO-${Date.now()}`;

    const po = await PurchaseOrder.create({
      poNumber,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: formattedItems,
      totalAmount,
      status: PurchaseOrderStatus.DRAFT,
      issuedDate: new Date(),
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      notes,
      createdBy: actorId,
    });

    await createAuditLog({
      req,
      action: "procurement.po_created",
      resourceType: "PurchaseOrder",
      resourceId: po._id.toString(),
      metadata: { poNumber, vendorName: vendor.name, totalAmount },
    });

    return res.json({ success: true, message: `Purchase Order ${poNumber} created`, data: po });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/procurement/purchase-orders/:id/status
 * Update PO status & optionally auto-post GRN stock received
 */
export const updatePurchaseOrderStatus = async (req: Request, res: Response) => {
  try {
    const { status, receiveItems } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id || "ADMIN";

    if (!Object.values(PurchaseOrderStatus).includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid PO status" });
    }

    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase Order not found" });

    po.status = status;

    // If status is updated to COMPLETED and receiveItems is set, post GRN transactions for remaining items
    if ((status === PurchaseOrderStatus.COMPLETED || receiveItems) && po.items.length > 0) {
      for (const itemLine of po.items) {
        const remainingToReceive = itemLine.quantity - itemLine.receivedQuantity;
        if (remainingToReceive > 0) {
          itemLine.receivedQuantity = itemLine.quantity;

          const invItem = await InventoryItem.findById(itemLine.item);
          if (invItem) {
            invItem.currentStock += remainingToReceive;
            invItem.unitCost = itemLine.unitCost;
            await invItem.save();

            await StockTransaction.create({
              transactionNumber: `GRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              type: TransactionType.GRN,
              item: invItem._id,
              itemName: invItem.name,
              quantity: remainingToReceive,
              unitCost: itemLine.unitCost,
              totalValue: remainingToReceive * itemLine.unitCost,
              referenceNumber: po.poNumber,
              performedBy: actorId,
              notes: `Goods received against Purchase Order ${po.poNumber}`,
            });
          }
        }
      }
    }

    await po.save();

    await createAuditLog({
      req,
      action: "procurement.po_status_updated",
      resourceType: "PurchaseOrder",
      resourceId: po._id.toString(),
      metadata: { poNumber: po.poNumber, newStatus: status },
    });

    return res.json({ success: true, message: `PO status updated to ${status}`, data: po });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
