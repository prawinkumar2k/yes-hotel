import React, { useState, useEffect } from "react";
import {
  Moon, RefreshCw, CheckCircle2, AlertTriangle, Play, Calendar, ShieldCheck,
  Users, BedDouble, FileText, DollarSign, ArrowRight, Clock, AlertCircle, Eye,
  Lock, Check, History, Layers
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getStoredAuthToken } from "@/lib/authStorage";
import { Link } from "react-router-dom";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getStoredAuthToken()}`,
});

interface AuditStatusData {
  businessDate: string;
  openedAt?: string;
  openedBy?: string;
  isOpen: boolean;
  checklist: {
    pendingArrivals: number;
    pendingDepartures: number;
    inHouseGuests: number;
    dirtyRooms: number;
    openCashierShifts: number;
    openCashierShiftsList?: Array<{
      shiftNumber: string;
      drawerId: string;
      cashier?: { name: string; email: string };
      openingFloat: number;
      status: string;
    }>;
    isReadyForAudit: boolean;
  };
}

interface FinancialPreviewData {
  businessDate: string;
  proposedPostings: Array<{
    bookingReference: string;
    guestName: string;
    roomNumber: string;
    categoryName: string;
    tariff: number;
    cgst: number;
    sgst: number;
    total: number;
  }>;
  totals: {
    inHouseCount: number;
    estimatedRoomCharges: number;
    estimatedCGST: number;
    estimatedSGST: number;
    estimatedTotalRevenue: number;
    cashCollections: number;
    upiCollections: number;
    cardCollections: number;
    totalCollectionsToday: number;
    totalAdvances: number;
    openFoliosCount: number;
    openFolioBalances: number;
  };
}

interface BusinessDateHistoryItem {
  _id: string;
  date: string;
  state: string;
  openedAt: string;
  closedAt?: string;
  closedBy?: { name: string; email: string };
  auditSummary?: {
    roomChargesPosted: number;
    roomChargesAmount: number;
    noShowsProcessed: number;
    totalRevenue: number;
  };
}

export default function AdminNightAudit() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"READINESS" | "FINANCIAL" | "HISTORY">("READINESS");
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<AuditStatusData | null>(null);
  const [previewData, setPreviewData] = useState<FinancialPreviewData | null>(null);
  const [historyData, setHistoryData] = useState<BusinessDateHistoryItem[]>([]);
  const [running, setRunning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [forceAudit, setForceAudit] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, previewRes, historyRes] = await Promise.all([
        fetch("/api/night-audit/status", { headers: getAuthHeaders() }),
        fetch("/api/night-audit/preview", { headers: getAuthHeaders() }),
        fetch("/api/night-audit/history", { headers: getAuthHeaders() }),
      ]);

      const statusJson = await statusRes.json();
      const previewJson = await previewRes.json();
      const historyJson = await historyRes.json();

      if (statusJson.success) setStatusData(statusJson.data);
      if (previewJson.success) setPreviewData(previewJson.data);
      if (historyJson.success) setHistoryData(historyJson.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRunAudit = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/night-audit/run", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ force: forceAudit }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Night Audit Completed", description: json.message });
        setShowConfirmModal(false);
        fetchStatus();
      } else {
        toast({ title: "Night Audit Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const checklist = statusData?.checklist || {
    pendingArrivals: 0,
    pendingDepartures: 0,
    inHouseGuests: 0,
    dirtyRooms: 0,
    openCashierShifts: 0,
    isReadyForAudit: false,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <Moon className="text-purple-600" /> Automated Night Audit & Day Rollover Engine
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Authoritative room charge posting, GST calculation, no-show inventory release, and financial closing
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition text-xs font-semibold border border-gray-200"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh System Status
        </button>
      </div>

      {/* Business Date Banner */}
      <div className="bg-gradient-to-r from-purple-950 to-indigo-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-[11px] uppercase tracking-widest text-purple-300 font-semibold font-mono">
            Hotel Operational Business Date
          </span>
          <h2 className="text-3xl font-serif font-bold mt-1 text-white">
            {statusData?.businessDate ? format(new Date(statusData.businessDate), "EEEE, MMMM dd, yyyy") : "Loading..."}
          </h2>
          <p className="text-xs text-purple-200 mt-2 flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" /> All room charges, receipts & folios today belong to this business date
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase font-mono tracking-wider border ${
              statusData?.isOpen
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-red-500/20 text-red-300 border-red-500/40"
            }`}
          >
            {statusData?.isOpen ? "DAY OPEN" : "DAY CLOSED"}
          </span>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={(!checklist.isReadyForAudit && !forceAudit) || running}
            className="flex items-center gap-2 px-6 py-3 bg-[#c9a227] hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider"
          >
            <Play size={16} /> Run Night Audit
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("READINESS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "READINESS"
              ? "bg-purple-900 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <CheckCircle2 size={15} /> Operational Readiness
        </button>

        <button
          onClick={() => setActiveTab("FINANCIAL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "FINANCIAL"
              ? "bg-purple-900 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <DollarSign size={15} /> Financial Review & Proposed Postings
        </button>

        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "HISTORY"
              ? "bg-purple-900 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <History size={15} /> Audit History Ledger
        </button>
      </div>

      {/* TAB 1: OPERATIONAL READINESS */}
      {activeTab === "READINESS" && (
        <div className="space-y-6">
          {/* Pre-Audit Readiness Banner */}
          {!checklist.isReadyForAudit ? (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-start gap-3 text-sm text-amber-950">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div className="space-y-1">
                <p className="font-bold">Audit Blockers Detected:</p>
                <p className="text-xs text-amber-800">
                  Daily closing requires resolving remaining arrivals, departures, and active cashier shifts.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {checklist.pendingArrivals > 0 && (
                    <span className="px-2 py-0.5 bg-amber-200/60 rounded text-[11px] font-semibold">
                      {checklist.pendingArrivals} Pending Arrival(s)
                    </span>
                  )}
                  {checklist.pendingDepartures > 0 && (
                    <span className="px-2 py-0.5 bg-amber-200/60 rounded text-[11px] font-semibold">
                      {checklist.pendingDepartures} Pending Departure(s)
                    </span>
                  )}
                  {checklist.openCashierShifts > 0 && (
                    <span className="px-2 py-0.5 bg-red-200/60 text-red-900 rounded text-[11px] font-bold">
                      {checklist.openCashierShifts} Open Cashier Shift(s)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center gap-3 text-xs text-emerald-900">
              <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
              <div>
                <p className="font-bold text-sm">System Ready for Day Rollover</p>
                <p className="text-emerald-800">
                  All expected guests processed and all cashier shifts reconciled. You may execute Night Audit.
                </p>
              </div>
            </div>
          )}

          {/* Checklist Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Arrivals */}
            <div
              className={`p-5 rounded-xl border bg-white shadow-xs space-y-2 ${
                checklist.pendingArrivals === 0 ? "border-emerald-200" : "border-amber-300"
              }`}
            >
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase font-mono">Arrivals Awaiting Check-In</span>
                {checklist.pendingArrivals === 0 ? (
                  <CheckCircle2 size={18} className="text-emerald-500" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-500" />
                )}
              </div>
              <p className="text-3xl font-bold font-serif text-gray-900">{checklist.pendingArrivals}</p>
              <Link to="/admin/front-desk" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium">
                Open Front Desk <ArrowRight size={12} />
              </Link>
            </div>

            {/* Departures */}
            <div
              className={`p-5 rounded-xl border bg-white shadow-xs space-y-2 ${
                checklist.pendingDepartures === 0 ? "border-emerald-200" : "border-amber-300"
              }`}
            >
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase font-mono">Departures Pending Checkout</span>
                {checklist.pendingDepartures === 0 ? (
                  <CheckCircle2 size={18} className="text-emerald-500" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-500" />
                )}
              </div>
              <p className="text-3xl font-bold font-serif text-gray-900">{checklist.pendingDepartures}</p>
              <Link to="/admin/check-out" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium">
                Open Departures <ArrowRight size={12} />
              </Link>
            </div>

            {/* In-House Guests */}
            <div className="p-5 rounded-xl border border-gray-200 bg-white shadow-xs space-y-2">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase font-mono">Current In-House Rooms</span>
                <Users size={18} className="text-purple-600" />
              </div>
              <p className="text-3xl font-bold font-serif text-gray-900">{checklist.inHouseGuests}</p>
              <p className="text-xs text-gray-500">Nightly tariff will be posted to their folios</p>
            </div>

            {/* Open Cashier Shifts */}
            <div
              className={`p-5 rounded-xl border bg-white shadow-xs space-y-2 ${
                checklist.openCashierShifts === 0 ? "border-emerald-200" : "border-red-300 bg-red-50/20"
              }`}
            >
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-semibold uppercase font-mono">Open Cashier Shifts</span>
                {checklist.openCashierShifts === 0 ? (
                  <CheckCircle2 size={18} className="text-emerald-500" />
                ) : (
                  <Lock size={18} className="text-red-500" />
                )}
              </div>
              <p className="text-3xl font-bold font-serif text-gray-900">{checklist.openCashierShifts}</p>
              <Link to="/admin/cashier-shifts" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium">
                Reconcile Shifts <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {/* Open Cashier Shifts Drawer List if any */}
          {checklist.openCashierShiftsList && checklist.openCashierShiftsList.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-red-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Lock size={15} className="text-red-600" /> Active Cashier Drawers Blocking Night Audit
                </span>
                <Link to="/admin/cashier-shifts" className="text-indigo-600 hover:underline">
                  Go to Cashier Shifts →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {checklist.openCashierShiftsList.map((cs, idx) => (
                  <div key={idx} className="p-3 bg-red-50/50 rounded-lg border border-red-200 text-xs font-mono">
                    <span className="font-bold text-red-900 block">{cs.shiftNumber}</span>
                    <span className="text-gray-600 block mt-0.5">Terminal: {cs.drawerId}</span>
                    <span className="text-gray-600 block">
                      Cashier: {cs.cashier?.name || cs.cashier?.email || "Staff"}
                    </span>
                    <span className="text-emerald-700 font-bold block mt-1">
                      Float: ₹{cs.openingFloat.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FINANCIAL REVIEW & PROPOSED POSTINGS */}
      {activeTab === "FINANCIAL" && previewData && (
        <div className="space-y-6">
          {/* Financial Totals Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block">In-House Rooms</span>
              <span className="text-2xl font-bold text-gray-900 mt-1 block">
                {previewData.totals.inHouseCount}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block">Est. Room Tariff</span>
              <span className="text-xl font-bold text-gray-900 mt-1 block">
                ₹{previewData.totals.estimatedRoomCharges.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase block">Est. GST (CGST+SGST)</span>
              <span className="text-xl font-bold text-gray-900 mt-1 block">
                ₹{(previewData.totals.estimatedCGST + previewData.totals.estimatedSGST).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-xs">
              <span className="text-[10px] text-purple-700 uppercase block font-semibold">Total Revenue Posting</span>
              <span className="text-xl font-bold text-purple-900 mt-1 block">
                ₹{previewData.totals.estimatedTotalRevenue.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-[10px] text-emerald-700 uppercase block font-semibold">Collections Today</span>
              <span className="text-xl font-bold text-emerald-900 mt-1 block">
                ₹{previewData.totals.totalCollectionsToday.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-emerald-600 mt-0.5 block">
                Cash: ₹{previewData.totals.cashCollections.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-xs">
              <span className="text-[10px] text-blue-700 uppercase block font-semibold">Advances Received</span>
              <span className="text-xl font-bold text-blue-900 mt-1 block">
                ₹{previewData.totals.totalAdvances.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Proposed Charges Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm text-gray-900">
                Proposed Automated Nightly Room Charges ({previewData.proposedPostings.length})
              </h3>
              <span className="text-xs text-gray-500 font-mono">Posted atomically to guest folios</span>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="p-3">Booking Ref</th>
                    <th className="p-3">Guest Name</th>
                    <th className="p-3">Room #</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Base Tariff (₹)</th>
                    <th className="p-3 text-right">CGST (₹)</th>
                    <th className="p-3 text-right">SGST (₹)</th>
                    <th className="p-3 text-right">Total Debit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.proposedPostings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400 font-sans">
                        No checked-in guests in house to bill for tonight.
                      </td>
                    </tr>
                  ) : (
                    previewData.proposedPostings.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-[#c9a227]">{p.bookingReference}</td>
                        <td className="p-3 font-sans font-medium text-gray-900">{p.guestName}</td>
                        <td className="p-3 font-bold text-gray-700">{p.roomNumber}</td>
                        <td className="p-3 text-gray-500">{p.categoryName}</td>
                        <td className="p-3 text-right text-gray-800">₹{p.tariff.toLocaleString("en-IN")}</td>
                        <td className="p-3 text-right text-gray-600">₹{p.cgst.toLocaleString("en-IN")}</td>
                        <td className="p-3 text-right text-gray-600">₹{p.sgst.toLocaleString("en-IN")}</td>
                        <td className="p-3 text-right font-bold text-gray-900">
                          ₹{p.total.toLocaleString("en-IN")}
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

      {/* TAB 3: AUDIT HISTORY LEDGER */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-serif font-bold text-sm text-gray-900">Historical Business Date Audit Runs</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] border-b border-gray-200">
                <tr>
                  <th className="p-3">Audit Date</th>
                  <th className="p-3">Closed At</th>
                  <th className="p-3">Executed By</th>
                  <th className="p-3 text-right">Charges Posted</th>
                  <th className="p-3 text-right">Revenue Posted (₹)</th>
                  <th className="p-3 text-right">No-Shows Processed</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 font-sans">
                      No previous night audits recorded in database.
                    </td>
                  </tr>
                ) : (
                  historyData.map((h) => (
                    <tr key={h._id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-purple-900">
                        {format(new Date(h.date), "dd MMM yyyy")}
                      </td>
                      <td className="p-3 text-gray-500">
                        {h.closedAt ? format(new Date(h.closedAt), "dd MMM yyyy, hh:mm a") : "—"}
                      </td>
                      <td className="p-3 font-sans font-medium text-gray-800">
                        {h.closedBy?.name || h.closedBy?.email || "Automated Audit"}
                      </td>
                      <td className="p-3 text-right text-gray-800">
                        {h.auditSummary?.roomChargesPosted || 0}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-800">
                        ₹{(h.auditSummary?.roomChargesAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3 text-right text-amber-700">
                        {h.auditSummary?.noShowsProcessed || 0}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          COMPLETED
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRM EXECUTION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl text-gray-800">
            <div className="flex items-center gap-3 text-purple-900 border-b border-gray-100 pb-3">
              <Moon size={24} className="text-purple-600" />
              <h3 className="font-serif font-bold text-lg">Execute Night Audit & Day Rollover</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This action will close operational date{" "}
              <strong className="text-gray-900">
                {statusData?.businessDate ? format(new Date(statusData.businessDate), "dd MMM yyyy") : "today"}
              </strong>
              , post nightly room charges + GST to in-house guest folios, release inventory for no-shows, and advance the
              hotel working date to tomorrow.
            </p>

            {!checklist.isReadyForAudit && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-900">
                <p className="font-bold">⚠️ Warning: Blocking checks have not cleared!</p>
                <p className="text-[11px] text-amber-800">
                  {checklist.openCashierShifts > 0 && `${checklist.openCashierShifts} open cashier shifts. `}
                  {checklist.pendingArrivals > 0 && `${checklist.pendingArrivals} pending arrivals. `}
                  {checklist.pendingDepartures > 0 && `${checklist.pendingDepartures} pending departures. `}
                </p>
                <label className="flex items-center gap-2 pt-1 font-bold text-red-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceAudit}
                    onChange={(e) => setForceAudit(e.target.checked)}
                    className="rounded"
                  />
                  <span>Supervisor Override: Force audit anyway</span>
                </label>
              </div>
            )}

            <div className="flex gap-3 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={(!checklist.isReadyForAudit && !forceAudit) || running}
                className="flex-1 py-2.5 bg-[#c9a227] hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {running ? "Rolling Over..." : "Confirm & Execute Audit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
