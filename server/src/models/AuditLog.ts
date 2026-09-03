import mongoose, { Document, Schema } from "mongoose";

export enum AuditActorType {
  USER = "USER",
  GUEST = "GUEST",
  SYSTEM = "SYSTEM",
}

export interface IAuditLog extends Document {
  actorType: AuditActorType;
  actorId?: mongoose.Types.ObjectId;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorType: {
      type: String,
      enum: Object.values(AuditActorType),
      required: true,
      default: AuditActorType.USER,
    },
    // Only present for actorType USER — a GUEST/SYSTEM action has no human
    // account to attribute it to, and we never fabricate one just to satisfy
    // this field.
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true, trim: true },
    resourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ actorId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
