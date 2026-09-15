import React, { useState, useEffect } from "react";
import {
  DollarSign, Plus, RefreshCw, Lock, CheckCircle2, AlertTriangle, Clock,
  ShieldCheck, X, CreditCard, ArrowUpRight, Scale, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getStoredAuthToken } from "@/lib/authStorage";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getStoredAuthToken()}`,
});

interface CashierShiftItem {
  _id: string;
  shiftNumber: string;
  cashier?: { name: string; email: string };
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  expectedCash: number;
  actualCashCounted?: number;
  cashVariance?: number;
  status: "OPEN" | "CLOSED" | "RECONCILED";
  notes?: string;
}

export default function AdminCashierShifts() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentShift, setCurrentShift] = useState<CashierShiftItem | null>(null);
  const [historyShifts, setHistoryShifts] = useState<CashierShiftItem[]>([]);

  // Open Shift Modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [openNotes, setOpenNotes] = useState("");
  const [submittingOpen, setSubmittingOpen] = useState(false);

  // Close Shift Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCounted, setActualCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [submittingClose, setSubmittingClose] = useState(false);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const [curRes, allRes] = await Promise.all([
        fetch("/api/cashier-shifts/current", { headers: getAuthHeaders() }),
        fetch("/api/cashier-shifts", { headers: getAuthHeaders() }),
      ]);

      const curJson = await curRes.json();
      const allJson = await allRes.json();

      if (curJson.success) setCurrentShift(curJson.data);
      if (allJson.success) setHistoryShifts(allJson.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOpen(true);
    try {
      const res = await fetch("/api/cashier-shifts/open", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          openingFloat: parseFloat(openingFloat),
          notes: openNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Shift Opened", description: json.message });
        setShowOpenModal(false);
        setOpeningFloat("");
        setOpenNotes("");
        fetchShifts();
      } else {
        toast({ title: "Failed to open shift", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingOpen(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    setSubmittingClose(true);
    try {
      const res = await fetch(`/api/cashier-shifts/${currentShift._id}/close`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          actualCashCounted: parseFloat(actualCounted),
          notes: closeNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Shift Closed & Reconciled", description: json.message });
        setShowCloseModal(false);
        setActualCounted("");
        setCloseNotes("");
        fetchShifts();
      } else {
        toast({ title: "Failed to close shift", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingClose(false);
    }
  };

  if (loading && historyShifts.length === 0) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white p-12 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-[#c9a227] text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-400 mt-3 font-mono">Loading Cashier Drawer & Shift Audit...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#121316] p-6 rounded-2xl border border-[#262930] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
            <DollarSign size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
              Cashier Shift & Cash Drawer Reconciliation
              <span className="text-xs bg-[#c9a227]/20 text-[#e5c76b] px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30">AUDIT CONTROL</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Opening float initialization, live collection audit, blind drawer counting & variance management
            </p>
          </div>
        </div>

        <button
          onClick={fetchShifts}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1d24] text-gray-300 hover:text-white rounded-xl transition text-xs font-semibold border border-[#262930]"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Sync Shift Status
        </button>
      </div>

      {/* Active Shift Flight Deck Card */}
      <div className="bg-[#121316] rounded-2xl border border-[#262930] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#262930] pb-4">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-[#c9a227]" />
            <h2 className="text-lg font-serif font-bold text-white">Active Cashier Shift Terminal</h2>
          </div>
          {currentShift ? (
            <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 border border-emerald-500/30">
              <CheckCircle2 size={14} /> SHIFT OPEN (#{currentShift.shiftNumber})
            </span>
          ) : (
            <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded-full text-xs font-mono font-semibold border border-[#262930]">
              NO ACTIVE SHIFT OPEN
            </span>
          )}
        </div>

        {currentShift ? (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#1a1d24] p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-gray-400 block font-mono">Shift Started</span>
                <span className="font-bold text-white text-sm mt-0.5 block font-mono">
                  {format(new Date(currentShift.openedAt), "hh:mm a, MMM dd")}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-mono">Opening Cash Float</span>
                <span className="font-bold text-white text-sm mt-0.5 block font-mono">
                  ₹{currentShift.openingFloat.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-mono">Expected Drawer Total</span>
                <span className="font-bold text-emerald-400 text-sm mt-0.5 block font-mono">
                  ₹{(currentShift.expectedCash || currentShift.openingFloat).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-mono">Active Cashier</span>
                <span className="font-bold text-[#c9a227] text-sm mt-0.5 block">
                  {currentShift.cashier?.name || "Front Desk Cashier"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowCloseModal(true)}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Lock size={15} /> Reconcile & Close Shift
            </button>
          </div>
        ) : (
          <div className="text-center py-10 space-y-4">
            <ShieldCheck size={40} className="mx-auto text-gray-600 opacity-60" />
            <p className="text-sm text-gray-400 font-medium">
              You must open a cashier shift to accept payments and manage room folios.
            </p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-6 py-3 bg-[#c9a227] hover:bg-[#e5c76b] text-black rounded-xl text-xs font-bold shadow-lg transition inline-flex items-center gap-2"
            >
              <Plus size={16} /> Initialize & Open Cashier Shift
            </button>
          </div>
        )}
      </div>

      {/* Shift Audit History Log */}
      <div className="bg-[#121316] rounded-2xl border border-[#262930] p-6 shadow-xl space-y-4">
        <h3 className="font-serif font-bold text-white text-base">Historical Cashier Shift Audit Log</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#1a1d24] text-gray-400 text-xs uppercase font-mono border-b border-[#262930]">
              <tr>
                <th className="p-3.5 rounded-l-xl">Shift #</th>
                <th className="p-3.5">Cashier</th>
                <th className="p-3.5">Opened At</th>
                <th className="p-3.5">Closed At</th>
                <th className="p-3.5 text-right">Float</th>
                <th className="p-3.5 text-right">Expected</th>
                <th className="p-3.5 text-right">Counted</th>
                <th className="p-3.5 text-right">Variance</th>
                <th className="p-3.5 text-center rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262930]/60 text-gray-200 font-mono">
              {historyShifts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500 font-sans">
                    No shift history records in database.
                  </td>
                </tr>
              ) : (
                historyShifts.map((s) => (
                  <tr key={s._id} className="hover:bg-[#1a1d24]/80 transition">
                    <td className="p-3.5 font-bold text-[#c9a227]">{s.shiftNumber}</td>
                    <td className="p-3.5 font-sans font-medium text-white">{s.cashier?.name || "Staff"}</td>
                    <td className="p-3.5 text-gray-400">{format(new Date(s.openedAt), "MMM dd, hh:mm a")}</td>
                    <td className="p-3.5 text-gray-400">{s.closedAt ? format(new Date(s.closedAt), "MMM dd, hh:mm a") : "—"}</td>
                    <td className="p-3.5 text-right text-white">₹{s.openingFloat.toLocaleString()}</td>
                    <td className="p-3.5 text-right text-white">₹{(s.expectedCash || 0).toLocaleString()}</td>
                    <td className="p-3.5 text-right text-white">
                      {s.actualCashCounted !== undefined ? `₹${s.actualCashCounted.toLocaleString()}` : "—"}
                    </td>
                    <td
                      className={`p-3.5 text-right font-bold ${
                        (s.cashVariance || 0) < 0
                          ? "text-red-400"
                          : (s.cashVariance || 0) > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {s.cashVariance !== undefined ? `₹${s.cashVariance.toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === "OPEN"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-gray-800 text-gray-300 border-[#262930]"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: OPEN SHIFT */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleOpenShift} className="bg-[#121316] border border-[#262930] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-white">
            <div className="flex justify-between items-center border-b border-[#262930] pb-4">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <DollarSign className="text-emerald-400" size={20} /> Open Cashier Shift
              </h3>
              <button type="button" onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Opening Cash Float (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="5000"
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white font-mono font-bold rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Shift Notes</label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="Morning shift opening float verified"
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            <div className="flex gap-3 border-t border-[#262930] pt-4">
              <button type="button" onClick={() => setShowOpenModal(false)} className="flex-1 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingOpen}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingOpen ? "Opening..." : "Confirm Open"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: CLOSE SHIFT */}
      {showCloseModal && currentShift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCloseShift} className="bg-[#121316] border border-[#262930] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-white">
            <div className="flex justify-between items-center border-b border-[#262930] pb-4">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <Lock className="text-red-400" size={20} /> Close Shift #{currentShift.shiftNumber}
              </h3>
              <button type="button" onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Actual Cash Counted in Drawer (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={actualCounted}
                onChange={(e) => setActualCounted(e.target.value)}
                placeholder="5000"
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white font-mono font-bold rounded-xl p-2.5 focus:border-red-500"
              />
            </div>

            {actualCounted && (
              <div className="p-3 bg-[#1a1d24] border border-[#262930] rounded-xl text-xs flex justify-between font-mono font-semibold">
                <span className="text-gray-400">Calculated Variance:</span>
                <span
                  className={
                    parseFloat(actualCounted) - (currentShift.expectedCash || currentShift.openingFloat) < 0
                      ? "text-red-400 font-bold"
                      : "text-emerald-400 font-bold"
                  }
                >
                  ₹{(parseFloat(actualCounted) - (currentShift.expectedCash || currentShift.openingFloat)).toFixed(2)}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Shift Closing Audit Notes</label>
              <input
                type="text"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Cash counted & handed over to manager"
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3 border-t border-[#262930] pt-4">
              <button type="button" onClick={() => setShowCloseModal(false)} className="flex-1 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingClose}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingClose ? "Closing..." : "Close & Reconcile"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
