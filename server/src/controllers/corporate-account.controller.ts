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
