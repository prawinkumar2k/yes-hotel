import { format } from "date-fns";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { useAuth } from "@/context/AuthContext";

/**
 * The top of every report, in the same formal style as the registration card and the GST invoice:
 * a bordered sheet with the logo on the left, the hotel's name, address, phone and GSTIN on the right,
 * then a title bar with the report name and period, and who printed it and when. Shown on screen and on paper.
 */
export default function ReportPrintHeader({ title, period }: { title: string; period?: string }) {
  const { user } = useAuth() as any;
  const by = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : "";
  return (
    <div className="mb-3 border border-black bg-white text-black break-inside-avoid">
      <div className="flex">
        <div className="w-[34%] border-r border-black p-3 flex flex-col items-center justify-center">
          <img src="/brand/yes-hotels-logo-sm.png" alt="" className="h-14 w-auto" />
          <div className="mt-1 font-serif italic font-black text-xl leading-none tracking-wide">YES HOTELS</div>
        </div>
        <div className="flex-1 p-3 text-right text-[10px] leading-snug">
          <HotelDocAddress />
        </div>
      </div>
      <div className="border-t border-black bg-gray-100 print:bg-gray-100 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold uppercase tracking-wide text-sm">{title}</span>
        {period && <span className="text-xs font-semibold">{period}</span>}
      </div>
      <div className="border-t border-black px-3 py-1 text-[10px] text-gray-700 flex flex-wrap justify-between gap-2">
        <span>Printed {format(new Date(), "dd-MMM-yyyy HH:mm")}{by ? ` by ${by}` : ""}</span>
        <span className="uppercase tracking-wide">Accounts copy</span>
      </div>
    </div>
  );
}

/** The bottom of a report, like the invoice: signature lines and E.&O.E. */
export function ReportSignOff() {
  return (
    <div className="mt-4 border border-black bg-white text-black break-inside-avoid">
      <div className="grid grid-cols-3 gap-6 px-6 pt-10 pb-2 text-center text-[10px] font-bold uppercase">
        <div className="border-t border-black pt-1">Prepared by</div>
        <div className="border-t border-black pt-1">Front Office Manager</div>
        <div className="border-t border-black pt-1">Authorised signatory</div>
      </div>
      <div className="px-3 pb-1.5 text-right text-[9px] text-gray-600">E.&amp;O.E.</div>
    </div>
  );
}
