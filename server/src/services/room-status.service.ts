/**
 * Room status: the single source of truth for room state on a business date.
 *
 * Three independent state machines, each derived from its own source:
 *
 *   Occupancy  VACANT | OCCUPIED | RESERVED       ← bookings
 *     OCCUPIED: a CHECKED_IN booking is assigned to the room (an overdue stay still occupies it).
 *     RESERVED: a CONFIRMED booking assigned to the room covers the business date.
 *
 *   Housekeeping  DIRTY → CLEANING → CLEANING_COMPLETED → INSPECTION → CLEAN   ← HK tasks
 *     A failed inspection loops back to DIRTY. ASSIGNED is a task attribute (who is on it),
 *     not a room state: an assigned-but-not-started room is DIRTY. The room's state comes from
 *     its most recent housekeeping task; with no task, from the room's stored field.
 *
 *   Sell  SELLABLE | OOO | OOS (+ blocked flag)   ← room sell status, open CRITICAL maintenance
 *
 * Available = VACANT + CLEAN + SELLABLE + not blocked.
 *
 * Every board (Dashboard, Front Desk, Housekeeping, Rooms, Room Rack, Reports) reads this
 * snapshot, so the same business date shows the same numbers everywhere.
 */
import mongoose from "mongoose";
import { businessDayRange, toBusinessDate, todayBusinessDate, type BusinessDate } from "../../../shared/dates";

export type Occupancy = "VACANT" | "OCCUPIED" | "RESERVED";
export type HkState = "DIRTY" | "CLEANING" | "CLEANING_COMPLETED" | "INSPECTION" | "CLEAN";
export type SellState = "SELLABLE" | "OOO" | "OOS";

/** Task / stored-room housekeeping status → room HK state. */
export function hkStateFor(status: string | undefined | null): HkState {
  switch (status) {
    case "CLEAN":
    case "READY":
      return "CLEAN";
    case "CLEANING":
      return "CLEANING";
    case "CLEANING_COMPLETED":
      return "CLEANING_COMPLETED";
    case "INSPECTION":
    case "INSPECTED":
    case "WAITING_FOR_RELEASE":
      return "INSPECTION"; // not released yet, so not sellable
    case "DIRTY":
    case "ASSIGNED":
    case "INSPECTION_FAILED":
    case "DND":
    case "REFUSED_SERVICE":
    default:
      return "DIRTY";
  }
}

export interface RoomInput {
  _id: any;
  roomNumber: string;
  floor?: string;
  category?: { _id: any; name?: string } | any;
  housekeepingStatus?: string;
  sellStatus?: string;
  status?: string;
}
export interface BookingInput {
  _id: any;
  bookingReference?: string;
  status: string;
  assignedRoom?: any;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  guestDetails?: { firstName?: string; lastName?: string };
  adults?: number;
  children?: number;
}
export interface TaskInput {
  _id: any;
  room: any;
  status: string;
  assignedTo?: any;
  createdAt?: Date;
}
export interface TicketInput {
  _id: any;
  room: any;
  priority: string;
  status: string;
  issueTitle?: string;
}

export interface RoomState {
  roomId: string;
  roomNumber: string;
  floor?: string;
  categoryId?: string;
  categoryName?: string;
  occupancy: Occupancy;
  bookingId?: string; // in-house or reserved booking
  bookingReference?: string;
  guestName?: string;
  overdue: boolean; // in-house past its check-out date
  hk: HkState;
  hkTaskId?: string;
  hkTaskStatus?: string; // the task's own status (ASSIGNED, DND…), shown as task detail
  hkAssignedTo?: string;
  sell: SellState;
  sellReason?: string;
  blocked: boolean;
  available: boolean;
}

const id = (x: any) => (x == null ? undefined : String(x?._id ?? x));
const OPEN_TICKET = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS"]);

