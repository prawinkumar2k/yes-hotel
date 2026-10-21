import { useRef } from "react";
import { Camera, FileCheck2, X } from "lucide-react";
import { imageFileToDataUrl } from "@/lib/imageFile";

/**
 * The guest details a walk-in registration collects, asked again at check-in of a reserved booking
 * (advance reservation, website or phone booking): identity, ID documents, address and the registration-card extras.
 */
export type CheckInKyc = {
  idType: string; idNumber: string; idProofImages: string[];
  nationality: string; address: string; dateOfBirth: string; gender: string; email: string; emergencyPhone: string;
  organization: string; designation: string; purposeOfVisit: string; proceedingTo: string; vehicleNumber: string; gstin: string;
  isForeign: boolean;
  passportNumber: string; passportIssuePlace: string; passportIssueDate: string; passportExpiryDate: string;
  visaNumber: string; visaDate: string; visaExpiryDate: string; visaIssuePlace: string;
};

const ID_TYPES = [["AADHAAR", "Aadhaar Card"], ["PASSPORT", "Passport"], ["DRIVING_LICENSE", "Driving Licence"], ["VOTER_ID", "Voter ID"], ["OTHER", "Other Govt ID"]];
const normaliseIdType = (t?: string) => {
  const v = String(t ?? "").toUpperCase();
  if (v.includes("AAD")) return "AADHAAR";
  if (v.includes("PASS")) return "PASSPORT";
  if (v.includes("DRIV") || v === "DL") return "DRIVING_LICENSE";
  if (v.includes("VOTER") || v.includes("ECI")) return "VOTER_ID";
  return v ? "OTHER" : "AADHAAR";
};
const realEmail = (e?: string) => (e && !/@yes-?hotels\.local$/i.test(e) ? e : "");
const day = (d?: string) => (d ? String(d).slice(0, 10) : "");

/** Starting values: whatever the booking already has (nothing typed twice). */
export function kycFromBooking(booking: any): CheckInKyc {
  const g = booking?.guestDetails ?? {};
  const f = booking?.foreignGuestDetails ?? {};
  return {
    idType: normaliseIdType(g.idType), idNumber: g.idNumber ?? "", idProofImages: [],
    nationality: g.nationality || "Indian", address: g.address ?? "", dateOfBirth: day(g.dateOfBirth), gender: g.gender ?? "",
    email: realEmail(g.email), emergencyPhone: g.emergencyPhone ?? "",
    organization: g.organization ?? "", designation: g.designation ?? "", purposeOfVisit: g.purposeOfVisit ?? "", proceedingTo: g.proceedingTo ?? "",
    vehicleNumber: g.vehicleNumber ?? "", gstin: g.gstin ?? "",
    isForeign: !!f.passportNumber,
    passportNumber: f.passportNumber ?? "", passportIssuePlace: f.passportIssuePlace ?? "", passportIssueDate: day(f.passportIssueDate), passportExpiryDate: day(f.passportExpiryDate),
    visaNumber: f.visaNumber ?? "", visaDate: day(f.visaDate), visaExpiryDate: day(f.visaExpiryDate), visaIssuePlace: f.visaIssuePlace ?? "",
  };
}

/** What the check-in request carries (empty values are left out; the server never blanks existing details). */
export function kycPayload(k: CheckInKyc) {
  const { isForeign, idProofImages, passportNumber, passportIssuePlace, passportIssueDate, passportExpiryDate, visaNumber, visaDate, visaExpiryDate, visaIssuePlace, ...rest } = k;
  return {
    ...rest,
    idProofImages: idProofImages.length ? idProofImages : undefined,
    foreignGuestDetails: isForeign ? { passportNumber, passportIssuePlace, passportIssueDate, passportExpiryDate, visaNumber, visaDate, visaExpiryDate, visaIssuePlace } : undefined,
  };
}

export const kycReady = (k: CheckInKyc) => k.idType.trim() !== "" && k.idNumber.trim().length >= 4;

