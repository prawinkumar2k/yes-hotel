import mongoose, { Document, Schema } from "mongoose";

export enum ApprovalCategory {
  FUND_TRANSFER = "FUND_TRANSFER",
  CONFIDENTIAL_OVERRIDE = "CONFIDENTIAL_OVERRIDE",
  MAINTENANCE = "MAINTENANCE",
  DISCOUNT = "DISCOUNT",
  REFUND = "REFUND",
  PURCHASE = "PURCHASE",
}

export enum ApprovalPriority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ConfidentialLevel {
  SUPER_ADMIN_ONLY = "SUPER_ADMIN_ONLY",
  EXECUTIVE = "EXECUTIVE",
  MANAGER = "MANAGER",
}

export interface ITaskApproval extends Document {
  propertyId: mongoose.Types.ObjectId;
  category: ApprovalCategory;
  title: string;
  description: string;
  requestedBy: mongoose.Types.ObjectId;
  requestedByName?: string;
  amount?: number;
  recipientAccount?: string;
  bankName?: string;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  confidentialLevel: ConfidentialLevel;
  /** Reference to the entity awaiting the approval (booking, PO, refund, etc.) */
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  /** Who approved/rejected */
  actionBy?: mongoose.Types.ObjectId;
  actionNote?: string;
  actionAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const TaskApprovalSchema = new Schema<ITaskApproval>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    category: {
      type: String,
      enum: Object.values(ApprovalCategory),
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedByName: { type: String },
    amount: { type: Number },
    recipientAccount: { type: String },
    bankName: { type: String },
    priority: {
      type: String,
      enum: Object.values(ApprovalPriority),
      default: ApprovalPriority.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(ApprovalStatus),
      default: ApprovalStatus.PENDING,
    },
    confidentialLevel: {
      type: String,
      enum: Object.values(ConfidentialLevel),
      default: ConfidentialLevel.MANAGER,
    },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    actionBy: { type: Schema.Types.ObjectId, ref: "User" },
    actionNote: { type: String },
    actionAt: { type: Date },
  },
  { timestamps: true }
);

// Index for fast pending queries
TaskApprovalSchema.index({ status: 1, createdAt: -1 });
TaskApprovalSchema.index({ requestedBy: 1 });

export const TaskApproval =
  (mongoose.models.TaskApproval as mongoose.Model<ITaskApproval>) ||
  mongoose.model<ITaskApproval>("TaskApproval", TaskApprovalSchema);
