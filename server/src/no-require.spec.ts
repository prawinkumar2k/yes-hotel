/**
 * The production server is an ES module: `require(...)` throws "require is not defined" there
 * (tests don't notice — vitest provides it). It once broke every website booking. Use `import`.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function serverFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "scripts" ? [] : serverFiles(p);
    return /\.ts$/.test(e.name) && !/\.spec\.ts$/.test(e.name) ? [p] : [];
  });
}

describe("server code runs as an ES module", () => {
  it("never calls require()", () => {
    const offenders = serverFiles(path.resolve(__dirname))
      .concat([path.resolve(__dirname, "../index.ts"), path.resolve(__dirname, "../node-build.ts")])
      .filter((f) => fs.readFileSync(f, "utf8").split("\n").some((line) => /(^|[^.\w])require\(/.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*")));
    expect(offenders.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });
});
