import { describe, expect, it } from "vitest";
import { RoomStatus } from "../models/Room";
import {
  IllegalRoomTransitionError,
  assertLegalRoomTransition,
  isLegalRoomTransition,
} from "./room-state.service";

describe("room status transition legality", () => {
  const ALL = Object.values(RoomStatus);

  it("allows the normal operational cycle: AVAILABLE -> OCCUPIED -> CLEANING -> AVAILABLE", () => {
    expect(isLegalRoomTransition(RoomStatus.AVAILABLE, RoomStatus.OCCUPIED)).toBe(true);
    expect(isLegalRoomTransition(RoomStatus.OCCUPIED, RoomStatus.CLEANING)).toBe(true);
    expect(isLegalRoomTransition(RoomStatus.CLEANING, RoomStatus.AVAILABLE)).toBe(true);
  });

  it("does NOT itself forbid MAINTENANCE -> OCCUPIED — that transition is legal at the state-machine level to support restoring a room's prior occupancy after a maintenance ticket resolves; check-in's own stricter 'must be AVAILABLE' rule (tested separately in room-state-integration.spec.ts) is what actually prevents checking a NEW guest into a room under maintenance", () => {
    expect(isLegalRoomTransition(RoomStatus.MAINTENANCE, RoomStatus.OCCUPIED)).toBe(true);
  });

  it("rejects checking a guest into a room already OCCUPIED by someone else", () => {
    expect(isLegalRoomTransition(RoomStatus.OCCUPIED, RoomStatus.OCCUPIED)).toBe(false);
  });

  it("allows a maintenance ticket to be filed against an OCCUPIED room (a guest reporting an issue mid-stay is real)", () => {
    expect(isLegalRoomTransition(RoomStatus.OCCUPIED, RoomStatus.MAINTENANCE)).toBe(true);
  });

  it("MAINTENANCE can resolve to AVAILABLE or OCCUPIED (whichever it actually was before) — the other real bug this service fixes — or OUT_OF_SERVICE", () => {
    expect(isLegalRoomTransition(RoomStatus.MAINTENANCE, RoomStatus.AVAILABLE)).toBe(true);
    expect(isLegalRoomTransition(RoomStatus.MAINTENANCE, RoomStatus.OCCUPIED)).toBe(true);
    expect(isLegalRoomTransition(RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE)).toBe(true);
    expect(isLegalRoomTransition(RoomStatus.MAINTENANCE, RoomStatus.CLEANING)).toBe(false);
  });

  it("rejects a no-op transition for every state", () => {
    for (const s of ALL) {
      expect(isLegalRoomTransition(s as RoomStatus, s as RoomStatus)).toBe(false);
    }
  });

  it("assertLegalRoomTransition throws IllegalRoomTransitionError with from/to on an illegal transition", () => {
    expect(() => assertLegalRoomTransition(RoomStatus.MAINTENANCE, RoomStatus.CLEANING)).toThrow(
      IllegalRoomTransitionError
    );
    try {
      assertLegalRoomTransition(RoomStatus.MAINTENANCE, RoomStatus.CLEANING);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalRoomTransitionError);
      expect((err as IllegalRoomTransitionError).from).toBe(RoomStatus.MAINTENANCE);
      expect((err as IllegalRoomTransitionError).to).toBe(RoomStatus.CLEANING);
    }
  });
});
