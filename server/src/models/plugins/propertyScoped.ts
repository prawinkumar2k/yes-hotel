import { Schema } from "mongoose";
import { Property } from "../Property";

/**
 * Every property-scoped document must carry a propertyId: staff views filter on it,
 * so a document without one silently disappears for property-scoped users.
 *
 * On validate, a missing propertyId is filled with the only active property. With
 * zero or several properties there is no safe default and validation fails, so the
 * caller must set it explicitly.
 *
 * `appliesTo` limits the rule (e.g. User: staff roles only).
 */
export function propertyScoped(schema: Schema, opts: { appliesTo?: (doc: any) => boolean } = {}) {
  if (!schema.path("propertyId")) {
    schema.add({ propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true } });
  }
  schema.pre("validate", async function () {
    const doc: any = this;
    if (doc.propertyId || (opts.appliesTo && !opts.appliesTo(doc))) return;
    const active = await Property.find({ isActive: { $ne: false } }).select("_id").limit(2).lean();
    if (active.length === 1) {
      doc.propertyId = active[0]._id;
      return;
    }
    doc.invalidate(
      "propertyId",
      active.length === 0
        ? "propertyId is required: no active property exists"
        : "propertyId is required when more than one property exists",
    );
  });
}
