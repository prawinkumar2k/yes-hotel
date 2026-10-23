/**
 * OTA settlement with GST on the commission: the OTA takes 18% GST with its commission,
 * so it pays the hotel less (prepaid) or the hotel owes more (pay at hotel).
 */
import { describe, expect, it } from "vitest";
import { computeOtaSettlement } from "./ota.service";

describe("OTA commission GST", () => {
  // Room ₹2,000 + 5% GST ₹100 = ₹2,100. Commission on the pre-tax ₹2,000.
  const stay = { totalAmount: 2100, taxAmount: 100 };

  it("MakeMyTrip / Goibibo: 20% + 18% GST, OTA prepaid", () => {
    const r = computeOtaSettlement({ ...stay, commissionPercent: 20, commissionGstPercent: 18, paymentModel: "OTA_PREPAID" });
    expect(r).toMatchObject({ otaCommissionAmount: 400, otaCommissionGst: 72, otaCommissionGstPercent: 18, otaReceivable: 1628, otaPayable: 0 });
  });

  it("Booking.com: 18% + 18% GST, pay at hotel: the hotel owes the commission and its GST", () => {
    const r = computeOtaSettlement({ ...stay, commissionPercent: 18, commissionGstPercent: 18, paymentModel: "PAY_AT_HOTEL" });
    expect(r).toMatchObject({ otaCommissionAmount: 360, otaCommissionGst: 64.8, otaReceivable: 0, otaPayable: 424.8 });
  });

  it("without GST on the commission the figures are unchanged", () => {
    const r = computeOtaSettlement({ ...stay, commissionPercent: 20, paymentModel: "OTA_PREPAID" });
    expect(r.otaReceivable).toBe(1700);
    expect(r.otaCommissionGst).toBeUndefined();
  });

  it("a GST above 100% is refused", () => {
    expect(() => computeOtaSettlement({ ...stay, commissionPercent: 20, commissionGstPercent: 150, paymentModel: "OTA_PREPAID" })).toThrow();
  });
});
