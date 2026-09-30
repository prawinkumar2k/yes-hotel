import mongoose from "mongoose";
import dotenv from "dotenv";
import { PaymentChannel, PaymentChannelType } from "../models/PaymentChannel";
import { Payment, PaymentMethod } from "../models/Payment";
import { AdvancePayment, AdvancePaymentMethod } from "../models/AdvancePayment";

dotenv.config({ path: "./server/.env" });

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  console.log(`Starting Payment Channel Migration... ${DRY_RUN ? "[DRY RUN]" : ""}`);
  
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotel");
  console.log("Connected to MongoDB.");

  // 1. Create standard base channels if they don't exist
  const baseChannels = [
    { name: "Cash", code: "CASH_MAIN", type: PaymentChannelType.CASH, settlementMode: "IMMEDIATE" as const },
    { name: "Credit/Debit Card", code: "CARD_MAIN", type: PaymentChannelType.CARD, settlementMode: "T+1" as const },
    { name: "UPI", code: "UPI_MAIN", type: PaymentChannelType.UPI, settlementMode: "IMMEDIATE" as const },
    { name: "Razorpay", code: "RAZORPAY_MAIN", type: PaymentChannelType.GATEWAY, provider: "Razorpay", settlementMode: "T+2" as const },
    { name: "Bank Transfer", code: "BANK_TRANSFER_MAIN", type: PaymentChannelType.BANK_TRANSFER, settlementMode: "T+1" as const },
  ];

  const channelMap = new Map<string, mongoose.Types.ObjectId>();

  for (const bc of baseChannels) {
    let ch = await PaymentChannel.findOne({ code: bc.code });
    if (!ch) {
      if (DRY_RUN) {
        console.log(`[DRY RUN] Would create PaymentChannel: ${bc.code}`);
        channelMap.set(bc.type, new mongoose.Types.ObjectId());
      } else {
        ch = await PaymentChannel.create({ ...bc, displayOrder: baseChannels.indexOf(bc) });
        console.log(`[CREATED] PaymentChannel: ${bc.code}`);
        channelMap.set(bc.type, ch._id as mongoose.Types.ObjectId);
      }
    } else {
      channelMap.set(bc.type, ch._id as mongoose.Types.ObjectId);
    }
  }

  // Gateway specific mapping
  const razorpayId = DRY_RUN ? new mongoose.Types.ObjectId() : (await PaymentChannel.findOne({ code: "RAZORPAY_MAIN" }))?._id;
  const bankTransferId = DRY_RUN ? new mongoose.Types.ObjectId() : (await PaymentChannel.findOne({ code: "BANK_TRANSFER_MAIN" }))?._id;

  // 2. Migrate Payments
  const payments = await Payment.find({ paymentChannel: { $exists: false } });
  console.log(`Found ${payments.length} Payments needing migration.`);
  
  let pMigrated = 0;
  for (const p of payments) {
    let targetId;
    if (p.method === PaymentMethod.CASH) targetId = channelMap.get(PaymentChannelType.CASH);
    else if (p.method === PaymentMethod.CARD) targetId = channelMap.get(PaymentChannelType.CARD);
    else if (p.method === PaymentMethod.UPI) targetId = channelMap.get(PaymentChannelType.UPI);
    else if (p.method === PaymentMethod.RAZORPAY) targetId = razorpayId;
    
    if (targetId) {
      if (!DRY_RUN) {
        p.paymentChannel = targetId;
        await p.save();
      }
      pMigrated++;
    } else {
      console.log(`[WARNING] Unmapped Payment method: ${p.method} on ${p._id}`);
    }
  }

  // 3. Migrate AdvancePayments
  const advances = await AdvancePayment.find({ paymentChannel: { $exists: false } });
  console.log(`Found ${advances.length} AdvancePayments needing migration.`);
  
  let aMigrated = 0;
  for (const a of advances) {
    let targetId;
    if (a.method === AdvancePaymentMethod.CASH) targetId = channelMap.get(PaymentChannelType.CASH);
    else if (a.method === AdvancePaymentMethod.CARD) targetId = channelMap.get(PaymentChannelType.CARD);
    else if (a.method === AdvancePaymentMethod.UPI) targetId = channelMap.get(PaymentChannelType.UPI);
    else if (a.method === AdvancePaymentMethod.BANK_TRANSFER) targetId = bankTransferId;
    else if (a.method === "RAZORPAY" as any) targetId = razorpayId; // Safety check
    
    if (targetId) {
      if (!DRY_RUN) {
        a.paymentChannel = targetId;
        await a.save();
      }
      aMigrated++;
    } else {
      console.log(`[WARNING] Unmapped AdvancePayment method: ${a.method} on ${a._id}`);
    }
  }

  console.log(`Migration Complete.`);
  console.log(`- Payments updated: ${pMigrated}/${payments.length}`);
  console.log(`- AdvancePayments updated: ${aMigrated}/${advances.length}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
