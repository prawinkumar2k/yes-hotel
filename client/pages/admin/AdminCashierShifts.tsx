import React, { useState, useEffect } from "react";
import { DollarSign, Plus, RefreshCw, Lock, CheckCircle2, AlertTriangle, Clock, ShieldCheck, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
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
        toast({ title: "Shift Closed", description: json.message });
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> Cashier Shift & Cash Drawer Reconciliation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cash float initialization, live collection audit, and blind cash drawer balancing
          </p>
        </div>
        <button
          onClick={fetchShifts}
          className="flex items-center gap-2 px-4 py-2 bg-hotel-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Active Shift Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock size={18} className="text-indigo-600" /> Your Active Cashier Shift
          </h2>
          {currentShift ? (
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle2 size={14} /> SHIFT OPEN (#{currentShift.shiftNumber})
            </span>
          ) : (
            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">
              NO ACTIVE SHIFT
            </span>
          )}
        </div>

        {currentShift ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-emerald-50/50 p-5 rounded-xl border border-emerald-200">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-xs text-gray-500 block">Opened Time</span>
                <span className="font-bold text-gray-900">{format(new Date(currentShift.openedAt), "hh:mm a, MMM dd")}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Opening Cash Float</span>
                <span className="font-bold text-gray-900">₹{currentShift.openingFloat}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Expected Drawer Total</span>
                <span className="font-bold text-emerald-700">₹{currentShift.expectedCash || currentShift.openingFloat}</span>
              </div>
            </div>

            <button
              onClick={() => setShowCloseModal(true)}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2"
            >
              <Lock size={14} /> Close & Balance Shift
            </button>
          </div>
        ) : (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-gray-500">You do not have an active open cashier shift.</p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition inline-flex items-center gap-2"
            >
              <Plus size={16} /> Open New Cashier Shift
            </button>
          </div>
        )}
      </div>

      {/* Historical Shift Audit Log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="font-serif font-bold text-gray-900 text-base">Cashier Shift History Log</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b">
              <tr>
                <th className="p-3">Shift #</th>
                <th className="p-3">Cashier</th>
                <th className="p-3">Opened At</th>
                <th className="p-3">Closed At</th>
                <th className="p-3 text-right">Float (₹)</th>
                <th className="p-3 text-right">Expected (₹)</th>
                <th className="p-3 text-right">Counted (₹)</th>
                <th className="p-3 text-right">Variance (₹)</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyShifts.length === 0 ? (
                <tr><td colSpan={9} className="p-6 text-center text-gray-400">No shift history records.</td></tr>
              ) : (
                historyShifts.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-gray-900">{s.shiftNumber}</td>
                    <td className="p-3 font-medium text-gray-900">{s.cashier?.name || "Staff"}</td>
                    <td className="p-3 text-gray-600 font-mono">{format(new Date(s.openedAt), "MMM dd, hh:mm a")}</td>
                    <td className="p-3 text-gray-600 font-mono">{s.closedAt ? format(new Date(s.closedAt), "MMM dd, hh:mm a") : "—"}</td>
                    <td className="p-3 text-right font-semibold">₹{s.openingFloat}</td>
                    <td className="p-3 text-right font-semibold">₹{s.expectedCash || 0}</td>
                    <td className="p-3 text-right font-semibold">{s.actualCashCounted !== undefined ? `₹${s.actualCashCounted}` : "—"}</td>
                    <td className={`p-3 text-right font-bold ${
                      (s.cashVariance || 0) < 0 ? "text-red-600" : (s.cashVariance || 0) > 0 ? "text-amber-600" : "text-emerald-700"
                    }`}>
                      {s.cashVariance !== undefined ? `₹${s.cashVariance}` : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                      }`}>
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

      {/* Modal: Open Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleOpenShift} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-900 text-base">Open Cashier Shift</h3>
              <button type="button" onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Opening Cash Float (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Shift Opening Notes</label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="e.g. Morning Shift drawer opening"
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowOpenModal(false)} className="flex-1 py-2 border rounded text-xs text-gray-700">Cancel</button>
              <button type="submit" disabled={submittingOpen} className="flex-1 py-2 bg-emerald-600 text-white rounded text-xs font-bold disabled:opacity-50">
                {submittingOpen ? "Opening..." : "Confirm & Open"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Close Shift */}
      {showCloseModal && currentShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCloseShift} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-900 text-base">Close Shift #{currentShift.shiftNumber}</h3>
              <button type="button" onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Actual Cash Counted in Drawer (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={actualCounted}
                onChange={(e) => setActualCounted(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-red-500 outline-none font-bold"
              />
            </div>

            {actualCounted && (
              <div className="p-3 bg-gray-50 border rounded text-xs flex justify-between font-semibold">
                <span>Calculated Variance:</span>
                <span className={parseFloat(actualCounted) - currentShift.expectedCash < 0 ? "text-red-600" : "text-emerald-700"}>
                  ₹{(parseFloat(actualCounted) - currentShift.expectedCash).toFixed(2)}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Shift Closing Audit Notes</label>
              <input
                type="text"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="e.g., Cash verified with shift supervisor"
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCloseModal(false)} className="flex-1 py-2 border rounded text-xs text-gray-700">Cancel</button>
              <button type="submit" disabled={submittingClose} className="flex-1 py-2 bg-red-600 text-white rounded text-xs font-bold disabled:opacity-50">
                {submittingClose ? "Closing..." : "Close Shift"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
