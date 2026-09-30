import mongoose, { Document, Schema } from "mongoose";

export interface IRolePermission extends Document {
  roleId: mongoose.Types.ObjectId;
  pageKey: string;
  actions: string[]; // the subset of actions allowed for this role
  isActive: boolean;
}

const RolePermissionSchema = new Schema<IRolePermission>(
  {
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    pageKey: { type: String, required: true, uppercase: true },
    actions: [{ type: String, uppercase: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

RolePermissionSchema.index({ roleId: 1, pageKey: 1 }, { unique: true });

export const RolePermission = (mongoose.models.RolePermission as mongoose.Model<IRolePermission>) || mongoose.model<IRolePermission>("RolePermission", RolePermissionSchema);
