/**
 * Group room blocks.
 *
 *   Confirm   holds category inventory for every block room (same sell-limit claim as a booking).
 *   Pickup    turns one held room into a named CONFIRMED booking (the rooming list); the
 *             inventory is already held, so the booking does not claim it again.
 *   Release   gives unpicked held rooms back to sale (manually, at the cut-off, or on cancel).
 *
 *   Status    ENQUIRY → TENTATIVE → CONFIRMED → CHECKED_IN → CHECKED_OUT; CANCELLED from any
 *             state before CHECKED_IN.
 */
import mongoose from "mongoose";
import { GroupBooking, GroupBookingStatus } from "../models/GroupBooking";
import { Booking, BookingStatus } from "../models/Booking";
import { prepareInventoryDays, claimInventoryDays, releaseInventoryDays } from "./booking-safety.service";
import { computeRoomTax, loadRoomPricing } from "./tax.service";
import { nights as countNights } from "../../../shared/dates";

export class GroupRuleError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const NEXT: Record<GroupBookingStatus, GroupBookingStatus[]> = {
  [GroupBookingStatus.ENQUIRY]: [GroupBookingStatus.TENTATIVE, GroupBookingStatus.CONFIRMED, GroupBookingStatus.CANCELLED],
  [GroupBookingStatus.TENTATIVE]: [GroupBookingStatus.CONFIRMED, GroupBookingStatus.CANCELLED],
  [GroupBookingStatus.CONFIRMED]: [GroupBookingStatus.CHECKED_IN, GroupBookingStatus.CANCELLED],
  [GroupBookingStatus.CHECKED_IN]: [GroupBookingStatus.CHECKED_OUT],
  [GroupBookingStatus.CHECKED_OUT]: [],
  [GroupBookingStatus.CANCELLED]: [],
};

export function assertGroupTransition(from: GroupBookingStatus, to: GroupBookingStatus) {
  if (from !== to && !NEXT[from]?.includes(to)) throw new GroupRuleError(`A ${from} group cannot move to ${to}`);
}

/** OUTSIDE the transaction: prepares inventory documents and returns capacity per category. */
export async function prepareGroupInventory(groupId: string): Promise<Map<string, number>> {
  const group = await GroupBooking.findById(groupId).lean();
  if (!group) throw new GroupRuleError("Group not found", 404);
  if (!group.roomBlocks.length) throw new GroupRuleError("Add at least one room block before confirming");
  const capacities = new Map<string, number>();
  for (const block of group.roomBlocks) {
    if (!block.roomCategoryId) throw new GroupRuleError(`Block "${block.categoryName}" needs a room category`);
    const id = String(block.roomCategoryId);
    if (!capacities.has(id)) capacities.set(id, await prepareInventoryDays(id, group.checkIn, group.checkOut));
  }
  return capacities;
}

/** INSIDE the transaction: holds inventory for every block (all-or-nothing), one claim per category. */
export async function holdGroupBlocks(groupId: string, capacities: Map<string, number>, session: mongoose.ClientSession) {
  const group = await GroupBooking.findById(groupId).session(session);
  if (!group) throw new GroupRuleError("Group not found", 404);
  const toHold = new Map<string, number>();
  for (const block of group.roomBlocks) {
    const n = block.roomsRequired - (block.roomsHeld ?? 0) - (block.roomsPickedUp ?? 0);
    if (n > 0) toHold.set(String(block.roomCategoryId), (toHold.get(String(block.roomCategoryId)) ?? 0) + n);
  }
  for (const [categoryId, count] of toHold) {
    const capacity = capacities.get(categoryId);
    if (capacity == null) throw new GroupRuleError("Inventory was not prepared for this group");
    await claimInventoryDays({ roomCategoryId: categoryId, checkInDate: group.checkIn, checkOutDate: group.checkOut, capacity, count, session });
  }
  for (const block of group.roomBlocks) {
    const n = block.roomsRequired - (block.roomsHeld ?? 0) - (block.roomsPickedUp ?? 0);
    if (n > 0) block.roomsHeld = (block.roomsHeld ?? 0) + n;
    block.roomsConfirmed = block.roomsRequired;
  }
  await group.save({ session });
  return group;
}

