import mongoose, { Document, Schema } from "mongoose";

export interface IUserPermissionOverride extends Document {
  userId: mongoose.Types.ObjectId;
  propertyId?: mongoose.Types.ObjectId; // If null, applies to all properties the user can access
  pageKey: string;
  allowActions: string[];
  denyActions: string[];
}

const UserPermissionOverrideSchema = new Schema<IUserPermissionOverride>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    pageKey: { type: String, required: true, uppercase: true },
    allowActions: [{ type: String, uppercase: true }],
    denyActions: [{ type: String, uppercase: true }],
  },
  { timestamps: true }
);

UserPermissionOverrideSchema.index({ userId: 1, propertyId: 1, pageKey: 1 }, { unique: true });

export const UserPermissionOverride = (mongoose.models.UserPermissionOverride as mongoose.Model<IUserPermissionOverride>) || mongoose.model<IUserPermissionOverride>("UserPermissionOverride", UserPermissionOverrideSchema);
