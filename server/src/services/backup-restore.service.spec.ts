import mongoose from "mongoose";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { runBackup, runRestore, LiveDatabaseRestoreRefusedError } from "./backup-restore.service";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";
let tmpDir: string;
let restoreConn: mongoose.Connection | null = null;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-restore-spec-"));
});

afterEach(async () => {
  if (restoreConn) {
    await restoreConn.dropDatabase();
    await restoreConn.close();
    restoreConn = null;
  }
});

afterAll(async () => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  await Booking.deleteMany({ bookingReference: /^BR-/ });
  await mongoose.connection.close();
});

async function seedBooking() {
  const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
  return Booking.create({
    bookingReference: `BR-${stamp}`,
    guestDetails: { firstName: "Backup", lastName: "Restore", email: `br-${stamp}@test.local`, phone: "9999999999" },
    roomCategory: new mongoose.Types.ObjectId(),
    checkInDate: new Date(Date.now() + 86400000),
    checkOutDate: new Date(Date.now() + 2 * 86400000),
    adults: 2,
    children: 1,
    totalAmount: 4321,
    taxAmount: 659,
    status: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
  });
}

describe("backup-restore.service", () => {
  it("backs up and restores a real document into an isolated database with exact field/type fidelity", async () => {
    const original = await seedBooking();

    const db = mongoose.connection.db!;
    const { outDir, manifest } = await runBackup(db, tmpDir);

    const bookingManifestEntry = manifest.collections.find((c) => c.name === "bookings");
    expect(bookingManifestEntry).toBeDefined();
    expect(bookingManifestEntry!.count).toBeGreaterThanOrEqual(1);

    restoreConn = await mongoose.createConnection(`${TEST_DB_URI}_restore_verify`).asPromise();
    const restoreDb = restoreConn.db!;
    const results = await runRestore(restoreDb, outDir, { liveDbName: "some_other_live_db" });

    const bookingResult = results.find((r) => r.name === "bookings");
    expect(bookingResult?.restored).toBe(bookingResult?.expected);

    const restoredDoc = await restoreDb
      .collection("bookings")
      .findOne({ bookingReference: original.bookingReference });
    expect(restoredDoc).not.toBeNull();
    expect(restoredDoc!._id.constructor.name).toBe("ObjectId");
    expect(restoredDoc!._id.toString()).toBe(original._id.toString());
    expect(restoredDoc!.createdAt).toBeInstanceOf(Date);
    expect(restoredDoc!.totalAmount).toBe(4321);
    expect(restoredDoc!.status).toBe(BookingStatus.CONFIRMED);
  });

  it("refuses to restore into a database matching the live MONGODB_URI, unless force is set", async () => {
    await seedBooking();
    const db = mongoose.connection.db!;
    const { outDir } = await runBackup(db, tmpDir);

    restoreConn = await mongoose.createConnection(`${TEST_DB_URI}_restore_verify`).asPromise();
    const restoreDb = restoreConn.db!;

    await expect(runRestore(restoreDb, outDir, { liveDbName: restoreDb.databaseName })).rejects.toBeInstanceOf(
      LiveDatabaseRestoreRefusedError
    );

    // force:true overrides the refusal.
    const results = await runRestore(restoreDb, outDir, { liveDbName: restoreDb.databaseName, force: true });
    expect(results.length).toBeGreaterThan(0);
  });
});
