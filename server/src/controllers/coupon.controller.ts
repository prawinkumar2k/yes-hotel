import { Request, Response } from "express";
import { Coupon } from "../models/Coupon";
import { z } from "zod";
import { validateAndCalculateCoupon } from "../services/coupon.service";
import { createAuditLog } from "../services/audit.service";

const couponSchema = z.object({
  code: z.string().min(3).toUpperCase(),
  description: z.string().min(5),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  minBookingAmount: z.number().nonnegative().optional(),
  maxDiscount: z.number().nonnegative().optional(),
  applicableRoomCategories: z.array(z.string()).optional(),
  startDate: z.string(),
  expiryDate: z.string(),
  usageLimit: z.number().positive().optional(),
  perUserLimit: z.number().positive().default(1),
  isActive: z.boolean().default(true),
});

export const getCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await Coupon.find().populate("applicableRoomCategories", "name").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: coupons });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const data = couponSchema.parse(req.body);
    const existing = await Coupon.findOne({ code: data.code });
    if (existing) return res.status(400).json({ success: false, message: "Coupon code already exists" });

    const coupon = new Coupon({
      ...data,
      createdBy: (req as any).user.id
    });
    await coupon.save();

    await createAuditLog({
      req,
      action: "coupon.created",
      resourceType: "Coupon",
      resourceId: coupon._id.toString(),
      metadata: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue },
    });

    return res.status(201).json({ success: true, data: coupon });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const data = couponSchema.parse(req.body);
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, data, { returnDocument: "after" });
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    await createAuditLog({
      req,
      action: "coupon.updated",
      resourceType: "Coupon",
      resourceId: coupon._id.toString(),
      metadata: { code: coupon.code, isActive: coupon.isActive },
    });

    return res.status(200).json({ success: true, data: coupon });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    await createAuditLog({
      req,
      action: "coupon.deleted",
      resourceType: "Coupon",
      resourceId: coupon._id.toString(),
      metadata: { code: coupon.code },
    });

    return res.status(200).json({ success: true, message: "Coupon deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Public endpoint for checkout preview — the discount shown here is a hint only.
// createBooking recalculates it authoritatively server-side before persisting.
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, bookingAmount, roomCategoryId, guestEmail } = req.body;
    if (!code || !bookingAmount) {
      return res.status(400).json({ success: false, message: "Code and booking amount required" });
    }

    const { coupon, discount } = await validateAndCalculateCoupon({
      code,
      bookingAmount,
      roomCategoryId,
      guestEmail,
    });

    return res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        discount,
        type: coupon.discountType,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
