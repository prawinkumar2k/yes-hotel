// READ-ONLY: advance reconciliation (advance.service.reconcileAdvances). Writes docs/repair/advance-reconciliation.md.
//   npx tsx scripts/repair/advance-reconciliation-report.ts
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import { reconcileAdvances } from "../../server/src/services/advance.service";

await mongoose.connect(process.env.MONGODB_URI!);
const r = await reconcileAdvances();
const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const out = [
  `# Advance reconciliation (dry run)\n`,
  `Generated ${new Date().toISOString()}. Nothing was changed.\n`,
  `- Advances: **${r.count}** · received ${inr(r.totals.received)} · applied ${inr(r.totals.applied)} · refunded ${inr(r.totals.refunded)} · remaining ${inr(r.totals.remaining)}`,
  `- Advances with mismatches: **${r.mismatches.length}**\n`,
  `| Advance | Amount | Applied | Refunded | Remaining | On folio | Status | Issues |\n|---|---:|---:|---:|---:|---:|---|---|`,
  ...r.mismatches.map((m) => `| ${m.advanceNumber} | ${inr(m.amount)} | ${inr(m.applied)} | ${inr(m.refunded)} | ${inr(m.remaining)} | ${inr(m.onFolio)} | ${m.status} | ${m.issues.join("; ")} |`),
];
fs.writeFileSync("docs/repair/advance-reconciliation.md", out.join("\n") + "\n");
console.log(out.slice(2, 4).join("\n"));
for (const m of r.mismatches) console.log(m.advanceNumber, m.issues.join("; "));
await mongoose.disconnect();
