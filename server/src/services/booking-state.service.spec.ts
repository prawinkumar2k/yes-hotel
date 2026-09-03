import { describe, expect, it } from "vitest";
import { BookingStatus } from "../models/Booking";
import {
  IllegalBookingTransitionError,
  assertLegalBookingTransition,
  isLegalBookingTransition,
} from "./booking-state.service";

describe("booking status transition legality", () => {
  const ALL = Object.values(BookingStatus);

  it("allows the known-good forward path: PENDING -> CONFIRMED -> CHECKED_IN -> CHECKED_OUT", () => {
    expect(isLegalBookingTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).toBe(true);
    expect(isLegalBookingTransition(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN)).toBe(true);
    expect(isLegalBookingTransition(BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT)).toBe(true);
  });

  it("allows cancellation from PENDING and CONFIRMED", () => {
    expect(isLegalBookingTransition(BookingStatus.PENDING, BookingStatus.CANCELLED)).toBe(true);
    expect(isLegalBookingTransition(BookingStatus.CONFIRMED, BookingStatus.CANCELLED)).toBe(true);
  });

  it("rejects cancelling a CHECKED_IN or CHECKED_OUT booking — the historical inconsistency this service fixes", () => {
    expect(isLegalBookingTransition(BookingStatus.CHECKED_IN, BookingStatus.CANCELLED)).toBe(false);
    expect(isLegalBookingTransition(BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED)).toBe(false);
  });

  it("rejects every transition out of a terminal state (CANCELLED, CHECKED_OUT)", () => {
    for (const to of ALL) {
      expect(isLegalBookingTransition(BookingStatus.CANCELLED, to as BookingStatus)).toBe(false);
      expect(isLegalBookingTransition(BookingStatus.CHECKED_OUT, to as BookingStatus)).toBe(false);
    }
  });

  it("rejects skipping a state (e.g. PENDING straight to CHECKED_IN, CONFIRMED straight to CHECKED_OUT)", () => {
    expect(isLegalBookingTransition(BookingStatus.PENDING, BookingStatus.CHECKED_IN)).toBe(false);
    expect(isLegalBookingTransition(BookingStatus.PENDING, BookingStatus.CHECKED_OUT)).toBe(false);
    expect(isLegalBookingTransition(BookingStatus.CONFIRMED, BookingStatus.CHECKED_OUT)).toBe(false);
  });

  it("rejects a no-op transition (same state to itself) — callers must not treat that as a real transition", () => {
    for (const s of ALL) {
      expect(isLegalBookingTransition(s as BookingStatus, s as BookingStatus)).toBe(false);
    }
  });

  it("rejects re-confirming an already-CONFIRMED booking — prevents a second payment from double-finalizing the same booking", () => {
    expect(isLegalBookingTransition(BookingStatus.CONFIRMED, BookingStatus.CONFIRMED)).toBe(false);
  });

  it("assertLegalBookingTransition throws IllegalBookingTransitionError with from/to on an illegal transition", () => {
    expect(() => assertLegalBookingTransition(BookingStatus.CHECKED_OUT, BookingStatus.CONFIRMED)).toThrow(
      IllegalBookingTransitionError
    );
    try {
      assertLegalBookingTransition(BookingStatus.CHECKED_OUT, BookingStatus.CONFIRMED);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalBookingTransitionError);
      expect((err as IllegalBookingTransitionError).from).toBe(BookingStatus.CHECKED_OUT);
      expect((err as IllegalBookingTransitionError).to).toBe(BookingStatus.CONFIRMED);
    }
  });

  it("assertLegalBookingTransition does not throw on a legal transition", () => {
    expect(() => assertLegalBookingTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).not.toThrow();
  });
});
