/**
 * Automatic night audit: every night, shortly after midnight (property time), the day that has just ended is closed
 * and the next business date opens: overstay nights are charged, arrivals that never came are marked no-show,
 * the day's summary is stored. If the server was down, the missed day(s) are closed as soon as it is back.
 * Admin → Settings: switch it off or change the time. NIGHT_AUDIT_AUTO=false also turns it off (tests, local work).
 */
import { HotelSettings } from "../models/HotelSettings";
import { User, UserRole } from "../models/User";
import { getCurrentBusinessDate } from "../services/business-date.service";
import { createAuditLog } from "../services/audit.service";
import { logger } from "../services/logger.service";
import { addDays, toBusinessDate, type BusinessDate } from "../../../shared/dates";

const DEFAULT_TIME = "00:05";
const MAX_DAYS_PER_RUN = 7;
let running = false;

/** "HH:MM" of an instant at the property (Asia/Kolkata). */
const clock = (now: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);

/** Is the business date `current` overdue for audit at `now`? Yesterday's date waits for the configured time; older dates run at once. */
export function auditIsDue(current: BusinessDate, now: Date, time: string): boolean {
  const today = toBusinessDate(now);
  if (current >= today) return false;
  if (current < addDays(today, -1)) return true;
  return clock(now) >= time;
}

/** Runs the night audit through the same code the Night Audit page uses, acting as the first active admin. */
async function runOnce(actor: { id: string; role: string }) {
  const { runNightAudit } = await import("../controllers/night-audit.controller");
  let status = 200;
  let body: any = {};
  const res: any = {
    status(code: number) { status = code; return res; },
    json(payload: unknown) { body = payload; return res; },
  };
  const req: any = { user: actor, body: { force: true }, headers: {}, params: {}, query: {}, ip: "night-audit-auto" };
  await runNightAudit(req, res);
  return { status, body };
}

/** One check: closes every overdue business date (up to a week), oldest first. Returns how many were closed. */
export async function runDueNightAudits(now: Date = new Date()): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const settings: any = await HotelSettings.findOne().sort({ updatedAt: -1 }).select("autoNightAuditEnabled autoNightAuditTime").lean();
    if (settings?.autoNightAuditEnabled === false) return 0;
    const time = /^\d{2}:\d{2}$/.test(String(settings?.autoNightAuditTime ?? "")) ? String(settings.autoNightAuditTime) : DEFAULT_TIME;

    const first = await getCurrentBusinessDate();
    if (!first.initialised) return 0; // the first business date is opened by hand once (Night Audit page)
    const admin: any = await User.findOne({ role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] }, isActive: { $ne: false } }).select("_id role").lean();
    if (!admin) return 0;
    const actor = { id: String(admin._id), role: String(admin.role) };

    let closed = 0;
    for (let i = 0; i < MAX_DAYS_PER_RUN; i++) {
      const cur = await getCurrentBusinessDate();
      if (!auditIsDue(cur.date, now, time)) break;
      const { status, body } = await runOnce(actor);
      if (status !== 200 || !body?.success) {
        logger.error("night_audit_auto_failed", { date: cur.date, status, message: body?.message });
        await createAuditLog({ action: "night_audit.auto_failed", resourceType: "BusinessDate", actorId: actor.id, actorRole: actor.role, metadata: { date: cur.date, status, message: body?.message } });
        break;
      }
      closed += 1;
      logger.info("night_audit_auto_completed", { date: cur.date });
      await createAuditLog({ action: "night_audit.auto", resourceType: "BusinessDate", actorId: actor.id, actorRole: actor.role, metadata: { closedDate: cur.date, scheduledFor: time } });
    }
    return closed;
  } finally {
    running = false;
  }
}

/** Checks once a minute (and shortly after start). Safe to run on a restart: the audit itself refuses to run twice for one date. */
export function startNightAuditScheduler() {
  if (process.env.NIGHT_AUDIT_AUTO === "false") return;
  const tick = () => runDueNightAudits().catch((e) => logger.error("night_audit_scheduler_error", { message: e?.message }));
  setTimeout(tick, 30_000).unref();
  setInterval(tick, 60_000).unref();
}
