import React, { useState, useEffect } from "react";
import { CreditCard, Plus, RefreshCw, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

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
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

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

  const fetchAdvances = async () => {
    setLoading(true);
    try {
      const url = filterStatus !== "ALL" ? `/advances?status=${filterStatus}` : "/advances";
      const res = await api.get(url);
      if (res.data.success) {
        setAdvances(res.data.data || []);
      } else {
        toast({ title: "Failed to load advances", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, [filterStatus]);

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCreate(true);
    try {
      const res = await api.post("/advances", {
        guestName,
        guestPhone,
        guestEmail,
        amount: parseFloat(amount),
        method: paymentMethod,
        notes,
      });
      if (res.data.success) {
        toast({ title: "Advance Payment Received", description: `Receipt ${res.data.data.advanceNumber} issued.` });
        setShowCreateModal(false);
        setGuestName("");
        setGuestPhone("");
        setGuestEmail("");
        setAmount("");
        setNotes("");
        fetchAdvances();
      } else {
        toast({ title: "Failed to issue advance", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
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
      const res = await api.post(`/advances/${refundAdvance._id}/refund`, {
        amount: refundAdvance.remainingBalance,
        reason: refundReason,
      });
      if (res.data.success) {
        toast({ title: "Advance Refunded", description: `${refundAdvance.advanceNumber} refunded` });
        setRefundAdvance(null);
        setRefundReason("");
        fetchAdvances();
      } else {
        toast({ title: "Refund Failed", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setSubmittingRefund(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RECEIVED":
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Received (Unadjusted)</span>;
      case "PARTIALLY_ADJUSTED":
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Partially Adjusted</span>;
      case "FULLY_ADJUSTED":
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Fully Adjusted</span>;
      case "REFUNDED":
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Refunded</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded-full font-bold">{status}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="text-hotel-gold" /> Advance Payments Ledger
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pre-stay cash / bank deposits, receipt issuance, and automated folio adjustment tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-hotel-gold hover:bg-amber-600 text-white rounded-lg transition text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> Receive Advance Payment
          </button>
          <button
            onClick={fetchAdvances}
            className="flex items-center gap-2 px-4 py-2 bg-hotel-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
          <Filter size={14} /> Filter Status:
        </span>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-hotel-gold outline-none"
        >
          <option value="ALL">All Advances</option>
          <option value="RECEIVED">Received (Available to adjust)</option>
          <option value="PARTIALLY_ADJUSTED">Partially Adjusted</option>
          <option value="FULLY_ADJUSTED">Fully Adjusted</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <span className="ml-auto text-xs font-semibold text-gray-500">Total Receipts: {advances.length}</span>
      </div>

      {/* Advance List Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading advance payment records...</div>
        ) : advances.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No advance payment receipts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3.5">Receipt #</th>
                  <th className="p-3.5">Guest Name</th>
                  <th className="p-3.5">Phone / Contact</th>
                  <th className="p-3.5">Initial Deposit</th>
                  <th className="p-3.5">Remaining Balance</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {advances.map((adv) => (
                  <tr key={adv._id} className="hover:bg-gray-50/80">
                    <td className="p-3.5 font-mono font-bold text-gray-900">{adv.advanceNumber}</td>
                    <td className="p-3.5 font-medium text-gray-900">{adv.guest?.fullName || "—"}</td>
                    <td className="p-3.5 text-gray-600">{adv.guest?.phone || "—"}</td>
                    <td className="p-3.5 font-semibold text-gray-900">₹{adv.amount}</td>
                    <td className="p-3.5 font-bold text-emerald-700">₹{adv.remainingBalance}</td>
                    <td className="p-3.5 font-mono text-gray-600">{adv.method}</td>
                    <td className="p-3.5">{getStatusBadge(adv.status)}</td>
                    <td className="p-3.5 text-right">
                      {adv.remainingBalance > 0 && adv.status !== "REFUNDED" && (
                        <button
                          onClick={() => setRefundAdvance(adv)}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded"
                        >
                          Issue Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Receive Advance */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAdvance} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <CreditCard className="text-hotel-gold" /> Receive Pre-Stay Advance Deposit
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Guest Full Name *</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g., Rajesh Kumar"
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Guest Phone *</label>
                <input
                  type="text"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Guest Email *</label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Advance Deposit (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 10000"
                  className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CASH">Cash Deposit</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Booking Reference</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Advance deposit for upcoming corporate reservation"
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 border rounded text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCreate}
                className="flex-1 py-2 bg-hotel-gold hover:bg-amber-600 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50"
              >
                {submittingCreate ? "Issuing..." : "Issue Advance Receipt"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Refund Advance */}
      {refundAdvance && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-900 text-base">Refund Advance Receipt #{refundAdvance.advanceNumber}</h3>
              <button onClick={() => setRefundAdvance(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Refunding remaining deposit of <strong className="text-gray-900">₹{refundAdvance.remainingBalance}</strong> to guest{" "}
              <strong>{refundAdvance.guest?.fullName || "—"}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Refund Reason *</label>
              <input
                type="text"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g., Reservation cancellation per policy"
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setRefundAdvance(null)}
                className="flex-1 py-2 border rounded text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundAdvance}
                disabled={submittingRefund}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold disabled:opacity-50"
              >
                {submittingRefund ? "Processing..." : "Process Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
