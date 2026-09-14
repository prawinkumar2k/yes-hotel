import { Request, Response } from "express";
import { Vendor } from "../models/Vendor";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/vendors
 */
export const getVendors = async (_req: Request, res: Response) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 }).lean();

    return res.json({ success: true, data: vendors });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/vendors
 */
export const createVendor = async (req: Request, res: Response) => {
  try {
    const { name, vendorCode, gstin, contactPerson, email, phone, address, paymentTerms, rating, notes } = req.body;

    if (!name || !contactPerson || !email || !phone) {
      return res.status(400).json({ success: false, message: "name, contactPerson, email, phone are required" });
    }

    const code = vendorCode ? vendorCode.toUpperCase() : `VEN-${Date.now().toString(36).toUpperCase()}`;

    const vendor = await Vendor.create({
      vendorCode: code,
      name,
      gstin,
      contactPerson,
      email,
      phone,
      address,
      paymentTerms: paymentTerms || "Net 30",
      rating: Number(rating) || 5,
      notes,
    });

    await createAuditLog({
      req,
      action: "vendor.created",
      resourceType: "Vendor",
      resourceId: vendor._id.toString(),
      metadata: { vendorCode: vendor.vendorCode, name: vendor.name },
    });

    return res.json({ success: true, message: "Vendor registered", data: vendor });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/vendors/:id
 */
export const updateVendor = async (req: Request, res: Response) => {
  try {
    const { name, gstin, contactPerson, email, phone, address, paymentTerms, rating, isActive, notes } = req.body;

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    if (name) vendor.name = name;
    if (gstin) vendor.gstin = gstin;
    if (contactPerson) vendor.contactPerson = contactPerson;
    if (email) vendor.email = email;
    if (phone) vendor.phone = phone;
    if (address) vendor.address = address;
    if (paymentTerms) vendor.paymentTerms = paymentTerms;
    if (rating !== undefined) vendor.rating = Number(rating);
    if (isActive !== undefined) vendor.isActive = Boolean(isActive);
    if (notes !== undefined) vendor.notes = notes;

    await vendor.save();

    await createAuditLog({
      req,
      action: "vendor.updated",
      resourceType: "Vendor",
      resourceId: vendor._id.toString(),
      metadata: { vendorCode: vendor.vendorCode },
    });

    return res.json({ success: true, message: "Vendor updated", data: vendor });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
