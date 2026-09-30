import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import Navbar from "@/components/hotel/Navbar";
import Footer from "@/components/hotel/Footer";
import { ArrowLeft, FileText } from "lucide-react";
import { format } from "date-fns";

async function apiFetch(url: string, token?: string) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  return res.json();
}

export default function CustomerFolio() {
  const { id } = useParams();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["folio", id],
    queryFn: () => apiFetch(`/api/folios/booking/${id}`, user?.token),
    enabled: !!user && !!id,
  });

  const folioData = data?.data;
  const folio = folioData?.folio;
  const lines = folioData?.lines || [];

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to={`/customer/bookings/${id}`} className="flex items-center gap-2 text-sm text-hotel-black/60 hover:text-hotel-black mb-8 transition-colors">
          <ArrowLeft size={16} /> Back to Booking Details
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-hotel-black mb-2">Stay Folio</h1>
            <p className="text-hotel-black/60 font-mono">Ledger details for your stay</p>
          </div>
          {folio && (
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded text-xs font-semibold tracking-wider ${folio.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                {folio.status}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-hotel-black/5" />
            <div className="h-64 bg-hotel-black/5" />
          </div>
        ) : error || !data?.success ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-12 text-center">
            <FileText size={40} className="mx-auto text-hotel-black/20 mb-4" />
            <p className="text-hotel-black/50">Folio not available.</p>
            <p className="text-sm text-hotel-black/40 mt-2">Folios are generated upon check-in.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-hotel-white p-6 border border-hotel-black/10 flex flex-wrap gap-8 justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Total Charges</p>
                <p className="font-serif text-xl">₹{(folio.totalCharges || 0).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Total Taxes</p>
                <p className="font-serif text-xl">₹{(folio.totalTax || 0).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Advance / Adjusted</p>
                <p className="font-serif text-xl text-amber-700">₹{(folio.totalAdvanceAdjusted || 0).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Total Paid</p>
                <p className="font-serif text-xl text-green-700">₹{(folio.totalPaid || 0).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Balance Due</p>
                <p className={`font-serif text-xl ${folio.balance > 0 ? "text-red-600" : "text-green-700"}`}>
                  ₹{(folio.balance || 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="bg-hotel-white border border-hotel-black/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-hotel-black/5 text-hotel-black/70 text-xs uppercase tracking-widest">
                    <tr>
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Type</th>
                      <th className="p-4 font-medium">Description</th>
                      <th className="p-4 font-medium text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hotel-black/5">
                    {lines.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-hotel-black/40">No transactions recorded.</td></tr>
                    ) : (
                      lines.map((l: any) => (
                        <tr key={l._id} className="hover:bg-hotel-black/5 transition-colors">
                          <td className="p-4 text-hotel-black/60 whitespace-nowrap">{format(new Date(l.date), "dd MMM yyyy, HH:mm")}</td>
                          <td className="p-4"><span className="text-xs px-2 py-1 bg-hotel-black/5 rounded">{l.lineType}</span></td>
                          <td className="p-4">{l.description} {l.notes && <span className="block text-xs text-hotel-black/40">{l.notes}</span>}</td>
                          <td className={`p-4 text-right font-medium ${l.isPayment || l.isAdvanceAdjustment ? 'text-green-600' : 'text-hotel-black'}`}>
                            {l.isPayment || l.isAdvanceAdjustment ? '-' : ''}{l.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