/** Returns unpicked held rooms to sale. `count` omitted → all of them. */
export async function releaseGroupRooms(groupId: string, blockIndex: number | undefined, count: number | undefined, session: mongoose.ClientSession) {
  const group = await GroupBooking.findById(groupId).session(session);
  if (!group) throw new GroupRuleError("Group not found", 404);
  const blocks = blockIndex == null ? group.roomBlocks.map((b, i) => [b, i] as const) : [[group.roomBlocks[blockIndex], blockIndex] as const];
  let released = 0;
  for (const [block] of blocks) {
    if (!block) throw new GroupRuleError("Room block not found", 404);
    const n = Math.min(block.roomsHeld ?? 0, count ?? (block.roomsHeld ?? 0));
    if (n > 0) {
      await releaseInventoryDays({ roomCategoryId: String(block.roomCategoryId), checkInDate: group.checkIn, checkOutDate: group.checkOut, session, count: n });
      block.roomsHeld = (block.roomsHeld ?? 0) - n;
      released += n;
    }
  }
  await group.save({ session });
  return { group, released };
}

/** Creates a named booking from a held block room (rooming list entry). */
export async function pickupGroupRoom(
  groupId: string,
  blockIndex: number,
  guest: { firstName: string; lastName?: string; email?: string; phone: string; adults?: number; children?: number },
  session: mongoose.ClientSession,
) {
  const group = await GroupBooking.findById(groupId).session(session);
  if (!group) throw new GroupRuleError("Group not found", 404);
  if (group.status !== GroupBookingStatus.CONFIRMED) throw new GroupRuleError("Rooms can be picked up only from a CONFIRMED group");
  const block = group.roomBlocks[blockIndex];
  if (!block) throw new GroupRuleError("Room block not found", 404);
  if ((block.roomsHeld ?? 0) < 1) throw new GroupRuleError(`No held rooms left in block "${block.categoryName}"`, 409);

  const nights = countNights(group.checkIn, group.checkOut);
  const { rules, inclusive } = await loadRoomPricing();
  const tax = computeRoomTax(rules, { checkIn: group.checkIn, checkOut: group.checkOut, nightlyValue: block.ratePerRoom, inclusive });
  const { generateBookingReference } = await import("../utils/booking-reference");
  const [booking] = await Booking.create(
    [{
      propertyId: (group as any).propertyId,
      bookingReference: await generateBookingReference("GRP", session),
      guestDetails: { firstName: guest.firstName, lastName: guest.lastName ?? "", email: guest.email ?? group.organiserEmail, phone: guest.phone },
      roomCategory: block.roomCategoryId,
      checkInDate: group.checkIn,
      checkOutDate: group.checkOut,
      adults: guest.adults ?? 1,
      children: guest.children ?? 0,
      status: BookingStatus.CONFIRMED,
      source: "CORPORATE" as any,
      bookingType: "GROUP" as any,
      groupId: group._id,
      company: group.corporateAccountId,
      ratePerNight: block.ratePerRoom,
      taxAmount: tax.tax,
      cgstAmount: tax.cgst,
      sgstAmount: tax.sgst,
      totalAmount: tax.total,
      pricesIncludeTax: inclusive,
      paidAmount: 0,
      discountAmount: 0,
      paymentStatus: "UNPAID" as any,
    }],
    { session },
  );
  block.roomsHeld = (block.roomsHeld ?? 0) - 1;
  block.roomsPickedUp = (block.roomsPickedUp ?? 0) + 1;
  group.assignedBookings.push(booking._id as any);
  await group.save({ session });
  return { group, booking, nights };
}
