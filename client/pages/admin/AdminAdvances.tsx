import React, { useState, useEffect } from "react";
import {
  CreditCard, Plus, RefreshCw, Filter, X, DollarSign, ArrowUpRight,
  Receipt, FileText, CheckCircle2, ShieldCheck, Printer, Search, ArrowDownLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";

interface AdvanceItem {
  _id: string;
  advanceNumber: string;
  guest?: { _id: string; fullName: string; email: string; phone: string };
  amount: number;
  remainingBalance: number;
  totalAdjusted: number;
  status: "RECEIVED" | "PARTIALLY_ADJUSTED" | "FULLY_ADJUSTED" | "REFUNDED" | "VOIDED";
  method: string;
  notes?: string;
  createdAt: string;
}

export default function AdminAdvances() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [advances, setAdvances] = useState<AdvanceItem[]>([]);
  const [activeTab, setActiveTab] = useState<"ALL" | "RECEIVED" | "ADJUSTED" | "REFUNDED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // New Advance Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [notes, setNotes] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Refund Modal
  const [refundAdvance, setRefundAdvance] = useState<AdvanceItem | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Printable Receipt View Modal
  const [printReceipt, setPrintReceipt] = useState<AdvanceItem | null>(null);

  const fetchAdvances = async () => {
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch("/api/advances", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        setAdvances(json.data || []);
      } else {
        toast({ title: "Failed to load advances", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCreate(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch("/api/advances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          guestName,
          guestPhone,
          guestEmail,
          amount: parseFloat(amount),
          method: paymentMethod,
          notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Advance Payment Received", description: `Receipt ${json.data.advanceNumber} issued successfully.` });
        setShowCreateModal(false);
        setGuestName("");
        setGuestPhone("");
        setGuestEmail("");
        setAmount("");
        setNotes("");
        fetchAdvances();
      } else {
        toast({ title: "Failed to issue advance", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleRefundAdvance = async () => {
    if (!refundAdvance) return;
    if (!refundReason.trim()) {
      toast({ title: "Refund reason required", variant: "destructive" });
      return;
    }
    setSubmittingRefund(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/advances/${refundAdvance._id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: refundAdvance.remainingBalance,
          reason: refundReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Advance Refunded", description: `Receipt ${refundAdvance.advanceNumber} refunded.` });
        setRefundAdvance(null);
        setRefundReason("");
        fetchAdvances();
      } else {
        toast({ title: "Refund Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingRefund(false);
    }
  };

  // KPI Calculations
  const totalHeld = advances.reduce((acc, curr) => acc + (curr.remainingBalance || 0), 0);
  const totalIssuedToday = advances
    .filter((a) => new Date(a.createdAt).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalAdjusted = advances.reduce((acc, curr) => acc + (curr.totalAdjusted || 0), 0);
  const totalRefunded = advances
    .filter((a) => a.status === "REFUNDED")
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Filtered List
  const filteredAdvances = advances.filter((adv) => {
    const matchesTab =
      activeTab === "ALL" ||
      (activeTab === "RECEIVED" && adv.status === "RECEIVED") ||
      (activeTab === "ADJUSTED" && (adv.status === "PARTIALLY_ADJUSTED" || adv.status === "FULLY_ADJUSTED")) ||
      (activeTab === "REFUNDED" && adv.status === "REFUNDED");

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      adv.advanceNumber.toLowerCase().includes(q) ||
      (adv.guest?.fullName || "").toLowerCase().includes(q) ||
      (adv.guest?.phone || "").toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RECEIVED":
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Unadjusted Held</span>;
      case "PARTIALLY_ADJUSTED":
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Partially Consumed</span>;
      case "FULLY_ADJUSTED":
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Fully Consumed</span>;
      case "REFUNDED":
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Refunded</span>;
      default:
        return <span className="bg-gray-800 text-gray-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">{status}</span>;
    }
  };

  if (loading && advances.length === 0) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white p-12 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-[#c9a227] text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-400 mt-3 font-mono">Loading Financial Advance Ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#121316] p-6 rounded-2xl border border-[#262930] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
              Advance Payments & Escrow Ledger
              <span className="text-xs bg-[#c9a227]/20 text-[#e5c76b] px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30">FINANCE ENGINE</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Pre-stay guest deposits, receipt generation, automated folio credit adjustments & refund audit control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a227] hover:bg-[#e5c76b] text-black font-bold rounded-xl transition text-xs shadow-md"
          >
            <Plus size={16} /> Issue Advance Receipt
          </button>
          <button
            onClick={fetchAdvances}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1d24] text-gray-300 hover:text-white rounded-xl transition text-xs font-semibold border border-[#262930]"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Financial KPI Fleet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121316] p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <DollarSign size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">Total Escrow Held</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">₹{totalHeld.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Available for Folio Adjustment</p>
        </div>

        <div className="bg-[#121316] p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <ArrowUpRight size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">Received Today</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">₹{totalIssuedToday.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Fresh Pre-Stay Inflow</p>
        </div>

        <div className="bg-[#121316] p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <CheckCircle2 size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">Adjusted to Folios</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">₹{totalAdjusted.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Consumed in Stay Invoices</p>
        </div>

        <div className="bg-[#121316] p-5 rounded-2xl border border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <ArrowDownLeft size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">Total Refunded</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">₹{totalRefunded.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Returned on Cancellations</p>
        </div>
      </div>

      {/* Main Ledger Panel */}
      <div className="bg-[#121316] rounded-2xl border border-[#262930] p-6 shadow-xl space-y-6">
        {/* Navigation Tabs & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-[#262930] pb-4">
          <div className="flex gap-4 overflow-x-auto w-full md:w-auto">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`pb-2 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === "ALL" ? "border-[#c9a227] text-[#c9a227]" : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              All Receipts ({advances.length})
            </button>
            <button
              onClick={() => setActiveTab("RECEIVED")}
              className={`pb-2 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === "RECEIVED" ? "border-emerald-500 text-emerald-400" : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Unadjusted Held
            </button>
            <button
              onClick={() => setActiveTab("ADJUSTED")}
              className={`pb-2 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === "ADJUSTED" ? "border-purple-500 text-purple-400" : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Adjusted to Folio
            </button>
            <button
              onClick={() => setActiveTab("REFUNDED")}
              className={`pb-2 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === "REFUNDED" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Refunded Deposits
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search receipt # or guest name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white placeholder-gray-500 pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-[#c9a227]"
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#1a1d24] text-gray-400 text-xs uppercase font-mono border-b border-[#262930]">
              <tr>
                <th className="p-3.5 rounded-l-xl">Receipt # & Date</th>
                <th className="p-3.5">Guest & Contact</th>
                <th className="p-3.5">Initial Amount</th>
                <th className="p-3.5">Remaining Escrow</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5">Escrow Status</th>
                <th className="p-3.5 text-right rounded-r-xl">Receipt Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262930]/60 text-gray-200">
              {filteredAdvances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    No advance payment receipts found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredAdvances.map((adv) => (
                  <tr key={adv._id} className="hover:bg-[#1a1d24]/80 transition">
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-[#c9a227]">{adv.advanceNumber}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {new Date(adv.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-white">{adv.guest?.fullName || "Guest"}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{adv.guest?.phone || "No phone"}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-white">₹{adv.amount.toLocaleString()}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      ₹{adv.remainingBalance.toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-xs bg-[#1a1d24] px-2 py-1 rounded border border-[#262930]">
                        {adv.method}
                      </span>
                    </td>
                    <td className="p-3.5">{getStatusBadge(adv.status)}</td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setPrintReceipt(adv)}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-[#1a1d24] text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-[#262930] hover:border-[#c9a227]/40 transition"
                      >
                        <Printer size={13} className="text-[#c9a227]" /> Print
                      </button>

                      {adv.remainingBalance > 0 && adv.status !== "REFUNDED" && (
                        <button
                          onClick={() => setRefundAdvance(adv)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg border border-red-500/30 transition"
                        >
                          Issue Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: RECEIVE ADVANCE */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAdvance} className="bg-[#121316] border border-[#262930] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-white">
            <div className="flex justify-between items-center border-b border-[#262930] pb-4">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <CreditCard className="text-[#c9a227]" size={20} /> Receive Pre-Stay Advance Payment
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Guest Full Name *</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Guest Phone *</label>
                <input
                  type="text"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Guest Email *</label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Deposit Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                  className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white font-mono font-bold rounded-xl p-2.5 focus:border-[#c9a227]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                >
                  <option value="UPI">UPI / GPay / QR</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Notes / Booking Reference</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Deposit notes or reservation number"
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                rows={2}
              />
            </div>

            <div className="flex gap-3 border-t border-[#262930] pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCreate}
                className="flex-1 py-2 bg-[#c9a227] hover:bg-[#e5c76b] text-black rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingCreate ? "Issuing..." : "Generate Receipt"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: PRINT RECEIPT */}
      {printReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-[#c9a227]/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-white">
            <div className="flex justify-between items-center border-b border-[#262930] pb-4">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2 text-[#c9a227]">
                <Receipt size={20} /> YES HOTELS Advance Receipt
              </h3>
              <button onClick={() => setPrintReceipt(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="bg-[#1a1d24] p-5 rounded-xl border border-[#262930] space-y-3 font-mono text-xs">
              <div className="text-center font-serif text-base font-bold text-[#c9a227]">YES HOTELS LUXURY SUITES</div>
              <div className="text-center text-[10px] text-gray-400">Official Financial Escrow Deposit Receipt</div>
              <div className="border-b border-[#262930] my-2" />
              <div className="flex justify-between text-gray-400">
                <span>Receipt Number:</span>
                <span className="text-white font-bold">{printReceipt.advanceNumber}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Issued Date:</span>
                <span className="text-white">{new Date(printReceipt.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Guest Name:</span>
                <span className="text-white font-bold">{printReceipt.guest?.fullName}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Payment Mode:</span>
                <span className="text-white">{printReceipt.method}</span>
              </div>
              <div className="border-t border-[#262930] pt-2 flex justify-between font-bold text-sm text-white">
                <span>Amount Received:</span>
                <span className="text-[#c9a227]">₹{printReceipt.amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPrintReceipt(null)}
                className="flex-1 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-[#c9a227] text-black hover:bg-[#e5c76b] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
