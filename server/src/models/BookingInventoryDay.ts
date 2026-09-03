import mongoose, { Document, Schema } from "mongoose";

export interface IBookingInventoryDay extends Document {
  roomCategory: mongoose.Types.ObjectId;
  stayDate: Date;
  capacity: number;
  reservedCount: number;
}

const BookingInventoryDaySchema = new Schema<IBookingInventoryDay>(
  {
    roomCategory: { type: Schema.Types.ObjectId, ref: "RoomCategory", required: true },
    stayDate: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 0 },
    reservedCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

BookingInventoryDaySchema.index({ roomCategory: 1, stayDate: 1 }, { unique: true });
BookingInventoryDaySchema.index({ stayDate: 1 });

export const BookingInventoryDay = mongoose.model<IBookingInventoryDay>("BookingInventoryDay", BookingInventoryDaySchema);
