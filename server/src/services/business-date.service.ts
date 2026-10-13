/**
 * The operational business date (night-audit controlled), distinct from the wall-clock
 * date: it only advances when the night audit closes the day.
 *
 * Reads never create anything. The night audit (an explicit action) creates the first
 * business date if none exists yet.
 */
import mongoose from "mongoose";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";
import { Property } from "../models/Property";
import { businessDayRange, toBusinessDate, todayBusinessDate, type BusinessDate as Ymd } from "../../../shared/dates";

export interface CurrentBusinessDate {
  date: Ymd;
  initialised: boolean;
  doc?: any;
}

/** Read-only: the current business date, or today's IST date if night audit has never run. */
export async function getCurrentBusinessDate(session?: mongoose.ClientSession): Promise<CurrentBusinessDate> {
  const doc = await BusinessDate.findOne({ isCurrentDate: true }).session(session ?? null).lean();
  return doc ? { date: toBusinessDate(doc.date), initialised: true, doc } : { date: todayBusinessDate(), initialised: false };
}

/** Explicit: returns the current business date document, creating today's if none exists. */
export async function ensureCurrentBusinessDate(session: mongoose.ClientSession, actorId?: string, propertyId?: unknown) {
  const existing = await BusinessDate.findOne({ isCurrentDate: true }).session(session);
  if (existing) return existing;
  let pid = propertyId;
  if (!pid) {
    const props = await Property.find({ isActive: { $ne: false } }).select("_id").limit(2).session(session).lean();
    if (props.length !== 1) throw new Error("Cannot open a business date: specify the property (found " + props.length + ")");
    pid = props[0]._id;
  }
  const [created] = await (BusinessDate as any).create(
    [{
      propertyId: pid,
      date: businessDayRange(todayBusinessDate()).start,
      state: BusinessDateState.OPEN,
      isCurrentDate: true,
      openedAt: new Date(),
      openedBy: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
    }],
    { session },
  );
  return created;
}

/** True when the business date `ymd` has been closed by the night audit (postings to it are locked). */
export async function isBusinessDateClosed(ymd: Ymd, session?: mongoose.ClientSession): Promise<boolean> {
  const { start, end } = businessDayRange(ymd);
  return !!(await BusinessDate.exists({ date: { $gte: start, $lt: end }, state: BusinessDateState.CLOSED }).session(session ?? null));
}
