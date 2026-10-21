/**
 * Guest details collected at check-in of a reserved booking (advance reservation, website, phone): the same
 * identity and registration-card details a walk-in registration collects, saved on the booking so the GRC,
 * the bill and the police register show them.
 */
const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 4_000_000; // about 3 MB of photo (the screen scales phone photos down first)

export class CheckInDetailsError extends Error {}

const isImage = (s: unknown): s is string =>
  typeof s === "string" && s.length <= MAX_IMAGE_CHARS && (/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/i.test(s) || /^https:\/\//i.test(s));

/** Copies the supplied details onto booking.guestDetails (blank values never erase what is already there). */
export function applyCheckInDetails(booking: any, body: Record<string, any>) {
  const g = booking.guestDetails;
  const set = (key: string, value: unknown) => { if (value) g[key] = value; };

  set("idType", clean(body.idType, 40));
  set("idNumber", clean(body.idNumber, 60));
  set("nationality", clean(body.nationality, 60));
  set("emergencyPhone", clean(body.emergencyPhone, 30));
  set("address", clean(body.address, 300));
  set("city", clean(body.city, 80));
  set("state", clean(body.state, 80));
  set("country", clean(body.country, 80));
  set("gender", clean(body.gender, 20));
  set("organization", clean(body.organization, 120));
  set("designation", clean(body.designation, 80));
  set("purposeOfVisit", clean(body.purposeOfVisit, 80));
  set("proceedingTo", clean(body.proceedingTo, 120));
  set("vehicleNumber", clean(body.vehicleNumber, 20)?.toUpperCase());
  set("gstin", clean(body.gstin, 15)?.toUpperCase());

  const email = clean(body.email, 160);
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckInDetailsError("Enter a valid email, or leave it empty");
    g.email = email.toLowerCase();
  }
  if (body.dateOfBirth) {
    const d = new Date(String(body.dateOfBirth));
    if (Number.isNaN(d.getTime()) || d > new Date()) throw new CheckInDetailsError("Enter a valid date of birth");
    g.dateOfBirth = d;
  }

  // ID proof documents: the new ones are added to those already on the booking (never silently dropped).
  const incoming: string[] = [
    ...(Array.isArray(body.idProofImages) ? body.idProofImages : []),
    ...(body.idProofPhoto ? [body.idProofPhoto] : []),
  ];
  const bad = incoming.filter((x) => !isImage(x));
  if (bad.length) throw new CheckInDetailsError("An ID document is not a supported image (JPEG, PNG, WebP) or is too large");
  if (incoming.length) {
    const merged = [...new Set([...(g.idProofImages ?? []), ...incoming])];
    if (merged.length > MAX_IMAGES) throw new CheckInDetailsError(`At most ${MAX_IMAGES} ID documents can be kept on one booking`);
    g.idProofImages = merged;
  }

  const f = body.foreignGuestDetails;
  if (f && typeof f === "object") {
    const out: Record<string, unknown> = { ...(booking.foreignGuestDetails?.toObject?.() ?? booking.foreignGuestDetails ?? {}) };
    for (const k of ["passportNumber", "passportIssuePlace", "visaNumber", "visaIssuePlace", "visaIssuedBy"]) if (clean(f[k], 80)) out[k] = clean(f[k], 80);
    for (const k of ["passportIssueDate", "passportExpiryDate", "visaDate", "visaExpiryDate"]) {
      if (f[k]) {
        const d = new Date(String(f[k]));
        if (Number.isNaN(d.getTime())) throw new CheckInDetailsError(`Check the ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        out[k] = d;
      }
    }
    if (Object.keys(out).length) booking.foreignGuestDetails = out;
  }
  booking.markModified("guestDetails");
}

/** A guest cannot be checked in without an ID type and number (on this request or already on the booking). */
export function assertIdentity(booking: any) {
  const g = booking.guestDetails ?? {};
  if (!String(g.idType ?? "").trim() || !String(g.idNumber ?? "").trim()) {
    throw new CheckInDetailsError("Enter the guest's ID type and ID number before check-in");
  }
}
