import { Request, Response } from "express";
import { CorporateAccount } from "../models/CorporateAccount";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/corporate-accounts
 */
export const getCorporateAccounts = async (_req: Request, res: Response) => {
  try {
    let accounts = await CorporateAccount.find().sort({ companyName: 1 }).lean();

    if (accounts.length === 0) {
      await CorporateAccount.insertMany([
        {
          companyName: "Tata Consultancy Services (TCS)",
          companyCode: "TCS",
          gstNumber: "27AAACT2727Q1ZB",
          contactPerson: "Amit Sharma",
          contactEmail: "admin@tcs.com",
          contactPhone: "+91 98200 11223",
          creditLimit: 500000,
          currentOutstanding: 125000,
          discountPercentage: 20,
        },
        {
          companyName: "Infosys Technologies Ltd",
          companyCode: "INFY",
          gstNumber: "29AAACI1122P1ZA",
          contactPerson: "Priya Nair",
          contactEmail: "travel@infosys.com",
          contactPhone: "+91 98450 33445",
          creditLimit: 300000,
          currentOutstanding: 45000,
          discountPercentage: 15,
        },
      ]);
      accounts = await CorporateAccount.find().sort({ companyName: 1 }).lean();
    }

    return res.json({ success: true, data: accounts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/corporate-accounts
 */
export const createCorporateAccount = async (req: Request, res: Response) => {
  try {
    const { companyName, companyCode, gstNumber, contactPerson, contactEmail, contactPhone, creditLimit, discountPercentage, notes } = req.body;

    if (!companyName || !companyCode || !gstNumber) {
      return res.status(400).json({ success: false, message: "companyName, companyCode, and gstNumber are required" });
    }

    const account = await CorporateAccount.create({
      companyName,
      companyCode: companyCode.toUpperCase(),
      gstNumber,
      contactPerson,
      contactEmail,
      contactPhone,
      creditLimit: Number(creditLimit) || 100000,
      discountPercentage: Number(discountPercentage) || 15,
      notes,
    });

    await createAuditLog({
      req,
      action: "corporate_account.created",
      resourceType: "CorporateAccount",
      resourceId: account._id.toString(),
      metadata: { companyCode: account.companyCode, creditLimit: account.creditLimit },
    });

    return res.json({ success: true, message: "Corporate account registered", data: account });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/corporate-accounts/:id
 */
export const getCorporateAccountById = async (req: Request, res: Response) => {
  try {
    const account = await CorporateAccount.findById(req.params.id).lean();
    if (!account) return res.status(404).json({ success: false, message: "Corporate account not found" });

    const availableCredit = Math.max(0, account.creditLimit - account.currentOutstanding);
    return res.json({ success: true, data: { ...account, availableCredit } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/corporate-accounts/:id
 */
export const updateCorporateAccount = async (req: Request, res: Response) => {
  try {
    const { creditLimit, discountPercentage, contactPerson, contactEmail, contactPhone, isActive, notes } = req.body;
    const account = await CorporateAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: "Corporate account not found" });

    if (creditLimit !== undefined) account.creditLimit = Number(creditLimit);
    if (discountPercentage !== undefined) account.discountPercentage = Number(discountPercentage);
    if (contactPerson) account.contactPerson = contactPerson;
    if (contactEmail) account.contactEmail = contactEmail;
    if (contactPhone) account.contactPhone = contactPhone;
    if (isActive !== undefined) account.isActive = Boolean(isActive);
    if (notes !== undefined) account.notes = notes;

    await account.save();

    await createAuditLog({
      req,
      action: "corporate_account.updated",
      resourceType: "CorporateAccount",
      resourceId: account._id.toString(),
      metadata: { companyCode: account.companyCode, creditLimit: account.creditLimit, discountPercentage: account.discountPercentage },
    });

    return res.json({ success: true, message: "Corporate account updated", data: account });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/corporate-accounts/:id/check-credit
 * Validates whether a proposed billing amount can be charged against corporate credit limit.
 */
export const checkCorporateCreditAvailability = async (req: Request, res: Response) => {
  try {
    const { amount = 0 } = req.body;
    const account = await CorporateAccount.findById(req.params.id).lean();
    if (!account) return res.status(404).json({ success: false, message: "Corporate account not found" });
    if (!account.isActive) {
      return res.status(400).json({ success: false, message: "Corporate account is suspended/inactive", allowed: false });
    }

    const availableCredit = account.creditLimit - account.currentOutstanding;
    const allowed = availableCredit >= Number(amount);

    return res.json({
      success: true,
      data: {
        companyName: account.companyName,
        creditLimit: account.creditLimit,
        currentOutstanding: account.currentOutstanding,
        availableCredit,
        requestedAmount: Number(amount),
        allowed,
        discountPercentage: account.discountPercentage,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

