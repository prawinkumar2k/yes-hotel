import React, { useState, useEffect } from "react";
import {
  DollarSign, Plus, RefreshCw, Lock, CheckCircle2, AlertTriangle, Clock,
  ShieldCheck, X, CreditCard, ArrowUpRight, Scale, ChevronRight, ArrowRightLeft,
  Banknote, FileText, User, AlertCircle, Eye, Printer, Smartphone, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getStoredAuthToken } from "@/lib/authStorage";
import DenominationCounter, { DenominationState, calculateDenominationTotal } from "@/components/admin/DenominationCounter";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getStoredAuthToken()}`,
});

const initialDenominations: DenominationState = {
  n2000: 0,
  n500: 0,
  n200: 0,
  n100: 0,
  n50: 0,
  n20: 0,
  n10: 0,
  coins: 0,
};

interface ShiftTransaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  mode: string;
  date: string;
  reference?: string;
}

interface CashierShiftItem {
  _id: string;
  shiftNumber: string;
  drawerId: string;
  cashier?: { _id: string; firstName?: string; lastName?: string; name?: string; email: string; role: string };
  businessDate: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashCollected?: number;
  cashAdvances?: number;
  cashRefunds?: number;
  totalPaidOut?: number;
  expectedCash: number;
  expectedUpi?: number;
  expectedCard?: number;
  expectedGateway?: number;
  actualCashCounted?: number;
  cashVariance?: number;
  varianceAcceptanceRequired?: boolean;
  varianceReason?: string;
  status: "OPEN" | "HANDOVER_PENDING" | "CLOSED" | "RECONCILED";
  notes?: string;
  handoverToCashier?: { _id: string; firstName?: string; lastName?: string; name?: string; email: string };
  paidOuts?: Array<{ _id: string; amount: number; reason: string; category: string; createdAt: string }>;
  liveLedger?: {
    cashCollected: number;
    cashAdvances: number;
    cashRefunds: number;
    totalPaidOut: number;
    expectedCash: number;
    expectedUpi: number;
    expectedCard: number;
    expectedGateway: number;
    expectedOther: number;
    itemizedTransactions: ShiftTransaction[];
  };
}

export default function AdminCashierShifts() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentShift, setCurrentShift] = useState<CashierShiftItem | null>(null);
  const [historyShifts, setHistoryShifts] = useState<CashierShiftItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<Array<{ _id: string; name: string; email: string; role?: string }>>([]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [drawerFilter, setDrawerFilter] = useState("ALL");

  // Open Shift Modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState("DRAWER-01");
  const [openDenominations, setOpenDenominations] = useState<DenominationState>(initialDenominations);
  const [openFloatOverride, setOpenFloatOverride] = useState("");
  const [openNotes, setOpenNotes] = useState("");
  const [submittingOpen, setSubmittingOpen] = useState(false);

  // Close & Reconcile Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeDenominations, setCloseDenominations] = useState<DenominationState>(initialDenominations);
  const [closeCountedOverride, setCloseCountedOverride] = useState("");
  const [varianceExplanation, setVarianceExplanation] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [submittingClose, setSubmittingClose] = useState(false);

  // Handover Modal
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [targetCashierId, setTargetCashierId] = useState("");
  const [handoverDenominations, setHandoverDenominations] = useState<DenominationState>(initialDenominations);
  const [handoverNotes, setHandoverNotes] = useState("");
  const [submittingHandover, setSubmittingHandover] = useState(false);

  // Paid Out Modal (Cash drop / petty expense)
  const [showPaidOutModal, setShowPaidOutModal] = useState(false);
  const [paidOutAmount, setPaidOutAmount] = useState("");
  const [paidOutReason, setPaidOutReason] = useState("");
  const [paidOutCategory, setPaidOutCategory] = useState<string>("PETTY_CASH");
  const [submittingPaidOut, setSubmittingPaidOut] = useState(false);

  // Shift Details Drilldown Modal
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<CashierShiftItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const [curRes, allRes, staffRes] = await Promise.all([
        fetch("/api/cashier-shifts/current", { headers: getAuthHeaders() }),
        fetch("/api/cashier-shifts", { headers: getAuthHeaders() }),
        fetch("/api/cashier-shifts/cashiers", { headers: getAuthHeaders() }).catch(() => null),
      ]);

      const curJson = await curRes.json();
      const allJson = await allRes.json();

      if (curJson.success) setCurrentShift(curJson.data);
      if (allJson.success) setHistoryShifts(allJson.data || []);

      if (staffRes && staffRes.ok) {
        const staffJson = await staffRes.json();
        if (staffJson.success && Array.isArray(staffJson.data)) {
          setStaffUsers(
            staffJson.data.map((u: any) => ({
              _id: u._id,
              name: `${u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}`,
              email: u.email,
              role: u.role,
            }))
          );
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const openFloatTotal = calculateDenominationTotal(openDenominations);
  const effectiveOpeningFloat = openFloatTotal > 0 ? openFloatTotal : Number(openFloatOverride) || 0;

  const closeCountedTotal = calculateDenominationTotal(closeDenominations);
  const effectiveClosingCounted = closeCountedTotal > 0 ? closeCountedTotal : Number(closeCountedOverride) || 0;

  const liveExpectedCash = currentShift?.liveLedger?.expectedCash ?? currentShift?.expectedCash ?? currentShift?.openingFloat ?? 0;
  const calculatedClosingVariance = effectiveClosingCounted - liveExpectedCash;

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveOpeningFloat < 0) {
      toast({ title: "Invalid Float", description: "Opening float cannot be negative", variant: "destructive" });
      return;
    }
    setSubmittingOpen(true);
    try {
      const res = await fetch("/api/cashier-shifts/open", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          drawerId: selectedDrawer,
          openingFloat: effectiveOpeningFloat,
          openingDenominations: openFloatTotal > 0 ? openDenominations : undefined,
          notes: openNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Shift Initialized", description: json.message });
        setShowOpenModal(false);
        setOpenDenominations(initialDenominations);
        setOpenFloatOverride("");
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

  const handleRecordPaidOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    const amt = parseFloat(paidOutAmount);
    if (!amt || amt <= 0) {
      toast({ title: "Invalid Amount", description: "Paid-out amount must be greater than zero", variant: "destructive" });
      return;
    }
    setSubmittingPaidOut(true);
    try {
      const res = await fetch(`/api/cashier-shifts/${currentShift._id}/paid-out`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: amt,
          reason: paidOutReason,
          category: paidOutCategory,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Paid-out Recorded", description: json.message });
        setShowPaidOutModal(false);
        setPaidOutAmount("");
        setPaidOutReason("");
        fetchShifts();
      } else {
        toast({ title: "Failed to record paid-out", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingPaidOut(false);
    }
  };

  const handleInitiateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    if (!targetCashierId) {
      toast({ title: "Cashier Required", description: "Please select incoming cashier", variant: "destructive" });
      return;
    }
    const handoverCount = calculateDenominationTotal(handoverDenominations);
    setSubmittingHandover(true);
    try {
      const res = await fetch(`/api/cashier-shifts/${currentShift._id}/handover/initiate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          targetCashierId,
          countedCash: handoverCount,
          denominations: handoverCount > 0 ? handoverDenominations : undefined,
          // Any variance at handover needs a reason; the handover notes carry it.
          varianceReason: handoverNotes,
          notes: handoverNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Handover Initiated", description: json.message });
        setShowHandoverModal(false);
        setHandoverDenominations(initialDenominations);
        setHandoverNotes("");
        fetchShifts();
      } else {
        toast({ title: "Handover Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingHandover(false);
    }
  };

  const handleAcceptVariance = async (shiftId: string) => {
    const notes = window.prompt("Notes for accepting this cash variance:")?.trim();
    if (!notes || notes.length < 3) return;
    try {
      const res = await fetch(`/api/cashier-shifts/${shiftId}/accept`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ notes }) });
      const json = await res.json();
      toast({ title: json.success ? "Variance Accepted" : "Could not accept", description: json.message, variant: json.success ? undefined : "destructive" });
      if (json.success) fetchShifts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleConfirmHandover = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/cashier-shifts/${shiftId}/handover/confirm`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Handover Acknowledged", description: json.message });
        fetchShifts();
      } else {
        toast({ title: "Handover Confirmation Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    if (Math.abs(calculatedClosingVariance) > 0 && !varianceExplanation.trim()) {
      toast({
        title: "Variance Explanation Required",
        description: `Drawer has a ₹${calculatedClosingVariance.toFixed(2)} variance. You must provide an explanation before closing.`,
        variant: "destructive",
      });
      return;
    }

    setSubmittingClose(true);
    try {
      const res = await fetch(`/api/cashier-shifts/${currentShift._id}/close`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          actualCashCounted: effectiveClosingCounted,
          closingDenominations: closeCountedTotal > 0 ? closeDenominations : undefined,
          varianceReason: varianceExplanation,
          notes: closeNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: json.data?.varianceAcceptanceRequired ? "Shift Closed — Awaiting Acceptance" : "Shift Closed & Reconciled", description: json.message });
        setShowCloseModal(false);
        setCloseDenominations(initialDenominations);
        setCloseCountedOverride("");
        setVarianceExplanation("");
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

  const openShiftDetailsModal = async (shiftId: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/cashier-shifts/${shiftId}/details`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setSelectedShiftForDetails(json.data);
      } else {
        toast({ title: "Error loading shift details", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredHistory = historyShifts.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (drawerFilter !== "ALL" && s.drawerId !== drawerFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
            <DollarSign size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
              Cashier Shift & Cash Drawer Reconciliation
              <span className="text-xs bg-[#c9a227]/20 text-amber-800 px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30 font-semibold">
                AUDIT COMPLIANT
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Opening float initialization, denomination counting, live transaction audit, cash drops & dual-handover
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchShifts}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition text-xs font-semibold border border-gray-200"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync Status
          </button>
        </div>
      </div>

      {/* Handover Notice Banner if pending */}
      {currentShift && currentShift.status === "HANDOVER_PENDING" && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-900">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="text-amber-600 shrink-0" size={20} />
            <div>
              <p className="font-bold text-sm">Shift Handover Awaiting Confirmation</p>
              <p className="text-xs text-amber-800">
                Shift #{currentShift.shiftNumber} ({currentShift.drawerId}) is pending handover acknowledgment by{" "}
                <span className="font-semibold">
                  {currentShift.handoverToCashier?.firstName
                    ? `${currentShift.handoverToCashier.firstName} ${currentShift.handoverToCashier.lastName}`
                    : currentShift.handoverToCashier?.email || "incoming cashier"}
                </span>
                .
              </p>
            </div>
          </div>
          <button
            onClick={() => handleConfirmHandover(currentShift._id)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs whitespace-nowrap shadow-sm"
          >
            Confirm & Accept Shift
          </button>
        </div>
      )}

      {/* Active Shift Flight Deck */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-[#c9a227]" />
            <h2 className="text-lg font-serif font-bold text-gray-900">Active Shift Terminal & Drawer Status</h2>
          </div>
          {currentShift ? (
            <div className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-mono font-bold border border-gray-200">
                {currentShift.drawerId || "DRAWER-01"}
              </span>
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 border border-emerald-200">
                <CheckCircle2 size={14} /> ACTIVE ({currentShift.shiftNumber})
              </span>
            </div>
          ) : (
            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-mono font-semibold border border-gray-200">
              NO ACTIVE SHIFT OPEN
            </span>
          )}
        </div>

        {currentShift ? (
          <div className="space-y-6">
            {/* Live KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase font-mono block">Opening Float</span>
                <span className="text-xl font-bold font-mono text-gray-900 mt-1 block">
                  ₹{currentShift.openingFloat.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 block">Drawer Baseline</span>
              </div>

              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-700 uppercase font-mono block">+ Cash Collections</span>
                <span className="text-xl font-bold font-mono text-emerald-800 mt-1 block">
                  ₹{(currentShift.liveLedger?.cashCollected || 0).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">Folio Payments</span>
              </div>

              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
                <span className="text-[10px] text-blue-700 uppercase font-mono block">+ Cash Advances</span>
                <span className="text-xl font-bold font-mono text-blue-800 mt-1 block">
                  ₹{(currentShift.liveLedger?.cashAdvances || 0).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-blue-600 mt-0.5 block">Deposits</span>
              </div>

              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                <span className="text-[10px] text-amber-700 uppercase font-mono block">- Paid Outs / Drops</span>
                <span className="text-xl font-bold font-mono text-amber-800 mt-1 block">
                  ₹{(currentShift.liveLedger?.totalPaidOut || 0).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-amber-600 mt-0.5 block">
                  {currentShift.paidOuts?.length || 0} Cash Drop(s)
                </span>
              </div>

              <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200">
                <span className="text-[10px] text-purple-700 uppercase font-mono block">= Expected Cash</span>
                <span className="text-2xl font-bold font-mono text-purple-900 mt-0.5 block">
                  ₹{liveExpectedCash.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-purple-600 mt-0.5 block font-semibold">Physical Till</span>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase font-mono block">Digital Non-Cash</span>
                <span className="text-xl font-bold font-mono text-gray-800 mt-1 block">
                  ₹{(
                    (currentShift.liveLedger?.expectedCard || 0) +
                    (currentShift.liveLedger?.expectedUpi || 0) +
                    (currentShift.liveLedger?.expectedGateway || 0)
                  ).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">UPI / Card / PG</span>
              </div>
            </div>

            {/* Flight Deck Actions & Metadata Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                <div>
                  <span className="text-gray-400 font-mono block">Cashier</span>
                  <span className="font-bold text-gray-800">
                    {currentShift.cashier?.firstName
                      ? `${currentShift.cashier.firstName} ${currentShift.cashier.lastName}`
                      : currentShift.cashier?.name || currentShift.cashier?.email || "Front Desk Cashier"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-mono block">Shift Started</span>
                  <span className="font-mono font-medium text-gray-800">
                    {format(new Date(currentShift.openedAt), "hh:mm a, dd MMM yyyy")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-mono block">Business Date</span>
                  <span className="font-mono font-medium text-gray-800">
                    {currentShift.businessDate ? format(new Date(currentShift.businessDate), "dd MMM yyyy") : "Today"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowPaidOutModal(true)}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Banknote size={14} /> Record Cash Drop / Paid-Out
                </button>
                <button
                  onClick={() => setShowHandoverModal(true)}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <ArrowRightLeft size={14} /> Handover Shift
                </button>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Lock size={14} /> Reconcile & Close Shift
                </button>
              </div>
            </div>

            {/* Live Itemized Transactions Accordion / Table */}
            {currentShift.liveLedger?.itemizedTransactions && currentShift.liveLedger.itemizedTransactions.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <FileText size={14} className="text-[#c9a227]" />
                    Shift Transactions Ledger ({currentShift.liveLedger.itemizedTransactions.length})
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">Live Persisted Ledger</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-gray-100 text-gray-500 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Time</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Mode</th>
                        <th className="p-2.5 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentShift.liveLedger.itemizedTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{format(new Date(tx.date), "hh:mm a")}</td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tx.type === "FOLIO_PAYMENT"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : tx.type === "ADVANCE_PAYMENT"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-2 text-gray-800 font-sans font-medium">{tx.description}</td>
                          <td className="p-2 font-bold">{tx.mode}</td>
                          <td
                            className={`p-2 text-right font-bold ${
                              tx.amount < 0 ? "text-red-600" : "text-gray-900"
                            }`}
                          >
                            ₹{Math.abs(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 space-y-4">
            <ShieldCheck size={44} className="mx-auto text-gray-400 opacity-60" />
            <p className="text-sm text-gray-600 font-medium">
              You must initialize and open a cashier shift drawer before processing folio payments or receiving advances.
            </p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-6 py-3 bg-[#c9a227] hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition inline-flex items-center gap-2"
            >
              <Plus size={16} /> Open Cashier Shift & Float
            </button>
          </div>
        )}
      </div>

      {/* Historical Audit Log Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-serif font-bold text-gray-900 text-base">Historical Cashier Shift Audit Log</h3>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="HANDOVER_PENDING">Handover Pending</option>
              <option value="CLOSED">Closed</option>
              <option value="RECONCILED">Reconciled</option>
            </select>

            <select
              value={drawerFilter}
              onChange={(e) => setDrawerFilter(e.target.value)}
              className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 outline-none"
            >
              <option value="ALL">All Drawers</option>
              <option value="DRAWER-01">Drawer 01</option>
              <option value="DRAWER-02">Drawer 02</option>
              <option value="FRONT_DESK_MAIN">Front Desk Main</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-gray-100 text-gray-600 text-[11px] uppercase font-mono border-b border-gray-200">
              <tr>
                <th className="p-3">Shift #</th>
                <th className="p-3">Drawer</th>
                <th className="p-3">Cashier</th>
                <th className="p-3">Opened At</th>
                <th className="p-3">Closed At</th>
                <th className="p-3 text-right">Float (₹)</th>
                <th className="p-3 text-right">Expected (₹)</th>
                <th className="p-3 text-right">Counted (₹)</th>
                <th className="p-3 text-right">Variance (₹)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400 font-sans">
                    No matching shift records found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-bold text-[#c9a227]">{s.shiftNumber}</td>
                    <td className="p-3 text-gray-600 font-semibold">{s.drawerId || "DRAWER-01"}</td>
                    <td className="p-3 font-sans font-medium text-gray-900">
                      {s.cashier?.firstName
                        ? `${s.cashier.firstName} ${s.cashier.lastName}`
                        : s.cashier?.name || s.cashier?.email || "Staff"}
                    </td>
                    <td className="p-3 text-gray-500">{format(new Date(s.openedAt), "MMM dd, hh:mm a")}</td>
                    <td className="p-3 text-gray-500">
                      {s.closedAt ? format(new Date(s.closedAt), "MMM dd, hh:mm a") : "—"}
                    </td>
                    <td className="p-3 text-right text-gray-800">₹{s.openingFloat.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right text-gray-800">
                      ₹{(s.expectedCash || s.openingFloat).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 text-right text-gray-900 font-bold">
                      {s.actualCashCounted !== undefined ? `₹${s.actualCashCounted.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td
                      className={`p-3 text-right font-bold ${
                        (s.cashVariance || 0) < 0
                          ? "text-red-600"
                          : (s.cashVariance || 0) > 0
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {s.cashVariance !== undefined ? `₹${s.cashVariance.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="p-3 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === "OPEN"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : s.status === "HANDOVER_PENDING"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : s.status === "RECONCILED"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {s.status}
                      </span>
                      {s.varianceAcceptanceRequired && (
                        <div className="text-[10px] text-amber-700 mt-1">variance needs acceptance</div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openShiftDetailsModal(s._id)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-900 transition"
                        title="View Detailed Ledger"
                      >
                        <Eye size={15} />
                      </button>
                      {s.status === "CLOSED" && s.varianceAcceptanceRequired && (
                        <button
                          onClick={() => handleAcceptVariance(s._id)}
                          className="ml-1 px-2 py-1 text-[10px] font-bold rounded border border-amber-300 text-amber-800 hover:bg-amber-50"
                          title="Accept cash variance (manager)"
                        >
                          Accept
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

      {/* MODAL 1: OPEN SHIFT WITH DENOMINATION COUNT */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenShift}
            className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl text-gray-800"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <DollarSign className="text-[#c9a227]" size={20} /> Open Cashier Shift & Set Drawer Float
              </h3>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Select Drawer Terminal *</label>
                <select
                  value={selectedDrawer}
                  onChange={(e) => setSelectedDrawer(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-sm font-bold text-gray-800 rounded-lg p-2.5 focus:border-[#c9a227] outline-none"
                >
                  <option value="DRAWER-01">Drawer 01 (Front Desk Primary)</option>
                  <option value="DRAWER-02">Drawer 02 (Front Desk Secondary)</option>
                  <option value="FRONT_DESK_MAIN">Front Desk Main POS</option>
                  <option value="CONCIERGE_TILL">Concierge Cash Till</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Opening Cash Float Total (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={openFloatTotal > 0 ? openFloatTotal : openFloatOverride}
                  onChange={(e) => setOpenFloatOverride(e.target.value)}
                  placeholder="5000"
                  className="w-full bg-gray-50 border border-gray-200 text-sm text-gray-900 font-mono font-bold rounded-lg p-2.5 focus:border-[#c9a227] outline-none"
                />
              </div>
            </div>

            {/* Denomination Counter */}
            <DenominationCounter
              values={openDenominations}
              onChange={(updated) => setOpenDenominations(updated)}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Shift Opening Notes</label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="Morning shift opening float physically verified"
                className="w-full bg-gray-50 border border-gray-200 text-sm text-gray-800 rounded-lg p-2.5 focus:border-[#c9a227] outline-none"
              />
            </div>

            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingOpen}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {submittingOpen ? "Opening..." : "Confirm & Open Shift"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: CLOSE SHIFT WITH DENOMINATION & VARIANCE AUDIT */}
      {showCloseModal && currentShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCloseShift}
            className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl text-gray-800"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <Lock className="text-red-500" size={20} /> Reconcile & Close Shift #{currentShift.shiftNumber}
              </h3>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs flex justify-between items-center font-mono font-semibold">
              <span className="text-gray-600">Expected Physical Cash in Drawer:</span>
              <span className="text-sm font-bold text-gray-900">
                ₹{liveExpectedCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Denomination Counter for closing count */}
            <DenominationCounter
              values={closeDenominations}
              onChange={(updated) => setCloseDenominations(updated)}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Actual Physical Cash Counted (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={closeCountedTotal > 0 ? closeCountedTotal : closeCountedOverride}
                onChange={(e) => setCloseCountedOverride(e.target.value)}
                placeholder="5000"
                className="w-full bg-gray-50 border border-gray-200 text-sm text-gray-900 font-mono font-bold rounded-lg p-2.5 focus:border-red-500 outline-none"
              />
            </div>

            {/* Variance indicator */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs flex justify-between items-center font-mono">
              <span className="text-gray-600 font-semibold">Calculated Cash Variance:</span>
              <span
                className={`font-bold text-sm ${
                  calculatedClosingVariance < 0
                    ? "text-red-600"
                    : calculatedClosingVariance > 0
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {calculatedClosingVariance < 0
                  ? `- ₹${Math.abs(calculatedClosingVariance).toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Shortage)`
                  : calculatedClosingVariance > 0
                  ? `+ ₹${calculatedClosingVariance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Surplus)`
                  : "₹0.00 (Balanced)"}
              </span>
            </div>

            {Math.abs(calculatedClosingVariance) > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-red-700">
                  Variance Explanation (Mandatory for non-zero variance) *
                </label>
                <input
                  type="text"
                  required
                  value={varianceExplanation}
                  onChange={(e) => setVarianceExplanation(e.target.value)}
                  placeholder="e.g. ₹50 change shortage from guest laundry bill"
                  className="w-full bg-red-50/50 border border-red-300 text-xs text-red-900 rounded-lg p-2.5 focus:border-red-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Shift Closing Notes</label>
              <input
                type="text"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Drawer verified and locked for day rollover"
                className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-lg p-2.5 focus:border-[#c9a227] outline-none"
              />
            </div>

            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingClose}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {submittingClose ? "Closing..." : "Close & Reconcile Shift"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: CASH DROP / PAID-OUT */}
      {showPaidOutModal && currentShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPaidOut}
            className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-gray-800"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <Banknote className="text-amber-600" size={20} /> Record Drawer Paid-Out / Cash Drop
              </h3>
              <button
                type="button"
                onClick={() => setShowPaidOutModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
              <select
                value={paidOutCategory}
                onChange={(e: any) => setPaidOutCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-800 rounded-lg p-2.5 outline-none"
              >
                <option value="CASH_DROP">Cash Drop to Hotel Safe / Finance</option>
                <option value="PETTY_CASH">Front Desk Petty Cash Expense</option>
                <option value="REFUND">Counter Cash Refund</option>
                <option value="EARLY_CHECK_IN">Early Check-in</option>
                <option value="WATER_BOTTLE">Water Bottle</option>
                <option value="DENTAL_KIT">Dental Kit</option>
                <option value="TEA_COFFEE_SHOP">Tea / Coffee Shop</option>
                <option value="KOVAI_KONGU_MESS">Kovai Kongu Mess</option>
                <option value="OTHER">Others</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Paid-Out Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="1"
                value={paidOutAmount}
                onChange={(e) => setPaidOutAmount(e.target.value)}
                placeholder="2000"
                className="w-full bg-gray-50 border border-gray-200 text-sm text-gray-900 font-mono font-bold rounded-lg p-2.5 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {paidOutCategory === "OTHER" ? "Reason *" : "Note (optional)"}
              </label>
              <input
                type="text"
                required={paidOutCategory === "OTHER"}
                minLength={paidOutCategory === "OTHER" ? 3 : undefined}
                value={paidOutReason}
                onChange={(e) => setPaidOutReason(e.target.value)}
                placeholder={paidOutCategory === "OTHER" ? "What was this cash paid for?" : "e.g. recipient or bill number"}
                className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-lg p-2.5 outline-none"
              />
            </div>

            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowPaidOutModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPaidOut}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {submittingPaidOut ? "Recording..." : "Save Paid-Out"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: SHIFT HANDOVER */}
      {showHandoverModal && currentShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleInitiateHandover}
            className="bg-white border border-gray-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl text-gray-800"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <ArrowRightLeft className="text-indigo-600" size={20} /> Handover Shift #{currentShift.shiftNumber}
              </h3>
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Incoming Cashier *</label>
              <select
                required
                value={targetCashierId}
                onChange={(e) => setTargetCashierId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-800 rounded-lg p-2.5 outline-none"
              >
                <option value="">-- Select Incoming Cashier or Receptionist --</option>
                {staffUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} — {u.role ? `[${u.role}] ` : ""}({u.email})
                  </option>
                ))}
              </select>
            </div>

            <DenominationCounter
              values={handoverDenominations}
              onChange={(updated) => setHandoverDenominations(updated)}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Handover Notes</label>
              <input
                type="text"
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Evening shift takeover, drawer float counted together"
                className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-lg p-2.5 outline-none"
              />
            </div>

            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingHandover}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {submittingHandover ? "Initiating..." : "Initiate Handover"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: DETAILED SHIFT AUDIT DRILLDOWN */}
      {selectedShiftForDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl text-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-gray-900 flex items-center gap-2">
                  Shift Audit Summary #{selectedShiftForDetails.shiftNumber}
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Drawer: {selectedShiftForDetails.drawerId} · Status: {selectedShiftForDetails.status}
                </p>
              </div>
              <button
                onClick={() => setSelectedShiftForDetails(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-500 block text-[10px] uppercase">Opening Float</span>
                <span className="text-base font-bold text-gray-900 mt-1 block">
                  ₹{selectedShiftForDetails.openingFloat.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-500 block text-[10px] uppercase">Expected Cash</span>
                <span className="text-base font-bold text-purple-900 mt-1 block">
                  ₹{(selectedShiftForDetails.expectedCash || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-500 block text-[10px] uppercase">Actual Counted</span>
                <span className="text-base font-bold text-gray-900 mt-1 block">
                  ₹{(selectedShiftForDetails.actualCashCounted || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-500 block text-[10px] uppercase">Variance</span>
                <span
                  className={`text-base font-bold mt-1 block ${
                    (selectedShiftForDetails.cashVariance || 0) < 0
                      ? "text-red-600"
                      : (selectedShiftForDetails.cashVariance || 0) > 0
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  ₹{(selectedShiftForDetails.cashVariance || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {selectedShiftForDetails.varianceReason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
                <span className="font-bold">Variance Explanation: </span>
                {selectedShiftForDetails.varianceReason}
              </div>
            )}

            {/* Itemized transaction list */}
            {selectedShiftForDetails.liveLedger?.itemizedTransactions && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Itemized Transactions</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase">
                      <tr>
                        <th className="p-2">Time</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Description</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedShiftForDetails.liveLedger.itemizedTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{format(new Date(tx.date), "hh:mm a")}</td>
                          <td className="p-2 font-bold">{tx.type}</td>
                          <td className="p-2 font-sans">{tx.description}</td>
                          <td className="p-2">{tx.mode}</td>
                          <td className="p-2 text-right font-bold">₹{Math.abs(tx.amount).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedShiftForDetails(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
