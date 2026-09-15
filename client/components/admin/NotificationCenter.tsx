import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell, AlertTriangle, CheckCircle2, Clock, BedDouble,
  CreditCard, Wrench, X, ShieldAlert, ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getStoredAuthToken } from "@/lib/authStorage";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ open, onClose }: Props) {
  const navigate = useNavigate();

  const { data: summary } = useQuery({
    queryKey: ["notificationSummary"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/front-desk/summary", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30000,
  });

  const dirtyRoomsCount = summary?.counts?.dirtyRooms || 0;
  const unassignedCount = summary?.counts?.unassignedBookings || 0;
  const departuresWithBalance = (summary?.todaysDepartures || []).filter((d: any) => (d.totalAmount - (d.paidAmount || 0)) > 0);

  const totalAlerts = (dirtyRoomsCount > 0 ? 1 : 0) + (unassignedCount > 0 ? 1 : 0) + (departuresWithBalance.length > 0 ? 1 : 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#121316] text-white border-l border-white/10 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Operational Alerts</h3>
              <p className="text-xs text-zinc-400">Live hotel exceptions requiring attention</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {unassignedCount > 0 && (
            <div
              onClick={() => { onClose(); navigate("/admin/front-desk"); }}
              className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition flex items-start gap-3"
            >
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Unassigned Rooms</h4>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">{unassignedCount} Urgent</span>
                </div>
                <p className="text-xs text-zinc-300 mt-1">
                  {unassignedCount} confirmed reservation{unassignedCount > 1 ? "s" : ""} arriving without room allocation.
                </p>
                <div className="mt-2 text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                  Allocate in Front Desk <ChevronRight size={12} />
                </div>
              </div>
            </div>
          )}

          {dirtyRoomsCount > 0 && (
            <div
              onClick={() => { onClose(); navigate("/admin/housekeeping"); }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:border-red-500/40 cursor-pointer transition flex items-start gap-3"
            >
              <BedDouble className="text-red-400 shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">Housekeeping Queue</h4>
                  <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold">{dirtyRoomsCount} Dirty</span>
                </div>
                <p className="text-xs text-zinc-300 mt-1">
                  {dirtyRoomsCount} room{dirtyRoomsCount > 1 ? "s" : ""} pending cleaning and turnover before evening arrivals.
                </p>
                <div className="mt-2 text-[11px] font-semibold text-red-400 flex items-center gap-1">
                  Open Housekeeping Board <ChevronRight size={12} />
                </div>
              </div>
            </div>
          )}

          {departuresWithBalance.length > 0 && (
            <div
              onClick={() => { onClose(); navigate("/admin/check-out"); }}
              className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 cursor-pointer transition flex items-start gap-3"
            >
              <CreditCard className="text-blue-400 shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Folio Balance Due</h4>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">{departuresWithBalance.length} Guest{departuresWithBalance.length > 1 ? "s" : ""}</span>
                </div>
                <p className="text-xs text-zinc-300 mt-1">
                  Guests checking out today with unsettled folio lines requiring cashier settlement.
                </p>
                <div className="mt-2 text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                  Settle at Check-Out <ChevronRight size={12} />
                </div>
              </div>
            </div>
          )}

          {totalAlerts === 0 && (
            <div className="py-16 text-center text-zinc-500">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500/50 mb-3" />
              <p className="text-sm font-medium text-zinc-300">All Operations Clear</p>
              <p className="text-xs text-zinc-500 mt-1">No blocking alerts or overdue turnovers.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40 text-center">
          <Link
            to="/admin/dashboard"
            onClick={onClose}
            className="text-xs text-hotel-gold hover:text-champagne font-semibold transition"
          >
            View Full Operational Control Room &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
