/**
 * Cross-module consistency check: the same fact as reported by Dashboard, Front Desk,
 * Housekeeping, Rooms and Reports APIs, next to ground truth computed from the DB
 * with Asia/Kolkata day boundaries.
 *
 * Dev tool: mints a short-lived SUPER_ADMIN token with JWT_ACCESS_SECRET from .env and
 * calls the running server (default http://localhost:8080). Read-only (GET only).
 *
 *   npx tsx scripts/audit/consistency-check.ts [--label=step-1] [--base=http://localhost:8080]
 * Writes docs/consistency/<label>.md and exits 1 if any metric disagrees.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const BASE = String(args.base || "http://localhost:8080");
const LABEL = String(args.label || "latest");

// IST day window [start, end) for "today" as a UTC Date pair.
function istToday() {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const start = new Date(`${ymd}T00:00:00+05:30`);
  return { ymd, start, end: new Date(start.getTime() + 86_400_000) };
}

type Cell = number | string | null;
const get = (o: any, p: string): any => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const admin = await db.collection("users").findOne({ role: { $in: ["SUPER_ADMIN", "ADMIN"] }, isActive: { $ne: false } });
  if (!admin) throw new Error("No ADMIN user to run the check as");
  const token = jwt.sign({ id: String(admin._id), role: admin.role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "5m" });

  const { ymd, start, end } = istToday();

  // ── Ground truth from the DB ───────────────────────────────────────────────
  const inHouse = await db.collection("bookings").find({ status: "CHECKED_IN" }).project({ assignedRoom: 1 }).toArray();
  const occupiedRooms = new Set(inHouse.map((b) => String(b.assignedRoom)).filter((x) => x !== "undefined" && x !== "null")).size;
  // Room-state truth: the state-machine rules (services/room-status.service.ts) applied to raw DB data.
  const { getSnapshot } = await import("../../server/src/services/room-status.service");
  const snap = await getSnapshot(ymd);
  const payAgg = await db.collection("payments").aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, status: { $in: ["COMPLETED", "REFUNDED"] } } },
    { $group: { _id: null, t: { $sum: "$amount" } } },
  ]).toArray();
  const folioCreditAgg = await db.collection("foliolines").aggregate([
    { $match: { postedAt: { $gte: start, $lt: end }, lineType: "PAYMENT" } },
    { $group: { _id: null, t: { $sum: "$amount" } } },
  ]).toArray();

  // ── Module APIs ────────────────────────────────────────────────────────────
  const call = async (p: string) => {
    const res = await fetch(BASE + p, { headers: { Authorization: `Bearer ${token}` } });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${p} → ${res.status} ${json.message ?? ""}`);
    return json.data;
  };
  const [cc, fd, rooms, rack, hkTasks, exec, inHouseList, day] = await Promise.all([
    call("/api/dashboard/command-center"),
    call("/api/front-desk/summary"),
    call("/api/rooms"),
    call("/api/room-rack"),
    call("/api/admin/housekeeping"),
    call("/api/reports/executive-summary"),
    call("/api/reports/in-house-list"),
    call("/api/reports/day-summary"),
  ]);
  await mongoose.disconnect();

  const rackRooms: any[] = (rack.floors ?? []).flatMap((f: any) => f.rooms ?? []);
  const count = (arr: any[], pred: (x: any) => boolean) => arr.filter(pred).length;

  const metrics: Array<{ metric: string; truth: Cell; cells: Record<string, Cell> }> = [
    {
      metric: "Occupied rooms",
      truth: occupiedRooms,
      cells: {
        "Dashboard (hotelPulse.occupied)": get(cc, "hotelPulse.occupied"),
        "Front Desk (inHouse rooms)": new Set((fd.inHouse ?? []).map((b: any) => String(b.assignedRoom?._id ?? b.assignedRoom))).size,
        "Housekeeping (room rack OCCUPIED)": count(rackRooms, (r) => r.occupancyStatus === "OCCUPIED"),
        "Rooms (occupancyStatus OCCUPIED)": count(rooms, (r: any) => r.occupancyStatus === "OCCUPIED"),
        "Rooms (status OCCUPIED)": count(rooms, (r: any) => r.status === "OCCUPIED"),
        "Reports (day-summary occupiedRooms)": get(day, "occupiedRooms"),
      },
    },
    {
      metric: "Occupancy %",
      truth: snap.summary.sellableRooms ? Math.round((occupiedRooms / snap.summary.sellableRooms) * 100) : null,
      cells: {
        "Dashboard (occupancyPct)": get(cc, "hotelPulse.occupancyPct"),
        "Reports (executive occupancyPct)": get(exec, "occupancyPct"),
      },
    },
    {
      metric: "Dirty rooms",
      truth: snap.summary.dirty,
      cells: {
        "Dashboard (hotelPulse.dirty)": get(cc, "hotelPulse.dirty"),
        "Dashboard (housekeeping.dirty)": get(cc, "housekeeping.dirty"),
        "Front Desk (dirtyRooms)": get(fd, "counts.dirtyRooms"),
        "Housekeeping (room rack DIRTY)": count(rackRooms, (r) => r.housekeepingStatus === "DIRTY"),
        "Rooms (housekeepingStatus DIRTY)": count(rooms, (r: any) => r.housekeepingStatus === "DIRTY"),
      },
    },
    {
      metric: "In-house guests (stays)",
      truth: inHouse.length,
      cells: {
        "Dashboard (inHouse.guests)": (get(cc, "inHouse.guests") ?? []).length,
        "Front Desk (counts.inHouse)": get(fd, "counts.inHouse"),
        "Reports (executive inHouseCount)": get(exec, "inHouseCount"),
        "Reports (in-house-list, in-house rows)": (inHouseList ?? []).filter((r: any) => r.status === "CHECKED_IN").length,
      },
    },
    {
      metric: `Today's collections ₹ (${ymd} IST)`,
      truth: `${payAgg[0]?.t ?? 0} (payments) / ${folioCreditAgg[0]?.t ?? 0} (folio payment lines)`,
      cells: {
        "Dashboard (todayRevenue)": get(cc, "revenue.todayRevenue"),
        "Reports (executive paymentsToday)": get(exec, "paymentsToday"),
        "Reports (day-summary credits)": get(day, "credits"),
      },
    },
  ];

  let failures = 0;
  const lines = [
    `# Cross-module consistency — ${LABEL}`,
    "",
    `Run: ${new Date().toISOString()} · business day ${ymd} (Asia/Kolkata) · server ${BASE}`,
    "",
    "| Metric | DB truth | Module (source field) | Value | Agrees |",
    "|---|---|---|---|---|",
  ];
  for (const m of metrics) {
    const values = Object.values(m.cells).map((v) => String(v));
    const truthNums: string[] = String(m.truth).match(/-?\d+(\.\d+)?/g) ?? [];
    const allEqual = new Set(values).size === 1;
    const matchesTruth = values.every((v) => truthNums.includes(v));
    // Several distinct truth values means the DB itself has no single source for the fact.
    const ambiguousTruth = new Set(truthNums).size > 1;
    const ok = allEqual && !ambiguousTruth && matchesTruth;
    if (!ok) failures++;
    const verdict = ok ? "✅" : ambiguousTruth ? "❌ (no single DB source)" : "❌";
    let first = true;
    for (const [mod, v] of Object.entries(m.cells)) {
      lines.push(`| ${first ? `**${m.metric}**` : ""} | ${first ? m.truth : ""} | ${mod} | ${v} | ${first ? verdict : ""} |`);
      first = false;
    }
  }
  lines.push("", `**${metrics.length - failures}/${metrics.length} metrics consistent.**`);
  const out = path.join("docs/consistency", `${LABEL}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
