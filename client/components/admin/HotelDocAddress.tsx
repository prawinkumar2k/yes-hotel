import { hotelContactFrom, useHotelSettings } from "@/hooks/usePublicData";

/**
 * The hotel's name, address, phone, email, website and GSTIN on printed documents (invoice,
 * receipts, registration card) — from Admin → Settings, never typed into the page.
 * Without a GSTIN in Settings a warning shows on screen (not on the printout).
 */
export default function HotelDocAddress({ withEmailAndWeb = true }: { withEmailAndWeb?: boolean }) {
  const { data: settings, isLoading } = useHotelSettings();
  const c = hotelContactFrom(settings);
  const gstin = String((settings as any)?.gstNumber || "").trim();
  return (
    <>
      <p className="font-bold text-sm uppercase">{c.name}</p>
      <p>{c.address}</p>
      <p>Phone : {c.phone}</p>
      {withEmailAndWeb && c.email && <p>Email : {c.email}</p>}
      {withEmailAndWeb && <p>Web : www.yeshotels.in</p>}
      <p>GSTIN : {gstin || "—"}</p>
      {!isLoading && !gstin && (
        <p className="print:hidden mt-1 font-bold text-red-600">GSTIN not set — add it in Admin → Settings before issuing tax invoices.</p>
      )}
    </>
  );
}
