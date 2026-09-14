import mongoose, { Document, Schema } from "mongoose";

/**
 * Maps a hotel's room category to an OTA channel's rate plan / room type ID.
 * This is the source-of-truth for what YES HOTELS sends to each channel.
 */
export interface IChannelMapping extends Document {
  propertyId: mongoose.Types.ObjectId;
  roomCategoryId: mongoose.Types.ObjectId;
  channel: "BOOKING_COM" | "AGODA" | "MAKE_MY_TRIP" | "STAAH" | "GOIBIBO" | "AIRBNB" | "DIRECT";
  channelRoomTypeId: string;    // External room type / rate plan ID from the OTA
  channelRatePlanId?: string;
  channelPropertyId?: string;   // Property's code/ID on the OTA platform
  isActive: boolean;
  lastSyncedAt?: Date;
  lastSyncStatus?: "SUCCESS" | "FAILED" | "PENDING";
  lastSyncError?: string;
  markupPercent: number;        // Additional markup % applied on top of base rate for this channel
}

const ChannelMappingSchema = new Schema<IChannelMapping>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    roomCategoryId: { type: Schema.Types.ObjectId, ref: "RoomCategory", required: true },
    channel: {
      type: String,
      enum: ["BOOKING_COM", "AGODA", "MAKE_MY_TRIP", "STAAH", "GOIBIBO", "AIRBNB", "DIRECT"],
      required: true,
    },
    channelRoomTypeId: { type: String, required: true },
    channelRatePlanId: { type: String },
    channelPropertyId: { type: String },
    isActive: { type: Boolean, default: true },
    lastSyncedAt: { type: Date },
    lastSyncStatus: { type: String, enum: ["SUCCESS", "FAILED", "PENDING"] },
    lastSyncError: { type: String },
    markupPercent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound unique: one mapping per property+category+channel combination
ChannelMappingSchema.index({ propertyId: 1, roomCategoryId: 1, channel: 1 }, { unique: true });

export const ChannelMapping = mongoose.model<IChannelMapping>("ChannelMapping", ChannelMappingSchema);
