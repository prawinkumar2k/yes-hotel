import { describe, expect, it } from "vitest";
import { deriveRoomStates, hkStateFor, legacyRoomFields, summarize } from "./room-status.service";

const D = "2026-10-12";
const room = (n: string, extra: Record<string, any> = {}) => ({
  _id: `r${n}`, roomNumber: n, category: { _id: "c1", name: "Deluxe Room" }, housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", status: "AVAILABLE", ...extra,
});
const derive = (input: Partial<Parameters<typeof deriveRoomStates>[1]>) =>
  deriveRoomStates(D, { rooms: [], bookings: [], tasks: [], tickets: [], ...input });

describe("occupancy (from bookings)", () => {
  it("a CHECKED_IN booking makes the room OCCUPIED even if the stored room field says VACANT (room 201)", () => {
    const [s] = derive({
      rooms: [room("201", { occupancyStatus: "VACANT" })],
      bookings: [{ _id: "b1", status: "CHECKED_IN", assignedRoom: "r201", checkInDate: "2026-10-11", checkOutDate: "2026-10-14", guestDetails: { firstName: "Rahul", lastName: "Sharma" } }],
    });
    expect(s).toMatchObject({ occupancy: "OCCUPIED", guestName: "Rahul Sharma", overdue: false, available: false });
  });
  it("an in-house stay past its check-out date is still OCCUPIED and flagged overdue (WALKIN-1011-002)", () => {
    const [s] = derive({
      rooms: [room("102")],
      bookings: [{ _id: "b2", status: "CHECKED_IN", assignedRoom: "r102", checkInDate: "2026-10-11", checkOutDate: "2026-10-11T18:30:00Z" }],
    });
    expect(deriveRoomStates("2026-10-13", { rooms: [room("102")], bookings: [{ _id: "b2", status: "CHECKED_IN", assignedRoom: "r102", checkInDate: "2026-10-11", checkOutDate: "2026-10-12" }], tasks: [], tickets: [] })[0])
      .toMatchObject({ occupancy: "OCCUPIED", overdue: true });
    expect(s.occupancy).toBe("OCCUPIED");
  });
  it("a CONFIRMED assigned booking covering the date makes it RESERVED; check-out day does not", () => {
    const b = { _id: "b3", status: "CONFIRMED", assignedRoom: "r301", checkInDate: "2026-10-12", checkOutDate: "2026-10-14" };
    expect(derive({ rooms: [room("301")], bookings: [b] })[0].occupancy).toBe("RESERVED");
    expect(deriveRoomStates("2026-10-14", { rooms: [room("301")], bookings: [b], tasks: [], tickets: [] })[0].occupancy).toBe("VACANT");
  });
});

describe("housekeeping (from the latest task)", () => {
  it("maps task statuses to the room state machine; ASSIGNED is not a room state (room 401)", () => {
    expect(hkStateFor("ASSIGNED")).toBe("DIRTY");
    expect(hkStateFor("INSPECTION_FAILED")).toBe("DIRTY");
    expect(hkStateFor("WAITING_FOR_RELEASE")).toBe("INSPECTION");
    expect(hkStateFor("READY")).toBe("CLEAN");
    const [s] = derive({ rooms: [room("401", { housekeepingStatus: "ASSIGNED" })], tasks: [{ _id: "t1", room: "r401", status: "ASSIGNED", assignedTo: "u9" }] });
    expect(s).toMatchObject({ hk: "DIRTY", hkTaskStatus: "ASSIGNED", hkAssignedTo: "u9" });
  });
  it("the task wins over a stale stored room field, and the latest task wins", () => {
    const [s] = derive({
      rooms: [room("203", { housekeepingStatus: "CLEAN" })],
      tasks: [
        { _id: "old", room: "r203", status: "CLEAN", createdAt: new Date("2026-10-10") },
        { _id: "new", room: "r203", status: "CLEANING", createdAt: new Date("2026-10-12") },
      ],
    });
    expect(s).toMatchObject({ hk: "CLEANING", hkTaskId: "new", available: false });
  });
  it("with no task, falls back to the stored field", () => {
    expect(derive({ rooms: [room("105", { housekeepingStatus: "DIRTY" })] })[0].hk).toBe("DIRTY");
  });
});

describe("sell status", () => {
  it("an open CRITICAL ticket makes the room OOO (room 204 balcony door)", () => {
    const [s] = derive({ rooms: [room("204")], tickets: [{ _id: "m1", room: "r204", priority: "CRITICAL", status: "IN_PROGRESS", issueTitle: "Balcony door won't lock" }] });
    expect(s).toMatchObject({ sell: "OOO", available: false });
    expect(s.sellReason).toMatch(/Balcony door/);
  });
  it("resolved critical tickets and non-critical tickets do not block sale", () => {
    const [a] = derive({ rooms: [room("204")], tickets: [{ _id: "m1", room: "r204", priority: "CRITICAL", status: "RESOLVED" }] });
    const [b] = derive({ rooms: [room("205")], tickets: [{ _id: "m2", room: "r205", priority: "HIGH", status: "OPEN" }] });
    expect(a.sell).toBe("SELLABLE");
    expect(b.sell).toBe("SELLABLE");
  });
  it("BLOCKED is sellable inventory but not available", () => {
    expect(derive({ rooms: [room("106", { sellStatus: "BLOCKED" })] })[0]).toMatchObject({ sell: "SELLABLE", blocked: true, available: false });
  });
});

describe("available and summary", () => {
  it("available = VACANT + CLEAN + SELLABLE + not blocked (101 dirty and 401 not clean are not available)", () => {
    const states = derive({
      rooms: [room("101", { housekeepingStatus: "DIRTY" }), room("401"), room("103")],
      tasks: [{ _id: "t", room: "r401", status: "CLEANING" }],
    });
    expect(states.map((s) => [s.roomNumber, s.available])).toEqual([["101", false], ["401", false], ["103", true]]);
  });
  it("occupancy % = occupied / (total − OOO − OOS)", () => {
    const states = derive({
      rooms: [room("101"), room("102"), room("204"), room("205", { sellStatus: "OUT_OF_SERVICE" })],
      bookings: [{ _id: "b", status: "CHECKED_IN", assignedRoom: "r102", checkInDate: D, checkOutDate: "2026-10-13" }],
      tickets: [{ _id: "m", room: "r204", priority: "CRITICAL", status: "OPEN" }],
    });
    expect(summarize(states)).toMatchObject({ total: 4, ooo: 1, oos: 1, sellableRooms: 2, occupied: 1, occupancyPct: 50, available: 1 });
  });
  it("projects onto the stored-field vocabulary for legacy responses", () => {
    const [s] = derive({ rooms: [room("101")], tasks: [{ _id: "t", room: "r101", status: "DIRTY" }] });
    expect(legacyRoomFields(s)).toEqual({ occupancyStatus: "VACANT", housekeepingStatus: "DIRTY", sellStatus: "SELLABLE", status: "CLEANING" });
  });
});
