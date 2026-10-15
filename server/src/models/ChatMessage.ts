import mongoose, { Document, Schema } from "mongoose";

export enum ChatSender {
  GUEST = "GUEST",
  BOT = "BOT",
  STAFF = "STAFF",
  SYSTEM = "SYSTEM",
}

/**
 * One chat message. `clientMessageId` (unique per conversation) makes sending idempotent: a
 * retried or reconnect-resent message is stored once.
 */
export interface IChatMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  sender: ChatSender;
  staff?: mongoose.Types.ObjectId;
  text: string;
  clientMessageId: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "ChatConversation", required: true },
    sender: { type: String, enum: Object.values(ChatSender), required: true },
    staff: { type: Schema.Types.ObjectId, ref: "User" },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    clientMessageId: { type: String, required: true, maxlength: 80 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ChatMessageSchema.index({ conversation: 1, clientMessageId: 1 }, { unique: true, name: "one_message_per_client_id" });
ChatMessageSchema.index({ conversation: 1, createdAt: 1 });

export const ChatMessage =
  (mongoose.models.ChatMessage as mongoose.Model<IChatMessage>) || mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
