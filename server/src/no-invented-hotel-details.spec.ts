/**
 * Invoices, receipts and registration cards once printed an invented GSTIN, phone, email and
 * website typed into the pages. Hotel details must come from Admin → Settings (or the hotel's real
 * facts in shared/hotel-info.ts) — this fails if any of those invented values come back.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const INVENTED = ["29AAAFY1234A1Z5", "080-28522333", "9902391178", "SALES@YESHOTELS.COM", "WWW.YESHOTELS.COM", "stay@yeshotels.in"];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "scripts" || e.name === "node_modules" ? [] : files(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.spec\.ts$/.test(e.name) ? [p] : [];
  });
}

describe("printed documents use the hotel's real details", () => {
  it("no invented GSTIN, phone, email or website in the code", () => {
    const root = path.resolve(__dirname, "../..");
    const hits = [...files(path.join(root, "client")), ...files(path.join(root, "server/src")), ...files(path.join(root, "shared"))]
      .flatMap((f) => INVENTED.filter((v) => fs.readFileSync(f, "utf8").includes(v)).map((v) => `${path.relative(root, f)}: ${v}`));
    expect(hits).toEqual([]);
  });
});
