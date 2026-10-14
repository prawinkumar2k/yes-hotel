import mongoose, { Document, Schema } from "mongoose";

export enum CashierShiftStatus {
  OPEN = "OPEN",
  HANDOVER_PENDING = "HANDOVER_PENDING",
  CLOSED = "CLOSED",
  RECONCILED = "RECONCILED",
}

export interface IDenominationBreakdown {
  n2000?: number;
  n500?: number;
  n200?: number;
  n100?: number;
  n50?: number;
  n20?: number;
  n10?: number;
  coins?: number;
  total: number;
}

export interface IPaidOut {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  reason: string;
  category: "CASH_DROP" | "PETTY_CASH" | "REFUND" | "EARLY_CHECK_IN" | "WATER_BOTTLE" | "DENTAL_KIT" | "TEA_COFFEE_SHOP" | "KOVAI_KONGU_MESS" | "OTHER";
  recipient?: string;
  authorizedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

/** Items the desk sells to guests (income) — never a paid-out. */
export const COUNTER_SALE_CATEGORIES = ["EARLY_CHECK_IN", "WATER_BOTTLE", "DENTAL_KIT", "TEA_COFFEE_SHOP", "KOVAI_KONGU_MESS", "OTHER"] as const;
export type CounterSaleCategory = (typeof COUNTER_SALE_CATEGORIES)[number];

export interface ICounterSale {
  _id?: mongoose.Types.ObjectId;
  category: CounterSaleCategory;
  description: string;
  quantity: number;
  amount: number;          // total collected for this sale
  mode: "CASH" | "UPI" | "CARD";
  reference?: string;      // UTR / card approval code
  roomNumber?: string;
  recordedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface ICashierShift extends Document {
  propertyId: mongoose.Types.ObjectId;
  shiftNumber: string;
  drawerId: string;
  cashier: mongoose.Types.ObjectId;
  businessDate: Date;
  openedAt: Date;
  closedAt?: Date;

  // Opening
  openingFloat: number;
  openingDenominations?: IDenominationBreakdown;

  // Cash In & Out
  cashCollected: number;
  cashAdvances: number;
  cashRefunds: number;
  paidOuts: IPaidOut[];
  totalPaidOut: number;
  counterSales: ICounterSale[];
  totalCounterSales: number;

  // Expected vs Counted
  expectedCash: number;
  expectedUpi: number;
  expectedCard: number;
  expectedGateway: number;
  expectedOther: number;

  actualCashCounted?: number;
  closingDenominations?: IDenominationBreakdown;
  varianceAcceptanceRequired?: boolean;
  cashVariance?: number;
  varianceReason?: string;

  // Handover
  handoverToCashier?: mongoose.Types.ObjectId;
  handoverInitiatedAt?: Date;
  handoverCompletedAt?: Date;
  handoverNotes?: string;

  // Supervisor Approval
  supervisorApproval?: {
    approvedBy: mongoose.Types.ObjectId;
    approvedAt: Date;
    notes?: string;
  };

  notes?: string;
  status: CashierShiftStatus;
  createdAt: Date;
  updatedAt: Date;
}

const DenominationSchema = new Schema<IDenominationBreakdown>(
  {
    n2000: { type: Number, default: 0, min: 0 },
    n500: { type: Number, default: 0, min: 0 },
    n200: { type: Number, default: 0, min: 0 },
    n100: { type: Number, default: 0, min: 0 },
    n50: { type: Number, default: 0, min: 0 },
    n20: { type: Number, default: 0, min: 0 },
    n10: { type: Number, default: 0, min: 0 },
    coins: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CounterSaleSchema = new Schema<ICounterSale>(
  {
    category: { type: String, enum: COUNTER_SALE_CATEGORIES as unknown as string[], required: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ["CASH", "UPI", "CARD"], required: true },
    reference: { type: String, trim: true },
    roomNumber: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const PaidOutSchema = new Schema<IPaidOut>(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["CASH_DROP", "PETTY_CASH", "REFUND", "EARLY_CHECK_IN", "WATER_BOTTLE", "DENTAL_KIT", "TEA_COFFEE_SHOP", "KOVAI_KONGU_MESS", "OTHER"],
      default: "PETTY_CASH",
    },
    recipient: { type: String, trim: true },
    authorizedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const CashierShiftSchema = new Schema<ICashierShift>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    shiftNumber: { type: String, required: true, unique: true },
    drawerId: { type: String, required: true, trim: true, default: "DRAWER-01" },
    cashier: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessDate: { type: Date, required: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },

    // Opening
    openingFloat: { type: Number, required: true, min: 0 },
    openingDenominations: { type: DenominationSchema },

    // Cash Ledger
    cashCollected: { type: Number, default: 0 },
    cashAdvances: { type: Number, default: 0 },
    cashRefunds: { type: Number, default: 0 },
    paidOuts: { type: [PaidOutSchema], default: [] },
    totalPaidOut: { type: Number, default: 0 },
    counterSales: { type: [CounterSaleSchema], default: [] },
    totalCounterSales: { type: Number, default: 0 },

    // Expected Drawer & Digital Totals
    expectedCash: { type: Number, default: 0 },
    expectedUpi: { type: Number, default: 0 },
    expectedCard: { type: Number, default: 0 },
    expectedGateway: { type: Number, default: 0 },
    expectedOther: { type: Number, default: 0 },

    // Closing
    actualCashCounted: { type: Number },
    closingDenominations: { type: DenominationSchema },
    cashVariance: { type: Number },
    varianceReason: { type: String, trim: true },
    varianceAcceptanceRequired: { type: Boolean, default: false },

    // Handover
    handoverToCashier: { type: Schema.Types.ObjectId, ref: "User" },
    handoverInitiatedAt: { type: Date },
    handoverCompletedAt: { type: Date },
    handoverNotes: { type: String, trim: true },

    // Supervisor Approval for Variances
    supervisorApproval: {
      approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
      approvedAt: { type: Date },
      notes: { type: String, trim: true },
    },

    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(CashierShiftStatus),
      default: CashierShiftStatus.OPEN,
    },
  },
  { timestamps: true }
);

// Indexes for fast lookup & concurrency control
CashierShiftSchema.index({ propertyId: 1, status: 1 });
CashierShiftSchema.index({ propertyId: 1, drawerId: 1, status: 1 });
// One active (OPEN or HANDOVER_PENDING) shift per drawer and per cashier, enforced by the database.
const ACTIVE = { status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] } };
CashierShiftSchema.index({ propertyId: 1, drawerId: 1 }, { unique: true, partialFilterExpression: ACTIVE, name: "one_active_shift_per_drawer" });
CashierShiftSchema.index({ cashier: 1 }, { unique: true, partialFilterExpression: ACTIVE, name: "one_active_shift_per_cashier" });
CashierShiftSchema.index({ cashier: 1, status: 1 });
CashierShiftSchema.index({ businessDate: 1, propertyId: 1 });

export const CashierShift =
  (mongoose.models.CashierShift as mongoose.Model<ICashierShift>) ||
  mongoose.model<ICashierShift>("CashierShift", CashierShiftSchema);
