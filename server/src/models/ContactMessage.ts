import mongoose, { Document, Schema } from "mongoose";

export enum ContactStatus {
  NEW = "NEW",
  READ = "READ",
  RESPONDED = "RESPONDED",
  ARCHIVED = "ARCHIVED",
}

export interface IContactMessage extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NEW },
  },
  { timestamps: true }
);

export const ContactMessage = mongoose.model<IContactMessage>("ContactMessage", ContactMessageSchema);
