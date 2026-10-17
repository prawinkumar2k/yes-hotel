import { format } from "date-fns";

type Extension = { fromCheckOut: string | Date; toCheckOut: string | Date; nights: number; at?: string | Date };
type TimeCharge = { kind: "EARLY_CHECK_IN" | "LATE_CHECK_OUT"; hours: number; fromTime?: string; toTime?: string; amount?: number; at?: string | Date };

/**
 * "Stay extended" line for the registration card and invoice: the original check-out, each
 * extension (new check-out, extra nights, when it was done), and early check-in / late check-out
 * by the hour. Renders nothing for a stay that was never changed.
 */
export default function StayExtensionNote({ booking, className = "" }: { booking: any; className?: string }) {
  const ext: Extension[] = Array.isArray(booking?.stayExtensions) ? booking.stayExtensions : [];
  const timed: TimeCharge[] = Array.isArray(booking?.timeCharges) ? booking.timeCharges : [];
  if (!ext.length && !timed.length) return null;
  const d = (v: string | Date) => format(new Date(v), "dd-MMM-yy");
  const totalNights = ext.reduce((t, e) => t + (Number(e.nights) || 0), 0);
  const hrs = (n: number) => `${n} hour${n === 1 ? "" : "s"}`;
  return (
    <div className={`text-[11px] leading-snug ${className}`}>
      {ext.length > 0 && (
        <div>
          <span className="font-bold">Stay extended:</span> original departure {d(ext[0].fromCheckOut)} → now {d(ext[ext.length - 1].toCheckOut)} (+{totalNights} night{totalNights === 1 ? "" : "s"})
          {ext.length > 1 || ext[0].at ? (
            <span>
              {" · "}
              {ext.map((e, i) => `${i ? "; " : ""}${d(e.fromCheckOut)} → ${d(e.toCheckOut)}${e.at ? ` (on ${d(e.at)})` : ""}`).join("")}
            </span>
          ) : null}
        </div>
      )}
      {timed.map((t, i) => (
        <div key={i}>
          <span className="font-bold">{t.kind === "LATE_CHECK_OUT" ? "Late check-out:" : "Early check-in:"}</span>{" "}
          {t.kind === "LATE_CHECK_OUT" ? `+${hrs(t.hours)}, departure ${t.fromTime ?? ""} → ${t.toTime ?? ""}` : `${hrs(t.hours)} early, arrival ${t.toTime ?? ""} (instead of ${t.fromTime ?? ""})`}
          {t.amount ? ` · ₹${Number(t.amount).toLocaleString("en-IN")}` : " · no charge"}
          {t.at ? ` (on ${d(t.at)})` : ""}
        </div>
      ))}
    </div>
  );
}
