import { usePrintLayout } from "@/lib/usePrintLayout";
import { useParams, Link } from "react-router-dom";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { amountInWords } from "@/lib/amount-in-words";

/** Payment receipt, laid out like the GST invoice and advance receipt. */
export default function AdminPaymentReceipt() {
  usePrintLayout("portrait", 8);
  const { id } = useParams();
  const embedded = typeof window !== "undefined" && window.self !== window.top;
  const { data, isLoading } = useQuery({
    queryKey: ["payment-receipt", id],
    queryFn: async () => (await api.get(`/reception/payments/${id}/receipt`)).data.data,
    enabled: !!id,
  });
  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-hotel-gold" size={32} /></div>;
  if (!data?.payment) return <div className="p-8 text-center text-red-600 font-bold">Payment receipt not found.</div>;
  const { payment, booking, balanceAfter } = data;
  const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-3xl mx-auto bg-white print:max-w-none">
      {!embedded && (
        <div className="print:hidden flex justify-between items-center mb-4 bg-gray-100 p-3 rounded-lg border border-gray-300">
          <Link to="/admin/billing" className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black"><ArrowLeft size={14} /> Back to Cashier &amp; Billing</Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-black text-[#e5c76b] rounded-lg text-xs font-bold flex items-center gap-1.5"><Printer size={14} /> PRINT RECEIPT</button>
        </div>
      )}
      <div className="border border-black text-[11px] leading-tight font-medium bg-white">
        <div className="flex border-b border-black">
          <div className="w-1/3 p-2 flex items-center justify-center border-r border-black">
            <img src="/brand/yes-hotels-logo-sm.png" alt="YES HOTELS" className="h-16 w-auto object-contain mb-1 print:h-14" />
            <h1 className="font-serif text-3xl font-black italic tracking-widest uppercase">YES HOTELS</h1>
          </div>
          <div className="w-2/3 p-2 text-right">
            <HotelDocAddress withEmailAndWeb={false} />
          </div>
        </div>
        <div className="text-center border-b border-black py-1 font-bold text-sm bg-gray-100">PAYMENT RECEIPT</div>
        <div className="flex border-b border-black">
          <div className="w-1/2 p-2 border-r border-black grid grid-cols-[95px_1fr] gap-1">
            <div>Receipt No.</div><div className="font-bold">: {payment.transactionId}</div>
            <div>Date</div><div>: {format(new Date(payment.createdAt), "dd-MMM-yy, hh:mm a")}</div>
            <div>Mode</div><div>: {payment.method}{payment.reference ? ` (Ref: ${payment.reference})` : ""}</div>
          </div>
          <div className="w-1/2 p-2 grid grid-cols-[95px_1fr] gap-1">
            <div>Guest</div><div className="font-bold">: MR/MS {String(booking?.guest ?? "—").toUpperCase()}</div>
            <div>Reservation</div><div>: {booking?.bookingReference ?? "—"}</div>
            <div>Room</div><div>: {booking?.room ?? "—"} {booking?.category ? `(${booking.category})` : ""}</div>
            <div>Stay</div><div>: {booking ? `${format(new Date(booking.checkInDate), "dd-MMM-yy")} to ${format(new Date(booking.checkOutDate), "dd-MMM-yy")}` : "—"}</div>
          </div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-2/3 p-2 border-r border-black">
            <div className="text-gray-600">Amount in words</div>
            <div className="font-bold mt-0.5">{amountInWords(payment.amount)}</div>
          </div>
          <div className="w-1/3">
            <div className="flex justify-between p-2 border-b border-black"><span>Amount Received</span><span className="font-bold">{inr(payment.amount)}</span></div>
            <div className="flex justify-between p-2 font-bold"><span>Balance on Bill</span><span>{balanceAfter === null ? "—" : inr(balanceAfter)}</span></div>
          </div>
        </div>
        <div className="flex justify-between items-end p-2 pt-10">
          <div className="text-center"><div className="border-t border-black w-40 pt-1">Guest Signature</div></div>
          <div className="text-center"><div className="border-t border-black w-40 pt-1">Cashier / Front Office</div></div>
        </div>
      </div>
    </div>
  );
}