/** Pure derivation of every room's state on `date`. */
export function deriveRoomStates(
  date: BusinessDate,
  input: { rooms: RoomInput[]; bookings: BookingInput[]; tasks: TaskInput[]; tickets: TicketInput[] },
): RoomState[] {
  const inHouseByRoom = new Map<string, BookingInput>();
  const reservedByRoom = new Map<string, BookingInput>();
  for (const b of input.bookings) {
    const roomId = id(b.assignedRoom);
    if (!roomId) continue;
    if (b.status === "CHECKED_IN") inHouseByRoom.set(roomId, b);
    else if (
      b.status === "CONFIRMED" &&
      toBusinessDate(b.checkInDate) <= date &&
      date < toBusinessDate(b.checkOutDate)
    ) {
      reservedByRoom.set(roomId, b);
    }
  }

  const latestTaskByRoom = new Map<string, TaskInput>();
  for (const t of input.tasks) {
    const roomId = id(t.room)!;
    const prev = latestTaskByRoom.get(roomId);
    if (!prev || new Date(t.createdAt ?? 0) > new Date(prev.createdAt ?? 0)) latestTaskByRoom.set(roomId, t);
  }

  const criticalByRoom = new Map<string, TicketInput>();
  for (const t of input.tickets) {
    if (t.priority === "CRITICAL" && OPEN_TICKET.has(t.status)) criticalByRoom.set(id(t.room)!, t);
  }

  return input.rooms.map((r) => {
    const roomId = id(r._id)!;
    const inHouse = inHouseByRoom.get(roomId);
    const reserved = inHouse ? undefined : reservedByRoom.get(roomId);
    const booking = inHouse ?? reserved;
    const occupancy: Occupancy = inHouse ? "OCCUPIED" : reserved ? "RESERVED" : "VACANT";

    const task = latestTaskByRoom.get(roomId);
    const hk = task ? hkStateFor(task.status) : hkStateFor(r.housekeepingStatus);

    let sell: SellState = "SELLABLE";
    let sellReason: string | undefined;
    const critical = criticalByRoom.get(roomId);
    if (r.sellStatus === "OUT_OF_ORDER" || r.status === "OUT_OF_ORDER" || r.status === "MAINTENANCE") {
      sell = "OOO";
      sellReason = "Marked out of order";
    } else if (critical) {
      sell = "OOO";
      sellReason = `Critical maintenance: ${critical.issueTitle ?? "open ticket"}`;
    } else if (r.sellStatus === "OUT_OF_SERVICE" || r.status === "OUT_OF_SERVICE") {
      sell = "OOS";
      sellReason = "Marked out of service";
    }
    const blocked = r.sellStatus === "BLOCKED";
    const guest = booking?.guestDetails;

    return {
      roomId,
      roomNumber: r.roomNumber,
      floor: r.floor,
      categoryId: id(r.category),
      categoryName: r.category?.name,
      occupancy,
      bookingId: id(booking?._id),
      bookingReference: booking?.bookingReference,
      guestName: guest ? `${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim() || undefined : undefined,
      overdue: !!inHouse && toBusinessDate(inHouse.checkOutDate) < date,
      hk,
      hkTaskId: id(task?._id),
      hkTaskStatus: task?.status,
      hkAssignedTo: id(task?.assignedTo),
      sell,
      sellReason,
      blocked,
      available: occupancy === "VACANT" && hk === "CLEAN" && sell === "SELLABLE" && !blocked,
    };
  });
}

export interface RoomSummary {
  total: number;
  sellableRooms: number; // in inventory: total − OOO − OOS
  occupied: number;
  reserved: number;
  vacant: number;
  available: number;
  dirty: number;
  vacantDirty: number;
  cleaning: number;
  cleaningCompleted: number;
  inspection: number;
  clean: number;
  ooo: number;
  oos: number;
  blocked: number;
  /** Rooms sold / sellable rooms, % rounded. */
  occupancyPct: number;
}

export function summarize(states: RoomState[]): RoomSummary {
  const n = (f: (s: RoomState) => boolean) => states.filter(f).length;
  const ooo = n((s) => s.sell === "OOO");
  const oos = n((s) => s.sell === "OOS");
  const sellableRooms = states.length - ooo - oos;
  const occupied = n((s) => s.occupancy === "OCCUPIED");
  return {
    total: states.length,
    sellableRooms,
    occupied,
    reserved: n((s) => s.occupancy === "RESERVED"),
    vacant: n((s) => s.occupancy === "VACANT"),
    available: n((s) => s.available),
    dirty: n((s) => s.hk === "DIRTY"),
    vacantDirty: n((s) => s.hk === "DIRTY" && s.occupancy !== "OCCUPIED"),
    cleaning: n((s) => s.hk === "CLEANING"),
    cleaningCompleted: n((s) => s.hk === "CLEANING_COMPLETED"),
    inspection: n((s) => s.hk === "INSPECTION"),
    clean: n((s) => s.hk === "CLEAN"),
    ooo,
    oos,
    blocked: n((s) => s.blocked),
    occupancyPct: sellableRooms ? Math.round((occupied / sellableRooms) * 100) : 0,
  };
}

/**
 * The stored-field view of a derived state, for API responses that still return
 * Room documents (Rooms list, Room Rack, HK dashboard): the response shows the same
 * truth as every other board.
 */
export function legacyRoomFields(s: RoomState) {
  return {
    occupancyStatus: s.occupancy,
    housekeepingStatus: s.hk,
    sellStatus: s.sell === "OOO" ? "OUT_OF_ORDER" : s.sell === "OOS" ? "OUT_OF_SERVICE" : s.blocked ? "BLOCKED" : "SELLABLE",
    // A room with a guest in it is OCCUPIED, even while it is off sale (sellStatus says so).
    status:
      s.occupancy === "OCCUPIED" ? "OCCUPIED"
      : s.sell === "OOO" ? "OUT_OF_ORDER"
      : s.sell === "OOS" ? "OUT_OF_SERVICE"
      : s.occupancy === "RESERVED" ? "RESERVED"
      : s.hk !== "CLEAN" ? "CLEANING"
      : "AVAILABLE",
  };
}

export interface DayMovements {
  expectedArrivals: number; // CONFIRMED, checking in on the date
  arrived: number; // actually checked in on the date
  expectedDepartures: number; // in-house, due out on the date
  overdueDepartures: number; // in-house, due out before the date
  departed: number; // actually checked out on the date
  noShows: number;
  cancellations: number;
  inHouseStays: number; // CHECKED_IN bookings (incl. overdue)
  inHouseGuests: number; // adults + children of in-house stays
}

export interface RoomSnapshot {
  businessDate: BusinessDate;
  rooms: RoomState[];
  summary: RoomSummary;
  movements: DayMovements;
  byRoomId: Map<string, RoomState>;
}

/** Loads and derives the snapshot for a business date (default: today at the property). */
export async function getSnapshot(
  businessDate: BusinessDate = todayBusinessDate(),
  opts: { propertyId?: mongoose.Types.ObjectId | string; session?: mongoose.ClientSession } = {},
): Promise<RoomSnapshot> {
  const { Room } = await import("../models/Room");
  const { Booking } = await import("../models/Booking");
  const { HousekeepingTask } = await import("../models/HousekeepingTask");
  const { MaintenanceTicket } = await import("../models/MaintenanceTicket");
  await import("../models/RoomCategory");

  const scope = opts.propertyId ? { propertyId: opts.propertyId } : {};
  const { start, end } = businessDayRange(businessDate);
  const s = opts.session ?? null;

  const [rooms, bookings, tasks, tickets, arrived, departed, noShows, cancellations] = await Promise.all([
    Room.find(scope).populate("category", "name").sort({ roomNumber: 1 }).session(s).lean(),
    Booking.find({
      ...scope,
      $or: [
        { status: "CHECKED_IN" },
        { status: "CONFIRMED", checkInDate: { $lt: end }, checkOutDate: { $gte: start } },
      ],
    } as any)
      .select("bookingReference status assignedRoom checkInDate checkOutDate guestDetails adults children")
      .session(s)
      .lean(),
    HousekeepingTask.find(scope).select("room status assignedTo createdAt").session(s).lean(),
    MaintenanceTicket.find({ ...scope, priority: "CRITICAL", status: { $in: [...OPEN_TICKET] } } as any)
      .select("room priority status issueTitle")
      .session(s)
      .lean(),
    Booking.countDocuments({ ...scope, checkedInAt: { $gte: start, $lt: end } }).session(s),
    Booking.countDocuments({ ...scope, checkedOutAt: { $gte: start, $lt: end } }).session(s),
    Booking.countDocuments({ ...scope, noShowAt: { $gte: start, $lt: end } }).session(s),
    Booking.countDocuments({ ...scope, cancelledAt: { $gte: start, $lt: end } }).session(s),
  ]);

  const states = deriveRoomStates(businessDate, {
    rooms: rooms as any,
    bookings: bookings as any,
    tasks: tasks as any,
    tickets: tickets as any,
  });
  const inHouse = (bookings as any[]).filter((b) => b.status === "CHECKED_IN");
  const confirmed = (bookings as any[]).filter((b) => b.status === "CONFIRMED");

  return {
    businessDate,
    rooms: states,
    summary: summarize(states),
    movements: {
      expectedArrivals: confirmed.filter((b) => toBusinessDate(b.checkInDate) === businessDate).length,
      arrived,
      expectedDepartures: inHouse.filter((b) => toBusinessDate(b.checkOutDate) === businessDate).length,
      overdueDepartures: inHouse.filter((b) => toBusinessDate(b.checkOutDate) < businessDate).length,
      departed,
      noShows,
      cancellations,
      inHouseStays: inHouse.length,
      inHouseGuests: inHouse.reduce((sum, b) => sum + (b.adults || 1) + (b.children || 0), 0),
    },
    byRoomId: new Map(states.map((r) => [r.roomId, r])),
  };
}

export const roomStatusService = { getSnapshot, deriveRoomStates, summarize, legacyRoomFields, hkStateFor };

/**
 * Overlays the derived state onto room documents for API responses: the stored
 * status fields are replaced by the snapshot's values and a `roomState` object is
 * attached, so list/rack/board pages show the same truth as every other module.
 */
export async function withDerivedState<T extends { _id: any }>(
  rooms: T[],
  businessDate: BusinessDate = todayBusinessDate(),
  opts: { propertyId?: mongoose.Types.ObjectId | string } = {},
): Promise<Array<T & ReturnType<typeof legacyRoomFields> & { roomState?: RoomState }>> {
  const snap = await getSnapshot(businessDate, opts);
  return rooms.map((r: any) => {
    const plain = typeof r.toObject === "function" ? r.toObject() : r;
    const state = snap.byRoomId.get(String(plain._id));
    return state ? { ...plain, ...legacyRoomFields(state), roomState: state } : plain;
  });
}
