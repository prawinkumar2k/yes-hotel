import { installUnscopedWriteGuard } from "./mongoose-safety";

// The original incident this guard exists for happened in a TEST cleanup
// step, not production runtime code — so the guard must be active here too,
// not only inside createServer(), which test files never call.
installUnscopedWriteGuard();

// Production invariant: property-scoped documents (users, bookings, guests,
// restaurant orders) get the only active property when none is given (see
// models/plugins/propertyScoped.ts). Mirror a single-property install in the
// test DB so fixtures that omit propertyId behave as they would in production.
import { beforeAll } from "vitest";
import mongoose from "mongoose";

export const TEST_PROPERTY_CODE = "TEST-PROPERTY";

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  // A separate short-lived connection, so the default mongoose connection each spec manages is untouched.
  const conn = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 3000 });
  try {
    await conn.asPromise();
    await conn.db!.collection("properties").updateOne(
      { code: TEST_PROPERTY_CODE },
      { $setOnInsert: { code: TEST_PROPERTY_CODE, name: "Test Property", isActive: true, createdAt: new Date() } },
      { upsert: true },
    );
  } catch {
    // No reachable test DB: DB-backed specs fail on their own with a clearer error.
  } finally {
    await conn.close().catch(() => {});
  }
});
