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
  /** Set only for a flat commission: the equivalent % of the pre-tax amount (for display). */
  otaCommissionPercent?: number;
  otaCommissionBase: number;
  otaCommissionAmount: number;
  otaReceivable: number; // OTA → hotel
  otaPayable: number; // hotel → OTA
}

export function computeOtaSettlement(p: { totalAmount: number; taxAmount?: number; commissionPercent?: number; commissionFlat?: number; paymentModel: OtaPaymentModel | string }): OtaSettlement {
  const base = r2(Math.max(0, (p.totalAmount || 0) - (p.taxAmount || 0)));
  const flat = p.commissionFlat != null && Number.isFinite(Number(p.commissionFlat));
  let commission: number;
  let derivedPercent: number | undefined;
  if (flat) {
    commission = r2(Number(p.commissionFlat));
    if (!(commission >= 0)) throw new Error("OTA commission cannot be negative");
    if (commission > base + 0.01) throw new Error("A flat OTA commission cannot be more than the room amount before tax");
    derivedPercent = base > 0 ? r2((commission / base) * 100) : 0;
  } else {
    const pct = Number(p.commissionPercent);
    if (!(pct >= 0 && pct <= 100)) throw new Error("OTA commission must be between 0% and 100%");
    commission = r2((base * pct) / 100);
  }
  const prepaid = p.paymentModel === OtaPaymentModel.OTA_PREPAID;
  return {
    ...(derivedPercent !== undefined ? { otaCommissionPercent: derivedPercent } : {}),
    otaCommissionBase: base,
    otaCommissionAmount: commission,
    otaReceivable: prepaid ? r2((p.totalAmount || 0) - commission) : 0,
    otaPayable: prepaid ? 0 : commission,
  };
}
