import { Request, Response } from "express";
import { PaymentChannel, PaymentChannelType } from "../models/PaymentChannel";
import { Payment } from "../models/Payment";
import { AdvancePayment } from "../models/AdvancePayment";

export const getPaymentChannels = async (req: Request, res: Response) => {
  try {
    const channels = await PaymentChannel.find().sort({ displayOrder: 1, createdAt: -1 });
    return res.json({ success: true, data: channels });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPaymentChannel = async (req: Request, res: Response) => {
  try {
    const channel = await PaymentChannel.findById(req.params.id);
    if (!channel) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: channel });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createPaymentChannel = async (req: Request, res: Response) => {
  try {
    const existing = await PaymentChannel.findOne({ code: req.body.code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Code must be unique." });
    }

    const channel = new PaymentChannel({
      ...req.body,
      createdBy: (req as any).user?.id,
    });
    await channel.save();
    return res.status(201).json({ success: true, data: channel });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePaymentChannel = async (req: Request, res: Response) => {
  try {
    if (req.body.code) {
      const existing = await PaymentChannel.findOne({ code: req.body.code.toUpperCase(), _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: "Code must be unique." });
      }
    }

    const channel = await PaymentChannel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: (req as any).user?.id },
      { new: true, runValidators: true }
    );
    if (!channel) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: channel });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePaymentChannel = async (req: Request, res: Response) => {
  try {
    const channelId = req.params.id;
    const hasPayments = await Payment.exists({ paymentChannel: channelId });
    const hasAdvances = await AdvancePayment.exists({ paymentChannel: channelId });

    if (hasPayments || hasAdvances) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete channel with historical transactions. Please disable it instead." 
      });
    }

    await PaymentChannel.findByIdAndDelete(channelId);
    return res.json({ success: true, message: "Channel deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
