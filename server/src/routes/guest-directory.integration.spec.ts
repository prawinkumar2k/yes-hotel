/**
 * Guest directory: a guest can be added by hand (no email needed), with ID proofs and other papers kept on the
 * profile; everything is retrievable in one list (with the ID photos taken at stays) and searchable by ID number.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const user = oid();
const phone = `98${String(Date.now()).slice(-8)}`;
const idNumber = `ID${tag}XYZ`;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
let guestId = "";
let docId = "";
const stayId = oid();
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(user), role: "ADMIN" }, getJwtSecret(), { expiresIn: "5m" });

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  await db().collection("users").insertOne({ _id: user, role: "ADMIN", firstName: "Gd", lastName: tag, email: `gd-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
});

afterAll(async () => {
  await db().collection("bookings").deleteMany({ _id: stayId });
  await db().collection("guests").deleteMany({ phone });
  await db().collection("users").deleteMany({ _id: user });
  await new Promise((r) => server.close(r));
});

describe("Guest directory: manual guests and documents", () => {
  it("adds a guest with no email, with an ID number and photos, and rejects a bad document", async () => {
    const bad = await call("POST", "/api/guests", { fullName: "Bad Doc", phone: "9000000099", documents: [{ kind: "ID_FRONT", image: "not-an-image" }] });
    expect(bad.status).toBe(400);

    const r = await call("POST", "/api/guests", {
      fullName: `Manual ${tag}`, phone, email: "", idType: "Aadhaar", idNumber, organization: "Acme", gstin: "29abcde1234f1z5", vehicleNumber: "ka01ab1234",
      documents: [{ kind: "ID_FRONT", image: PNG }, { kind: "ID_BACK", image: PNG }, { kind: "PHOTO", image: PNG }],
    });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    guestId = r.json.data._id;
    expect(r.json.data).toMatchObject({ documentCount: 3, gstin: "29ABCDE1234F1Z5", vehicleNumber: "KA01AB1234" });
    expect(r.json.data.documents).toBeUndefined();
  });

  it("the same phone is never added twice", async () => {
    const r = await call("POST", "/api/guests", { fullName: "Someone Else", phone });
    expect(r.status).toBe(409);
    expect(r.json.existingId).toBe(guestId);
  });

  it("the list shows the document count without the photos, and finds the guest by ID number", async () => {
    const r = await call("GET", `/api/guests?search=${idNumber}`);
    expect(r.status).toBe(200);
    const g = r.json.data.guests.find((x: any) => x._id === guestId);
    expect(g).toMatchObject({ documentCount: 3, email: "", placeholderEmail: true });
    expect(g.documents).toBeUndefined();
  });

  it("the profile returns every proof: the papers added here and the ID photos from stays", async () => {
    await db().collection("bookings").insertOne({
      _id: stayId, bookingReference: `GD-${tag}`, propertyId: P, status: "CHECKED_OUT", checkedInAt: new Date(), checkInDate: new Date(), checkOutDate: new Date(),
      guestDetails: { firstName: "Manual", lastName: tag, phone, idProofImages: [PNG] }, totalAmount: 100, adults: 1, children: 0,
    });
    const r = await call("GET", `/api/guests/${guestId}`);
    expect(r.status).toBe(200);
    const sources = r.json.data.proofs.map((p: any) => p.source).sort();
    expect(sources).toEqual(["DIRECTORY", "DIRECTORY", "DIRECTORY", "STAY"]);
    expect(r.json.data.guest).toMatchObject({ idNumber, idType: "Aadhaar" });
    expect(r.json.data.bookings[0].guestDetails.idProofImages).toBeUndefined();
    docId = r.json.data.proofs.find((p: any) => p.kind === "PHOTO").id;
  });

  it("documents can be added to and removed from a profile, and a real email added later", async () => {
    const add = await call("PATCH", `/api/guests/${guestId}`, { addDocuments: [{ kind: "OTHER", label: "Company letter", image: PNG }], email: `manual-${tag}@example.com`, emergencyPhone: "9111111111" });
    expect(add.status, JSON.stringify(add.json)).toBe(200);
    expect(add.json.data).toMatchObject({ documentCount: 4, email: `manual-${tag}@example.com`, emergencyPhone: "9111111111" });
    const del = await call("PATCH", `/api/guests/${guestId}`, { removeDocumentIds: [docId] });
    expect(del.json.data.documentCount).toBe(3);
  });
});
