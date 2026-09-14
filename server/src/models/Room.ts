import mongoose, { Document, Schema } from "mongoose";

/**
 * Legacy combined status — kept for backward compatibility with existing
 * queries and the booking-safety/room-state services that already use it.
 * All NEW business logic (housekeeping inspection, manual release, front-desk
 * rack) uses the three independent state fields below.
 */
export enum RoomStatus {
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  OCCUPIED = "OCCUPIED",
  CLEANING = "CLEANING",
  MAINTENANCE = "MAINTENANCE",
  OUT_OF_SERVICE = "OUT_OF_SERVICE",
}

/**
 * Whether a physical room currently has a guest or an imminent booking.
 * Independent of housekeeping and sellability.
 */
export enum OccupancyStatus {
  VACANT = "VACANT",
  OCCUPIED = "OCCUPIED",
  RESERVED = "RESERVED",    // confirmed future reservation assigned to this room
  ARRIVING = "ARRIVING",    // guest expected today
  DEPARTING = "DEPARTING",  // guest checking out today
}

/**
 * Current housekeeping state of the physical room.
 * Tracks the full cleaning → inspection → release lifecycle.
 */
export enum HousekeepingRoomStatus {
  CLEAN = "CLEAN",
  DIRTY = "DIRTY",
  ASSIGNED = "ASSIGNED",              // assigned to a housekeeper, not yet started
  CLEANING = "CLEANING",              // housekeeper started
  CLEANING_COMPLETED = "CLEANING_COMPLETED", // housekeeper marked done, pending inspection
  INSPECTION = "INSPECTION",          // supervisor is inspecting
  INSPECTION_FAILED = "INSPECTION_FAILED",   // inspection failed — needs re-clean
  INSPECTED = "INSPECTED",            // inspection passed, waiting for authorized release
  WAITING_FOR_RELEASE = "WAITING_FOR_RELEASE", // inspected, awaiting manual release
  READY = "READY",                    // manually released — sellable
  DND = "DND",                        // Do Not Disturb (guest request)
  REFUSED_SERVICE = "REFUSED_SERVICE",
}

/**
 * Whether the room is available to sell. Independently controlled from
 * occupancy and housekeeping — a room can be OCCUPIED+SELLABLE (blocked
 * upgrade room), or VACANT+OUT_OF_ORDER (maintenance).
 */
export enum SellStatus {
  SELLABLE = "SELLABLE",
  BLOCKED = "BLOCKED",           // temporarily held, not for sale
  OUT_OF_ORDER = "OUT_OF_ORDER", // major repair — no revenue
  OUT_OF_SERVICE = "OUT_OF_SERVICE", // minor issue — manageable revenue impact
}

export interface IRoom extends Document {
  roomNumber: string;
  category: mongoose.Types.ObjectId;
  floor: string;
  wing?: string;
  building?: string;
  notes?: string;

  // ── LEGACY COMBINED STATUS (preserved for backward compat) ──
  status: RoomStatus;
  maintenanceNotes?: string;

  // ── THREE INDEPENDENT STATE DIMENSIONS ──
  occupancyStatus: OccupancyStatus;
  housekeepingStatus: HousekeepingRoomStatus;
  sellStatus: SellStatus;

  // ── OPERATIONAL FIELDS ──
  currentBooking?: mongoose.Types.ObjectId;  // active booking if OCCUPIED
  lastInspectedAt?: Date;
  lastInspectedBy?: mongoose.Types.ObjectId;
  lastCleanedAt?: Date;
  lastCleanedBy?: mongoose.Types.ObjectId;
  releasedAt?: Date;
  releasedBy?: mongoose.Types.ObjectId;

  // ── PHYSICAL ATTRIBUTES ──
  bedType?: string;
  maxOccupancy?: number;
  squareFootage?: number;
  viewType?: string;           // e.g. "GARDEN", "POOL", "CITY", "SEA"
  isAccessible?: boolean;
  isConnecting?: boolean;
  connectingRoom?: mongoose.Types.ObjectId;
  isSmokingAllowed?: boolean;
  floor_number?: number;       // numeric for rack sorting
  sortOrder?: number;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomNumber: { type: String, required: true, unique: true },
    category: { type: Schema.Types.ObjectId, ref: "RoomCategory", required: true },
    floor: { type: String, required: true },
    wing: { type: String },
    building: { type: String },
    notes: { type: String },

    // ── LEGACY ──
    status: {
      type: String,
      enum: Object.values(RoomStatus),
      default: RoomStatus.AVAILABLE,
    },
    maintenanceNotes: { type: String },

    // ── THREE INDEPENDENT DIMENSIONS ──
    occupancyStatus: {
      type: String,
      enum: Object.values(OccupancyStatus),
      default: OccupancyStatus.VACANT,
    },
    housekeepingStatus: {
      type: String,
      enum: Object.values(HousekeepingRoomStatus),
      default: HousekeepingRoomStatus.CLEAN,
    },
    sellStatus: {
      type: String,
      enum: Object.values(SellStatus),
      default: SellStatus.SELLABLE,
    },

    // ── OPERATIONAL ──
    currentBooking: { type: Schema.Types.ObjectId, ref: "Booking" },
    lastInspectedAt: { type: Date },
    lastInspectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastCleanedAt: { type: Date },
    lastCleanedBy: { type: Schema.Types.ObjectId, ref: "User" },
    releasedAt: { type: Date },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // ── PHYSICAL ──
    bedType: { type: String },
    maxOccupancy: { type: Number },
    squareFootage: { type: Number },
    viewType: { type: String },
    isAccessible: { type: Boolean, default: false },
    isConnecting: { type: Boolean, default: false },
    connectingRoom: { type: Schema.Types.ObjectId, ref: "Room" },
    isSmokingAllowed: { type: Boolean, default: false },
    floor_number: { type: Number },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Rack view: all rooms for a property, sorted by floor then room number
RoomSchema.index({ floor_number: 1, sortOrder: 1 });
// Housekeeping dashboard: filter by housekeepingStatus
RoomSchema.index({ housekeepingStatus: 1 });
// Availability: rooms that are sellable
RoomSchema.index({ sellStatus: 1, category: 1 });
// Legacy: existing availability queries
RoomSchema.index({ status: 1, category: 1 });
// Current booking lookup
RoomSchema.index({ currentBooking: 1 }, { sparse: true });

export const Room = (mongoose.models.Room as mongoose.Model<IRoom>) || mongoose.model<IRoom>("Room", RoomSchema);
