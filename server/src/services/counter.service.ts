/**
 * Atomic, gapless sequence numbers. The increment runs in the caller's transaction:
 * if the transaction aborts, the increment rolls back with it, so no number is skipped.
 */
import mongoose from "mongoose";

export async function nextSequence(key: string, session?: mongoose.ClientSession): Promise<number> {
  const db = mongoose.connection.db!;
  const doc = await db.collection<{ _id: string; seq: number }>("counters").findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  return (doc as any)?.seq ?? (doc as any)?.value?.seq;
}
