import { Request, Response } from "express";
import { z } from "zod";
import { MenuItem, MenuItemCategory, FoodType } from "../models/MenuItem";
import { createAuditLog } from "../services/audit.service";

const modifierSchema = z.object({
  name: z.string().min(1),
  priceDelta: z.number(),
});

const createMenuItemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.nativeEnum(MenuItemCategory),
  description: z.string().optional(),
  price: z.number().min(0),
  taxRatePercent: z.number().min(0).max(100).optional(),
  foodType: z.nativeEnum(FoodType).optional(),
  isAvailable: z.boolean().optional(),
  kdsStation: z.string().optional(),
  modifiers: z.array(modifierSchema).optional(),
  imageUrl: z.string().optional(),
  displayOrder: z.number().optional(),
});

const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * GET /api/menu
 * Staff-facing catalog (Admin Menu Management + POS). Defaults to active
 * items only; pass ?includeInactive=true to see disabled items for editing.
 */
export const getMenuItems = async (req: Request, res: Response) => {
  try {
    const { category, includeInactive } = req.query;
    const filter: Record<string, any> = {};
    if (!includeInactive || includeInactive === "false") filter.isActive = true;
    if (category) filter.category = category;

    const items = await MenuItem.find(filter).sort({ category: 1, displayOrder: 1, name: 1 }).lean();
    return res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createMenuItem = async (req: Request, res: Response) => {
  try {
    const data = createMenuItemSchema.parse(req.body);
    const item = await MenuItem.create({ ...data, sku: data.sku.toUpperCase() });

    await createAuditLog({
      req,
      action: "menu.item_created",
      resourceType: "MenuItem",
      resourceId: item._id.toString(),
      metadata: { name: item.name, sku: item.sku, price: item.price },
    });

    return res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: `SKU "${req.body.sku}" is already in use` });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMenuItem = async (req: Request, res: Response) => {
  try {
    const data = updateMenuItemSchema.parse(req.body);
    if (data.sku) data.sku = data.sku.toUpperCase();

    const item = await MenuItem.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

    await createAuditLog({
      req,
      action: "menu.item_updated",
      resourceType: "MenuItem",
      resourceId: item._id.toString(),
      metadata: { name: item.name, changes: data },
    });

    return res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: `SKU "${req.body.sku}" is already in use` });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/menu/:id
 * Soft-delete only (isActive: false) — a hard delete would silently orphan
 * the menuItem reference on every historical RestaurantOrder line that
 * pointed at it. Disabling is also what the frontend "enable/disable"
 * action needs, so this endpoint and PATCH {isActive:false} are equivalent;
 * DELETE exists for callers that expect REST delete semantics.
 */
export const deleteMenuItem = async (req: Request, res: Response) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

    await createAuditLog({
      req,
      action: "menu.item_disabled",
      resourceType: "MenuItem",
      resourceId: item._id.toString(),
      metadata: { name: item.name },
    });

    return res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
