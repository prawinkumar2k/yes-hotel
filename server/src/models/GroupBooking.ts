import mongoose, { Document, Schema } from "mongoose";

export enum GroupBookingStatus {
  ENQUIRY = "ENQUIRY",
  TENTATIVE = "TENTATIVE",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
}

export interface IGroupRoomBlock {
  roomCategoryId?: mongoose.Types.ObjectId;
  categoryName: string;
  roomsRequired: number;
  roomsConfirmed: number;
  ratePerRoom: number;
}

export interface IGroupBooking extends Document {
  groupName: string;
  groupCode: string;
  organiserName: string;
  organiserEmail: string;
  organiserPhone: string;
  corporateAccountId?: mongoose.Types.ObjectId;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  totalRooms: number;
  roomBlocks: IGroupRoomBlock[];
  totalPax: number;
  eventType: string; // conference, wedding, corporate, leisure
  mealPlan: string; // EP, CP, MAP, AP
  totalEstimatedValue: number;
  advancePaid: number;
  balance: number;
  status: GroupBookingStatus;
  assignedBookings: mongoose.Types.ObjectId[]; // individual booking IDs
  notes?: string;
  specialRequirements?: string;
  internalRemarks?: string;
}

const GroupRoomBlockSchema = new Schema<IGroupRoomBlock>({
  roomCategoryId: { type: Schema.Types.ObjectId, ref: "RoomCategory" },
  categoryName: { type: String, required: true },
  roomsRequired: { type: Number, required: true, min: 1 },
  roomsConfirmed: { type: Number, default: 0 },
  ratePerRoom: { type: Number, required: true },
});

const GroupBookingSchema = new Schema<IGroupBooking>(
  {
    groupName: { type: String, required: true },
    groupCode: { type: String, required: true, unique: true },
    organiserName: { type: String, required: true },
    organiserEmail: { type: String, required: true },
    organiserPhone: { type: String, required: true },
    corporateAccountId: { type: Schema.Types.ObjectId, ref: "CorporateAccount" },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    totalRooms: { type: Number, required: true, min: 1 },
    roomBlocks: [GroupRoomBlockSchema],
    totalPax: { type: Number, required: true, min: 1 },
    eventType: { type: String, required: true, default: "corporate" },
    mealPlan: { type: String, required: true, default: "EP" },
    totalEstimatedValue: { type: Number, required: true, default: 0 },
    advancePaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(GroupBookingStatus), default: GroupBookingStatus.ENQUIRY },
    assignedBookings: [{ type: Schema.Types.ObjectId, ref: "Booking" }],
    notes: { type: String },
    specialRequirements: { type: String },
    internalRemarks: { type: String },
  },
  { timestamps: true }
);

// Auto-compute balance before save. Modern promise-style hook (no `next`
// callback) — the callback-style version broke under this project's
// mongoose/kareem versions: TypeScript's `this: IGroupBooking` annotation
// is erased at compile time, but something in the hook-arity detection
// still resolved the actual `next` parameter to something that wasn't a
// function, throwing "next is not a function" on every single save and
// making Group Booking creation completely broken. Reproduced live.
GroupBookingSchema.pre("save", async function (this: IGroupBooking) {
  this.balance = this.totalEstimatedValue - this.advancePaid;
});

export const GroupBooking = (mongoose.models.GroupBooking as mongoose.Model<IGroupBooking>) || mongoose.model<IGroupBooking>("GroupBooking", GroupBookingSchema);
