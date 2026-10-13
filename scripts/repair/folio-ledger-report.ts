// READ-ONLY report: folio balances under the corrected ledger (server/src/services/folio-ledger.ts).
//
//  1. Every folio whose stored totals differ from the ledger recomputation.
//  2. SETTLED/CLOSED folios whose ledger balance is not exactly ₹0.
//  3. Detail for the named repair bookings: WALKIN-1011-001, WALKIN-1011-002, YES-BKG-2020.
//
// Writes docs/repair/folio-ledger-report.md. Changes nothing.
//   npx tsx scripts/repair/folio-ledger-report.ts
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import { computeFolioTotals } from "../../server/src/services/folio-ledger";

const NAMED = ["WALKIN-1011-001", "WALKIN-1011-002", "YES-BKG-2020"];
await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const folios = await db.collection("folios").find({}).toArray();
const lines = await db.collection("foliolines").find({}).toArray();
const bookings = new Map((await db.collection("bookings").find({}).toArray()).map((b) => [String(b._id), b]));
const byFolio = new Map<string, any[]>();
for (const l of lines) {
  const k = String(l.folio);
  if (!byFolio.has(k)) byFolio.set(k, []);
  byFolio.get(k)!.push(l);
}

const rows = folios.map((f) => {
  const ls = byFolio.get(String(f._id)) ?? [];
  const t = computeFolioTotals(ls as any);
  const b = bookings.get(String(f.booking));
  return { f, b, ls, t, ref: b?.bookingReference ?? "(no booking)", stored: Number(f.balance ?? 0), drift: Math.round((t.balance - Number(f.balance ?? 0)) * 100) / 100 };
});
const drifted = rows.filter((r) => r.drift !== 0);
const closedUnbalanced = rows.filter((r) => ["SETTLED", "CLOSED"].includes(r.f.status) && r.t.balance !== 0);
const legacyRefunds = lines.filter((l) => l.lineType === "REFUND" && l.direction === "CREDIT");

const out: string[] = [];
out.push(`# Folio ledger report (dry run)\n`);
out.push(`Generated ${new Date().toISOString()}. Nothing was changed. Ledger rule: balance = charges + tax + refunds − discounts − paid − advances; a REVERSAL undoes its target line.\n`);
out.push(`- Folios: **${folios.length}**, lines: **${lines.length}**`);
out.push(`- Folios whose stored balance differs from the ledger: **${drifted.length}**`);
out.push(`- SETTLED/CLOSED folios with a non-zero ledger balance: **${closedUnbalanced.length}**`);
out.push(`- Legacy REFUND lines stored as CREDIT (now counted as debit): **${legacyRefunds.length}**\n`);
out.push(`## Stored vs ledger balance\n`);
out.push(`| Booking | Status | Stored balance | Ledger balance | Difference |\n|---|---|---:|---:|---:|`);
for (const r of drifted) out.push(`| ${r.ref} | ${r.f.status} | ${inr(r.stored)} | ${inr(r.t.balance)} | ${inr(r.drift)} |`);
out.push(`\n## SETTLED/CLOSED with non-zero balance\n`);
out.push(`| Booking | Status | Invoice | Ledger balance | Charges+tax | Paid | Advances | Refunds |\n|---|---|---|---:|---:|---:|---:|---:|`);
for (const r of closedUnbalanced) out.push(`| ${r.ref} | ${r.f.status} | ${r.f.invoiceNumber ?? ""} | ${inr(r.t.balance)} | ${inr(r.t.totalCharges + r.t.totalTax)} | ${inr(r.t.totalPaid)} | ${inr(r.t.totalAdvanceAdjusted)} | ${inr(r.t.totalRefunded)} |`);
out.push(`\n## Named repair bookings\n`);
for (const ref of NAMED) {
  const r = rows.filter((x) => x.ref === ref);
  out.push(`### ${ref}\n`);
  if (!r.length) { out.push(`No folio found.\n`); continue; }
  for (const x of r) {
    out.push(`Folio ${x.f._id} · ${x.f.status} · stored ${inr(x.stored)} → ledger ${inr(x.t.balance)}\n`);
    out.push(`| Date | Type | Description | Amount | Linked record |\n|---|---|---|---:|---|`);
    for (const l of x.ls.sort((a, b) => +new Date(a.date) - +new Date(b.date)))
      out.push(`| ${new Date(l.date).toISOString().slice(0, 10)} | ${l.lineType}${l.reversedLineId ? " ↩" : ""} | ${(l.description ?? "").replace(/\|/g, "/")} | ${inr(l.amount)} | ${l.paymentId ? "Payment" : l.advancePaymentId ? "Advance" : ""} |`);
    out.push("");
  }
}
out.push(`## Proposed repair (needs approval)\n`);
out.push(`- Stored totals: rewrite each folio's totals from the ledger (no line changes).`);
out.push(`- Non-zero SETTLED folios: post the correcting entry (REFUND for a guest credit, or reopen and collect a due amount) with reason "ledger repair", by approval per folio.`);
out.push(`- Named bookings: as listed above; reversals only, nothing deleted.`);
fs.mkdirSync("docs/repair", { recursive: true });
fs.writeFileSync("docs/repair/folio-ledger-report.md", out.join("\n") + "\n");
console.log(`folios=${folios.length} drifted=${drifted.length} closedUnbalanced=${closedUnbalanced.length} legacyRefunds=${legacyRefunds.length}`);
for (const ref of NAMED) { const r = rows.find((x) => x.ref === ref); console.log(ref, r ? `${r.f.status} stored=${r.stored} ledger=${r.t.balance}` : "no folio"); }
await mongoose.disconnect();
