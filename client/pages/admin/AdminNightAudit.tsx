import React, { useState, useEffect } from "react";
import { Moon, RefreshCw, CheckCircle2, AlertTriangle, Play, Calendar, ShieldCheck, Users, BedDouble } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getStoredAuthToken } from "@/lib/authStorage";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getStoredAuthToken()}`,
});

interface AuditStatusData {
  businessDate: string;
  isOpen: boolean;
  checklist: {
    pendingArrivals: number;
    pendingDepartures: number;
    inHouseGuests: number;
    dirtyRooms: number;
    openCashierShifts: number;
    isReadyForAudit: boolean;
  };
}

export default function AdminNightAudit() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AuditStatusData | null>(null);
  const [running, setRunning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/night-audit/status", { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast({ title: "Failed to load Night Audit status", description: json.message, variant: "destructive" });
      }
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
      const res = await fetch("/api/night-audit/run", { method: "POST", headers: getAuthHeaders() });
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

  const checklist = data?.checklist || {
    pendingArrivals: 0,
    pendingDepartures: 0,
    inHouseGuests: 0,
    dirtyRooms: 0,
    isReadyForAudit: false,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <Moon className="text-purple-600" /> Automated Night Audit & Business Date Engine
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            End-of-day operational closure, automated room charge posting, no-show processing & date rollover
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2 bg-hotel-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Audit Status
        </button>
      </div>

      {/* Current Business Date Banner */}
      <div className="bg-gradient-to-r from-purple-950 to-indigo-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-purple-300 font-semibold">Active Business Date</span>
          <h2 className="text-3xl font-serif font-bold mt-1 text-white">
            {data?.businessDate ? format(new Date(data.businessDate), "EEEE, MMMM dd, yyyy") : "Loading..."}
          </h2>
          <p className="text-xs text-purple-200 mt-2 flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" /> All posted transactions are linked to this operational date ledger
          </p>
        </div>

        <div className="flex items-center gap-4">
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            data?.isOpen ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-red-500/20 text-red-300 border border-red-500/40"
          }`}>
            {data?.isOpen ? "Business Date Open" : "Business Date Closed"}
          </span>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={!checklist.isReadyForAudit || running}
            className="flex items-center gap-2 px-6 py-3 bg-hotel-gold hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Play size={16} /> Execute Night Audit
          </button>
        </div>
      </div>

      {/* Pre-Audit Readiness Status */}
      {!checklist.isReadyForAudit && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-sm text-amber-900">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold">Pre-Audit Action Required</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Please process remaining pending arrivals ({checklist.pendingArrivals}) and departures ({checklist.pendingDepartures}) on the Front Desk Command Center before running the Night Audit.
            </p>
          </div>
        </div>
      )}

      {/* Audit Checklist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Arrivals */}
        <div className={`p-5 rounded-xl border bg-white shadow-sm space-y-2 ${checklist.pendingArrivals === 0 ? "border-emerald-200" : "border-amber-300"}`}>
          <div className="flex justify-between items-center text-gray-500">
            <span className="text-xs font-semibold uppercase">Pending Arrivals</span>
            {checklist.pendingArrivals === 0 ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{checklist.pendingArrivals}</p>
          <p className="text-xs text-gray-500">Expected guests not yet checked in</p>
        </div>

        {/* Pending Departures */}
        <div className={`p-5 rounded-xl border bg-white shadow-sm space-y-2 ${checklist.pendingDepartures === 0 ? "border-emerald-200" : "border-amber-300"}`}>
          <div className="flex justify-between items-center text-gray-500">
            <span className="text-xs font-semibold uppercase">Pending Departures</span>
            {checklist.pendingDepartures === 0 ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{checklist.pendingDepartures}</p>
          <p className="text-xs text-gray-500">Checked-in guests due for checkout</p>
        </div>

        {/* Active In-House Guests */}
        <div className="p-5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-purple-600">
            <span className="text-xs font-semibold uppercase">In-House Guests</span>
            <Users size={18} />
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{checklist.inHouseGuests}</p>
          <p className="text-xs text-gray-500">Nightly tariff will be posted to folios</p>
        </div>

        {/* Dirty Rooms */}
        <div className="p-5 rounded-xl border border-gray-200 bg-white shadow-sm space-y-2">
          <div className="flex justify-between items-center text-gray-500">
            <span className="text-xs font-semibold uppercase">Dirty Rooms</span>
            <BedDouble size={18} />
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{checklist.dirtyRooms}</p>
          <p className="text-xs text-gray-500">Rooms awaiting housekeeping turnover</p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <h3 className="font-serif font-bold text-gray-900 text-lg flex items-center gap-2">
              <Moon className="text-purple-600" /> Confirm Night Audit Execution
            </h3>
            <p className="text-sm text-gray-600">
              Executing Night Audit will:
            </p>
            <ul className="text-xs text-gray-700 space-y-1.5 list-disc pl-5">
              <li>Post room tariff & tax lines to <strong>{checklist.inHouseGuests} in-house stay folios</strong>.</li>
              <li>Auto-cancel remaining un-arrived reservations as NO_SHOW.</li>
              <li>Close current business date and roll forward to tomorrow.</li>
            </ul>

            <div className="flex gap-3 pt-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRunAudit}
                disabled={running}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50"
              >
                {running ? "Executing Audit..." : "Run Audit & Roll Date"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
