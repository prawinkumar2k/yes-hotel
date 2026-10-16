import { format } from "date-fns";

type Extension = { fromCheckOut: string | Date; toCheckOut: string | Date; nights: number; at?: string | Date };

/**
 * "Stay extended" line for the registration card and invoice: the original check-out, each
 * extension (new check-out, extra nights, when it was done). Renders nothing for a stay that was
 * never extended.
 */
export default function StayExtensionNote({ booking, className = "" }: { booking: any; className?: string }) {
  const ext: Extension[] = Array.isArray(booking?.stayExtensions) ? booking.stayExtensions : [];
  if (!ext.length) return null;
  const d = (v: string | Date) => format(new Date(v), "dd-MMM-yy");
  const totalNights = ext.reduce((t, e) => t + (Number(e.nights) || 0), 0);
  return (
    <div className={`text-[11px] leading-snug ${className}`}>
      <span className="font-bold">Stay extended:</span> original departure {d(ext[0].fromCheckOut)} → now {d(ext[ext.length - 1].toCheckOut)} (+{totalNights} night{totalNights === 1 ? "" : "s"})
      {ext.length > 1 || ext[0].at ? (
        <span>
          {" · "}
          {ext.map((e, i) => `${i ? "; " : ""}${d(e.fromCheckOut)} → ${d(e.toCheckOut)}${e.at ? ` (on ${d(e.at)})` : ""}`).join("")}
        </span>
      ) : null}
    </div>
  );
}
