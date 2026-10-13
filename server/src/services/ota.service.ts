/**
 * OTA settlement: the one rule for what an OTA booking is worth to the hotel.
 *
 *   commission base   = room revenue before tax (totalAmount − taxAmount)
 *   commission        = base × commission %
 *   OTA_PREPAID       guest paid the OTA → the OTA owes the hotel  totalAmount − commission
 *   PAY_AT_HOTEL      guest pays the hotel → the hotel owes the OTA the commission
 */
export enum OtaPaymentModel {
  OTA_PREPAID = "OTA_PREPAID",
  PAY_AT_HOTEL = "PAY_AT_HOTEL",
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface OtaSettlement {
  otaCommissionBase: number;
  otaCommissionAmount: number;
  otaReceivable: number; // OTA → hotel
  otaPayable: number; // hotel → OTA
}

export function computeOtaSettlement(p: { totalAmount: number; taxAmount?: number; commissionPercent: number; paymentModel: OtaPaymentModel | string }): OtaSettlement {
  if (!(p.commissionPercent >= 0 && p.commissionPercent <= 100)) throw new Error("OTA commission must be between 0% and 100%");
  const base = r2(Math.max(0, (p.totalAmount || 0) - (p.taxAmount || 0)));
  const commission = r2((base * p.commissionPercent) / 100);
  const prepaid = p.paymentModel === OtaPaymentModel.OTA_PREPAID;
  return {
    otaCommissionBase: base,
    otaCommissionAmount: commission,
    otaReceivable: prepaid ? r2((p.totalAmount || 0) - commission) : 0,
    otaPayable: prepaid ? 0 : commission,
  };
}