const inp = "w-full bg-gray-50 border border-gray-300 text-sm text-gray-800 rounded-lg px-2.5 py-2 focus:border-[#c9a227] outline-none";
const lbl = "block text-xs font-semibold text-gray-600 mb-1";

export default function CheckInKycForm({ value, onChange, existingDocuments = 0 }: { value: CheckInKyc; onChange: (v: CheckInKyc) => void; existingDocuments?: number }) {
  const file = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<CheckInKyc>) => onChange({ ...value, ...patch });
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const imgs = await Promise.all(Array.from(files).slice(0, 4).map((f) => imageFileToDataUrl(f, 1600).catch(() => "")));
    set({ idProofImages: [...value.idProofImages, ...imgs.filter(Boolean)].slice(0, 6) });
    if (file.current) file.current.value = "";
  };
  const t = (k: keyof CheckInKyc, label: string, extra: Record<string, unknown> = {}) => (
    <div><label className={lbl}>{label}</label><input className={inp} value={String(value[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as any)} {...extra} /></div>
  );
  return (
    <div className="space-y-4">
      <section className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/60">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Identity (required)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={lbl}>ID type *</label>
            <select className={inp} value={value.idType} onChange={(e) => set({ idType: e.target.value })}>{ID_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          {t("idNumber", "ID number *", { placeholder: "e.g. 1234 5678 9012" })}
        </div>
        <div>
          <label className={lbl}>ID proof photos / documents{existingDocuments ? ` (${existingDocuments} already on file)` : ""}</label>
          <input ref={file} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => add(e.target.files)} />
          <button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-bold hover:bg-gray-50"><Camera size={14} /> Take / upload photo</button>
          {value.idProofImages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {value.idProofImages.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`ID document ${i + 1}`} className="h-16 w-24 object-cover rounded border border-gray-300" />
                  <button type="button" aria-label="Remove" onClick={() => set({ idProofImages: value.idProofImages.filter((_, j) => j !== i) })} className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full p-0.5"><X size={11} /></button>
                </div>
              ))}
              <span className="self-center text-[11px] text-emerald-700 font-semibold flex items-center gap-1"><FileCheck2 size={13} /> {value.idProofImages.length} ready</span>
            </div>
          )}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">{t("address", "Address")}</div>
        {t("nationality", "Nationality")}
        {t("dateOfBirth", "Date of birth", { type: "date" })}
        <div><label className={lbl}>Gender</label>
          <select className={inp} value={value.gender} onChange={(e) => set({ gender: e.target.value })}><option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>
        {t("email", "Email (optional)", { type: "email" })}
        {t("emergencyPhone", "Emergency phone")}
        {t("vehicleNumber", "Vehicle reg. no.")}
        {t("organization", "Company / organization")}
        {t("designation", "Designation")}
        {t("purposeOfVisit", "Purpose of visit")}
        {t("proceedingTo", "Proceeding to")}
        {t("gstin", "Company GSTIN", { maxLength: 15 })}
      </section>

      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <input type="checkbox" checked={value.isForeign} onChange={(e) => set({ isForeign: e.target.checked })} className="accent-[#c9a227]" /> Foreign guest (passport and visa details)
      </label>
      {value.isForeign && (
        <section className="grid sm:grid-cols-2 gap-3 border border-gray-200 rounded-xl p-3 bg-gray-50/60">
          {t("passportNumber", "Passport no.")}
          {t("passportIssuePlace", "Place of issue")}
          {t("passportIssueDate", "Date of issue", { type: "date" })}
          {t("passportExpiryDate", "Date of expiry", { type: "date" })}
          {t("visaNumber", "Visa no.")}
          {t("visaIssuePlace", "Visa place of issue")}
          {t("visaDate", "Visa date", { type: "date" })}
          {t("visaExpiryDate", "Visa expiry", { type: "date" })}
        </section>
      )}
    </div>
  );
}
