import mongoose, { Document, Schema } from "mongoose";

/**
 * A website chat between a guest and the hotel. The chatbot answers first; the guest can ask for a
 * person, and Reception / Admin reply from the Live Chat page. Every message is a ChatMessage.
 *
 * Status: BOT (bot only) → WAITING (guest asked for staff, or wrote after hours of bot) →
 *         ASSIGNED (a staff member replied / took it) → RESOLVED. ABANDONED = no guest activity for
 *         24 h while not resolved. A new guest message reopens RESOLVED / ABANDONED as WAITING.
 */
export enum ChatStatus {
  BOT = "BOT",
  WAITING = "WAITING",
  ASSIGNED = "ASSIGNED",
  RESOLVED = "RESOLVED",
  ABANDONED = "ABANDONED",
}

export interface IChatConversation extends Document {
  propertyId?: mongoose.Types.ObjectId;
  guestTokenHash: string;
  guest: { name?: string; phone?: string; email?: string };
  customer?: mongoose.Types.ObjectId;
  status: ChatStatus;
  assignedTo?: mongoose.Types.ObjectId;
  lastMessageAt: Date;
  lastGuestMessageAt?: Date;
  lastMessagePreview?: string;
  unreadForStaff: number;
  unreadForGuest: number;
  pageUrl?: string;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatConversationSchema = new Schema<IChatConversation>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    guestTokenHash: { type: String, required: true, select: false },
    guest: {
      name: { type: String, trim: true, maxlength: 120 },
      phone: { type: String, trim: true, maxlength: 30 },
      email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: Object.values(ChatStatus), default: ChatStatus.BOT },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    lastMessageAt: { type: Date, default: Date.now },
    lastGuestMessageAt: { type: Date },
    lastMessagePreview: { type: String, maxlength: 200 },
    unreadForStaff: { type: Number, default: 0 },
    unreadForGuest: { type: Number, default: 0 },
    pageUrl: { type: String, maxlength: 300 },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

ChatConversationSchema.index({ status: 1, lastMessageAt: -1 });
ChatConversationSchema.index({ propertyId: 1, lastMessageAt: -1 });

export const ChatConversation =
  (mongoose.models.ChatConversation as mongoose.Model<IChatConversation>) ||
  mongoose.model<IChatConversation>("ChatConversation", ChatConversationSchema);
