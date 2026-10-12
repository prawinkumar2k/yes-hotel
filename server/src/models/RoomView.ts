import mongoose, { Document, Schema } from "mongoose";

export interface IRoomView extends Document {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const RoomViewSchema = new Schema<IRoomView>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const RoomView = (mongoose.models.RoomView as mongoose.Model<IRoomView>) || mongoose.model<IRoomView>("RoomView", RoomViewSchema);
