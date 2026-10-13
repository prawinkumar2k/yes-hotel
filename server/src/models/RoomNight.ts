import mongoose, { Document, Schema } from "mongoose";

/**
 * Room-night inventory: one document per physical room per night it is held by a booking.
 * The unique (room, date) index makes double-booking a room impossible, including under
 * concurrent requests (the second insert fails with a duplicate-key error).
 *
 * date = the business date of the night (IST, "YYYY-MM-DD"): a stay 12→14 Oct holds 12 and 13.
 */
export type RoomNightStatus = "HELD" | "CONSUMED";

export interface IRoomNight extends Document {
  room: mongoose.Types.ObjectId;
  date: string;
  booking: mongoose.Types.ObjectId;
  propertyId?: mongoose.Types.ObjectId;
  status: RoomNightStatus;
}

const RoomNightSchema = new Schema<IRoomNight>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    status: { type: String, enum: ["HELD", "CONSUMED"], default: "HELD" },
  },
  { timestamps: true },
);

RoomNightSchema.index({ room: 1, date: 1 }, { unique: true });
RoomNightSchema.index({ booking: 1 });
RoomNightSchema.index({ date: 1 });

export const RoomNight =
  (mongoose.models.RoomNight as mongoose.Model<IRoomNight>) || mongoose.model<IRoomNight>("RoomNight", RoomNightSchema);
