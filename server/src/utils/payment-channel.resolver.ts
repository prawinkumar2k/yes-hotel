import { PaymentChannel, PaymentChannelType } from "../models/PaymentChannel";

export async function resolvePaymentChannel(methodString: string, providedChannelId?: string) {
  if (providedChannelId) return providedChannelId;
  
  let type: PaymentChannelType = PaymentChannelType.CASH;
  if (methodString === "CASH") type = PaymentChannelType.CASH;
  if (methodString === "CARD") type = PaymentChannelType.CARD;
  if (methodString === "UPI") type = PaymentChannelType.UPI;
  if (methodString === "RAZORPAY") type = PaymentChannelType.GATEWAY;
  if (methodString === "BANK_TRANSFER") type = PaymentChannelType.BANK_TRANSFER;
  
  const ch = await PaymentChannel.findOne({ type, isActive: true });
  return ch?._id;
}
