import { format } from "date-fns";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { useAuth } from "@/context/AuthContext";

/** The top of every printed report: hotel, report name, the period, and when / by whom it was printed. */
export default function ReportPrintHeader({ title, period }: { title: string; period?: string }) {
  const { user } = useAuth() as any;
  const by = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : "";
  return (
    <div className="hidden print:block mb-3 border-b-2 border-black pb-2">
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <img src="/brand/yes-hotels-logo-sm.png" alt="" className="h-12 w-auto" />
          <div className="text-[9px] leading-tight"><HotelDocAddress withEmailAndWeb={false} /></div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold uppercase tracking-wide">{title}</div>
          {period && <div className="text-[10px]">{period}</div>}
          <div className="text-[9px] text-gray-600">Printed {format(new Date(), "dd-MMM-yyyy HH:mm")}{by ? ` by ${by}` : ""}</div>
        </div>
      </div>
    </div>
  );
}
