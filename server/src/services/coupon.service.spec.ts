import { describe, it, expect } from "vitest";
import { calculateDiscount } from "./coupon.service";

describe("calculateDiscount", () => {
  it("applies a fixed discount", () => {
    expect(calculateDiscount({ discountType: "FIXED", discountValue: 500 }, 5000)).toBe(500);
  });

  it("applies a percentage discount", () => {
    expect(calculateDiscount({ discountType: "PERCENTAGE", discountValue: 10 }, 5000)).toBe(500);
  });

  it("caps a percentage discount at maxDiscount", () => {
    expect(calculateDiscount({ discountType: "PERCENTAGE", discountValue: 50, maxDiscount: 300 }, 5000)).toBe(300);
  });

  it("never lets the discount exceed the booking amount", () => {
    expect(calculateDiscount({ discountType: "FIXED", discountValue: 10000 }, 5000)).toBe(5000);
  });

  it("rounds fractional percentage discounts", () => {
    expect(calculateDiscount({ discountType: "PERCENTAGE", discountValue: 15, maxDiscount: 1000 }, 999)).toBe(150);
  });

  it("does not cap a percentage discount when no maxDiscount is set", () => {
    expect(calculateDiscount({ discountType: "PERCENTAGE", discountValue: 90 }, 1000)).toBe(900);
  });
});
