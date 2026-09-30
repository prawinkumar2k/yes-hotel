import mongoose, { Document, Schema } from "mongoose";

export enum UserRole {
  CUSTOMER = "CUSTOMER",
  RECEPTIONIST = "RECEPTIONIST",
  HOUSEKEEPING = "HOUSEKEEPING",
  MAINTENANCE = "MAINTENANCE",
  CASHIER = "CASHIER",
  FINANCE = "FINANCE",
  EVENTS = "EVENTS",
  INVENTORY = "INVENTORY",
  PROCUREMENT = "PROCUREMENT",
  RESTAURANT = "RESTAURANT",
  SUPERVISOR = "SUPERVISOR",
  MANAGER = "MANAGER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export interface IUser extends Document {
  propertyId?: mongoose.Types.ObjectId;
  propertyIds?: mongoose.Types.ObjectId[];
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  profileImage?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    propertyIds: [{ type: Schema.Types.ObjectId, ref: "Property" }],
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.CUSTOMER },
    profileImage: { type: String },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

export const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>("User", UserSchema);
