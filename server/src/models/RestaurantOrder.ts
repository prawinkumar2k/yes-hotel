import mongoose, { Document, Schema } from "mongoose";

export enum OrderStatus {
  KITCHEN_PENDING = "KITCHEN_PENDING",
  PREPARING = "PREPARING",
  READY = "READY",
  SERVED = "SERVED",
  BILLED = "BILLED",
  CANCELLED = "CANCELLED",
}

export interface IOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
}

export interface IRestaurantOrder extends Document {
  kotNumber: string;
  tableNumber?: string;
  roomNumber?: string;
  bookingId?: mongoose.Types.ObjectId;
  folioId?: mongoose.Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  status: OrderStatus;
  chargeToFolio: boolean;
  notes?: string;
  createdAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  specialInstructions: { type: String },
});

const RestaurantOrderSchema = new Schema<IRestaurantOrder>(
  {
    kotNumber: { type: String, required: true, unique: true },
    tableNumber: { type: String },
    roomNumber: { type: String },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    folioId: { type: Schema.Types.ObjectId, ref: "Folio" },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.KITCHEN_PENDING,
    },
    chargeToFolio: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

export const RestaurantOrder = mongoose.model<IRestaurantOrder>("RestaurantOrder", RestaurantOrderSchema);
