import { useLocation } from "react-router-dom";

/** "Developed by" credit shown on every screen (hidden when printing, so guest documents stay clean). */
export default function DevCredit({ className = "" }: { className?: string }) {
  return (
    <span className={`print:hidden ${className}`}>
      Developed by <strong className="font-semibold">Dealpost Private Limited</strong>
    </span>
  );
}

const OWN_CREDIT = /^\/(admin|housekeeping|cashier|finance|front-desk|maintenance|staff|login|register|forgot-password|reset-password)(\/|$)/;

/** One credit line under every public and customer page (staff screens and sign-in pages carry their own). */
export function GlobalCredit() {
  const { pathname } = useLocation();
  if (OWN_CREDIT.test(pathname)) return null;
  return (
    <div className="print:hidden bg-black text-center text-[11px] text-white/60 py-2 px-4">
      <DevCredit />
    </div>
  );
}
