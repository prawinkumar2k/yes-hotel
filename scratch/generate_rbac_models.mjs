import fs from 'fs';
import path from 'path';

const modelsDir = 'c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models';

const roleSchema = `import mongoose, { Document, Schema } from "mongoose";

export interface IRole extends Document {
  name: string;
  key: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Role = (mongoose.models.Role as mongoose.Model<IRole>) || mongoose.model<IRole>("Role", RoleSchema);
`;

const pageResourceSchema = `import mongoose, { Document, Schema } from "mongoose";

export interface IPageResource extends Document {
  key: string;
  name: string;
  module: string;
  description?: string;
  route?: string;
  icon?: string;
  parentKey?: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  sensitive: boolean;
  propertyScoped: boolean;
  actions: string[]; // e.g. VIEW, CREATE, EDIT, DELETE, EXPORT
}

const PageResourceSchema = new Schema<IPageResource>(
  {
    key: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    module: { type: String, required: true },
    description: { type: String },
    route: { type: String },
    icon: { type: String },
    parentKey: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    sensitive: { type: Boolean, default: false },
    propertyScoped: { type: Boolean, default: true },
    actions: [{ type: String, uppercase: true }],
  },
  { timestamps: true }
);

export const PageResource = (mongoose.models.PageResource as mongoose.Model<IPageResource>) || mongoose.model<IPageResource>("PageResource", PageResourceSchema);
`;

const rolePermissionSchema = `import mongoose, { Document, Schema } from "mongoose";

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
`;

const userPermissionOverrideSchema = `import mongoose, { Document, Schema } from "mongoose";

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
`;

fs.writeFileSync(path.join(modelsDir, 'Role.ts'), roleSchema);
fs.writeFileSync(path.join(modelsDir, 'PageResource.ts'), pageResourceSchema);
fs.writeFileSync(path.join(modelsDir, 'RolePermission.ts'), rolePermissionSchema);
fs.writeFileSync(path.join(modelsDir, 'UserPermissionOverride.ts'), userPermissionOverrideSchema);

console.log('RBAC models generated successfully.');
