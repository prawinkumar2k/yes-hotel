import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { computeOtaSettlement, OtaPaymentModel } from "./ota.service";
import { Booking } from "../models/Booking";

describe("OTA settlement", () => {
  it("prepaid: the OTA owes the hotel the total less commission on pre-tax revenue", () => {
    expect(computeOtaSettlement({ totalAmount: 10500, taxAmount: 500, commissionPercent: 15, paymentModel: OtaPaymentModel.OTA_PREPAID })).toEqual({
      otaCommissionBase: 10000,
      otaCommissionAmount: 1500,
      otaReceivable: 9000,
      otaPayable: 0,
    });
  });

  it("pay at hotel: the hotel owes the OTA its commission", () => {
    expect(computeOtaSettlement({ totalAmount: 10500, taxAmount: 500, commissionPercent: 20, paymentModel: OtaPaymentModel.PAY_AT_HOTEL })).toMatchObject({
      otaCommissionAmount: 2000,
      otaReceivable: 0,
      otaPayable: 2000,
    });
  });

  it("rejects an impossible commission", () => {
    expect(() => computeOtaSettlement({ totalAmount: 100, commissionPercent: 120, paymentModel: OtaPaymentModel.OTA_PREPAID })).toThrow();
  });

  it("the booking stores figures computed by the rule on validate", async () => {
    const b = new Booking({
      propertyId: new mongoose.Types.ObjectId(),
      bookingReference: "OTA-UNIT",
      source: "OTA",
      guestDetails: { firstName: "A", lastName: "B", email: "a@b.c", phone: "9999999999" },
      roomCategory: new mongoose.Types.ObjectId(),
      checkInDate: new Date("2031-01-01"),
      checkOutDate: new Date("2031-01-02"),
      adults: 1,
      totalAmount: 5250,
      taxAmount: 250,
      otaCommissionPercent: 18,
      otaPaymentModel: OtaPaymentModel.OTA_PREPAID,
    } as any);
    await b.validate().catch(() => undefined);
    expect(b.otaCommissionAmount).toBe(900);
    expect(b.otaReceivable).toBe(4350);
  });
});
