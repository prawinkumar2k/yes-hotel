/**
 * Lists every Number path in every Mongoose schema (including nested arrays),
 * with the collection it lives in. Input for the paise migration field list.
 *   npx tsx scripts/migrations/list-number-fields.ts > out.json
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose, { Schema } from "mongoose";

const dir = path.resolve("server/src/models");
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith(".ts") && !f.includes(".spec.")) await import(pathToFileURL(path.join(dir, f)).href);
}

function numberPaths(schema: Schema, prefix = ""): string[] {
  const out: string[] = [];
  schema.eachPath((p, type: any) => {
    const full = prefix + p;
    if (type.instance === "Number") out.push(full);
    else if (type.instance === "Array" && type.caster?.instance === "Number") out.push(full + "[]");
    else if (type.schema) out.push(...numberPaths(type.schema, full + (type.instance === "Array" ? "[]." : ".")));
  });
  return out;
}

const result: Record<string, string[]> = {};
for (const name of mongoose.modelNames().sort()) {
  const m = mongoose.model(name);
  const paths = numberPaths(m.schema);
  if (paths.length) result[`${name} (${m.collection.collectionName})`] = paths;
}
console.log(JSON.stringify(result, null, 1));
