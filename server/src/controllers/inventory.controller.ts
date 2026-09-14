import { Request, Response } from "express";
import { InventoryItem, ItemCategory } from "../models/InventoryItem";
import { StockTransaction, TransactionType } from "../models/StockTransaction";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/inventory
 */
export const getInventoryItems = async (req: Request, res: Response) => {
  try {
    const { category, lowStock } = req.query;
    const filter: Record<string, any> = { isActive: true };

    if (category) filter.category = category;

    let items = await InventoryItem.find(filter).sort({ name: 1 }).lean();

    if (lowStock === "true") {
      items = items.filter(item => item.currentStock <= item.minStockLevel);
    }

    return res.json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/inventory
 */
export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const { itemCode, name, category, unit, minStockLevel, currentStock, reorderQuantity, unitCost, storeLocation, notes } = req.body;

    if (!name || !unit) {
      return res.status(400).json({ success: false, message: "name and unit are required" });
    }

    const code = itemCode ? itemCode.toUpperCase() : `SKU-${Date.now().toString(36).toUpperCase()}`;

    const item = await InventoryItem.create({
      itemCode: code,
      name,
      category: category || ItemCategory.FOOD_INGREDIENT,
      unit,
      minStockLevel: Number(minStockLevel) || 10,
      currentStock: Number(currentStock) || 0,
      reorderQuantity: Number(reorderQuantity) || 50,
      unitCost: Number(unitCost) || 0,
      storeLocation: storeLocation || "Main Store",
      notes,
    });

    await createAuditLog({
      req,
      action: "inventory.item_created",
      resourceType: "InventoryItem",
      resourceId: item._id.toString(),
      metadata: { itemCode: item.itemCode, name: item.name },
    });

    return res.json({ success: true, message: "Inventory item registered", data: item });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/inventory/transaction
 * Record stock movements (GRN, ISSUE, TRANSFER, WASTAGE, ADJUSTMENT)
 */
export const recordStockTransaction = async (req: Request, res: Response) => {
  try {
    const { itemId, type, quantity, unitCost, fromStore, toStore, referenceNumber, notes } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id || "SYSTEM";

    if (!itemId || !type || !quantity) {
      return res.status(400).json({ success: false, message: "itemId, type, and quantity are required" });
    }

    const item = await InventoryItem.findById(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Inventory item not found" });

    const qty = Number(quantity);
    const cost = unitCost !== undefined ? Number(unitCost) : item.unitCost;
    const totalVal = qty * cost;

    // Apply stock delta based on transaction type
    if (type === TransactionType.GRN || type === TransactionType.RETURN) {
      item.currentStock += qty;
      if (unitCost !== undefined) item.unitCost = cost;
    } else if (type === TransactionType.ISSUE || type === TransactionType.WASTAGE) {
      if (item.currentStock < qty) {
        return res.status(400).json({ success: false, message: `Insufficient stock! Current stock: ${item.currentStock} ${item.unit}` });
      }
      item.currentStock -= qty;
    } else if (type === TransactionType.ADJUSTMENT) {
      item.currentStock = qty; // Override stock to physical count
    }

    await item.save();

    const transactionNumber = `TXN-${Date.now()}`;
    const transaction = await StockTransaction.create({
      transactionNumber,
      type,
      item: item._id,
      itemName: item.name,
      quantity: qty,
      unitCost: cost,
      totalValue: totalVal,
      fromStore,
      toStore,
      referenceNumber,
      performedBy: actorId,
      notes,
    });

    await createAuditLog({
      req,
      action: `inventory.${type.toLowerCase()}`,
      resourceType: "StockTransaction",
      resourceId: transaction._id.toString(),
      metadata: { transactionNumber, itemCode: item.itemCode, type, quantity: qty },
    });

    return res.json({ success: true, message: `Stock transaction ${transactionNumber} recorded`, data: { item, transaction } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/inventory/transactions
 */
export const getStockTransactions = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.query;
    const filter: Record<string, any> = {};
    if (itemId) filter.item = itemId;

    const transactions = await StockTransaction.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, data: transactions });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
