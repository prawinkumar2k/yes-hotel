import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getStoredAuthToken } from "@/lib/authStorage";
import { format } from "date-fns";
import {
  Building2,
  LogIn,
  LogOut,
  BedDouble,
  Users,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Plus,
  UserCheck,
  Calendar,
} from "lucide-react";

export default function FrontDeskDashboard({ commandData: initialCommandData }: { commandData?: any }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"overview" | "arrivals" | "departures">("overview");

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const {
    data: commandData,
    isLoading,
    refetch,
    isRefetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["frontDeskCommandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    initialData: initialCommandData,
    refetchInterval: 30000,
  });

  const pulse = commandData?.hotelPulse || {};
  const arrivals: any[] = commandData?.arrivals || [];
  const departures: any[] = commandData?.departures || [];
  const inHouse: any = commandData?.inHouse || {};
  const actionQueue: any[] = commandData?.actionQueue || [];

  const lastUpdated = dataUpdatedAt ? format(new Date(dataUpdatedAt), "h:mm a") : "—";
  const occPct = pulse?.occupancyPct || 0;
  const ringColor = occPct >= 80 ? "#059669" : occPct >= 50 ? "#D97706" : "#64748b";

  return (
    <div className="max-w-[1600px] mx-auto pb-20 space-y-0">
      {/* ── TOP HEADER STRIP (Matches Admin Executive Command Center) ── */}
      <div className="flex items-start sm:items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Building2 size={12} className="text-amber-700" />
            <span className="font-semibold text-amber-800">YES HOTELS</span>
            <span>/</span>
            <span>Front Desk Command Center</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-slate-900">
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"},{" "}
            {user?.firstName || "Front Desk"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")} · Last synced {lastUpdated}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/guest-registration"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
          >
            <Plus size={14} className="stroke-[2.5]" />
            New Walk-In
          </Link>
          <Link
            to="/admin/check-in"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition"
          >
            <LogIn size={13} /> Check-In
          </Link>
          <Link
            to="/admin/check-out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition"
          >
            <LogOut size={13} /> Check-Out
          </Link>
          <button
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-200 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} /> Sync
          </button>
        </div>
      </div>

      {isLoading && !commandData ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm animate-pulse">
          Loading front desk operational data…
        </div>
      ) : (
        <>
          {/* ── SECTION A: OCCUPANCY & ROOM STATUS ───────────────────── */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Occupancy & Room Status
                </h2>
                <p className="text-xs text-slate-500">{pulse?.totalRooms || 0} total rooms</p>
              </div>
              <Link
                to="/admin/calendar"
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                Room Rack <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: "Occupied", sublabel: "In-House", value: pulse?.occupied || 0, icon: BedDouble, color: "green" },
                { label: "Available", sublabel: "Clean & Ready", value: pulse?.available || 0, icon: BedDouble, color: "blue" },
                { label: "Reserved", sublabel: "Upcoming", value: pulse?.reserved || 0, icon: Calendar, color: "purple" },
                { label: "Dirty", sublabel: "Turnover Req", value: pulse?.dirty || 0, icon: Sparkles, color: "amber" },
                { label: "Cleaning", sublabel: "In Progress", value: pulse?.cleaning || 0, icon: Sparkles, color: "blue" },
                { label: "Inspection", sublabel: "Verification", value: (pulse?.cleaningCompleted || 0) + (pulse?.inspection || 0), icon: CheckCircle2, color: "amber" },
                { label: "OOO", sublabel: "Out of Order", value: pulse?.ooo || 0, icon: AlertTriangle, color: "red" },
                { label: "OOS", sublabel: "Out of Service", value: pulse?.oos || 0, icon: AlertTriangle, color: "slate" },
              ].map(({ label, sublabel, value, icon: Icon, color }) => {
                const cs: Record<string, string> = {
                  green: "bg-emerald-50 border-emerald-200 text-emerald-700",
                  blue: "bg-blue-50 border-blue-200 text-blue-700",
                  purple: "bg-purple-50 border-purple-200 text-purple-700",
                  amber: "bg-amber-50 border-amber-200 text-amber-700",
                  red: "bg-red-50 border-red-200 text-red-600",
                  slate: "bg-slate-50 border-slate-200 text-slate-600",
                };

                return (
                  <div
                    key={label}
                    title={`${label}: ${sublabel}`}
                    className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between gap-1 shadow-xs transition hover:shadow-sm ${cs[color]}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">
                        {label}
                      </span>
                      <Icon size={13} className="opacity-60 shrink-0" />
                    </div>
                    <span className="text-2xl font-bold font-serif tabular-nums leading-none my-0.5">
                      {value}
                    </span>
                    <span className="text-[9px] font-semibold opacity-75 truncate leading-tight block">
                      {sublabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Occupancy Progress Bar */}
            <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-600">Occupancy</span>
                  <span className="text-xs font-bold text-slate-900">
                    {occPct}% · {pulse?.occupied || 0} of {pulse?.totalRooms || 0} rooms
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, occPct)}%`, backgroundColor: ringColor }}
                  />
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sellable: {pulse?.sellableRooms || 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300" /> Blocked: {pulse?.blocked || 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Awaiting Release: {pulse?.waitingRelease || 0}
                </span>
              </div>
            </div>
          </section>

          {/* ── SECTION B: GUEST MOVEMENT ────────────────────────────── */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-widest text-slate-600">
                  Guest Movement
                </h2>
                <p className="text-sm text-slate-600">Today's arrivals & departures</p>
              </div>
              <div className="ml-auto flex gap-1.5">
                {(["overview", "arrivals", "departures"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                      tab === t
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {tab === "overview" && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    label: "Exp. Arrivals",
                    value: inHouse?.stats?.expectedArrivals ?? arrivals.length,
                    icon: LogIn,
                    color: "green",
                    link: "/admin/check-in",
                  },
                  {
                    label: "Checked In",
                    value: inHouse?.stats?.actualArrivals || 0,
                    icon: UserCheck,
                    color: "green",
                    link: "/admin/check-in",
                  },
                  {
                    label: "Arrivals Pending",
                    value: Math.max(
                      0,
                      (inHouse?.stats?.expectedArrivals || arrivals.length) -
                        (inHouse?.stats?.actualArrivals || 0)
                    ),
                    icon: Clock,
                    color: "amber",
                    link: "/admin/check-in",
                  },
                  {
                    label: "Exp. Departures",
                    value: inHouse?.stats?.expectedDepartures ?? departures.length,
                    icon: LogOut,
                    color: "blue",
                    link: "/admin/check-out",
                  },
                  {
                    label: "Checked Out",
                    value: inHouse?.stats?.actualCheckouts || 0,
                    icon: CheckCircle2,
                    color: "blue",
                    link: "/admin/check-out",
                  },
                  {
                    label: "In-House",
                    value: inHouse?.stats?.inHouseStays ?? inHouse?.guests?.length ?? 0,
                    icon: Users,
                    color: "purple",
                    link: "/admin/in-house-list",
                  },
                ].map(({ label, value, icon: Icon, color, link }) => (
                  <Link
                    key={label}
                    to={link}
                    className="bg-white border-2 border-slate-200 rounded-2xl p-6 hover:border-amber-300 hover:shadow-md transition-all flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base uppercase tracking-wider font-bold text-slate-600">
                        {label}
                      </span>
                      <Icon
                        size={28}
                        className={
                          color === "green"
                            ? "text-emerald-500"
                            : color === "blue"
                            ? "text-blue-500"
                            : color === "purple"
                            ? "text-purple-500"
                            : "text-amber-500"
                        }
                      />
                    </div>
                    <span className="text-6xl font-bold font-serif tabular-nums text-slate-900 leading-none">
                      {value}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {tab === "arrivals" && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Today's Arrivals ({arrivals.length})
                  </span>
                  <Link
                    to="/admin/check-in"
                    className="text-xs text-amber-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    View All <ArrowRight size={11} />
                  </Link>
                </div>
                {arrivals.length === 0 ? (
                  <p className="text-center py-10 text-sm text-slate-400">No arrivals for today</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Reservation", "Guest", "Room Type", "Room", "Adults", "Source", "Status"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {arrivals.map((a: any) => (
                        <tr key={a._id} className="hover:bg-amber-50/40 transition">
                          <td className="px-4 py-3 font-mono font-bold text-amber-800">
                            {a.bookingReference || "—"}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {a.guestDetails?.firstName || a.guest?.fullName || a.guestName || "Guest"}{" "}
                            {a.guestDetails?.lastName || ""}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{a.roomCategoryName || "Standard"}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {a.assignedRoom?.roomNumber || (
                              <span className="text-slate-300">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{a.adults || 1}</td>
                          <td className="px-4 py-3 text-slate-500 capitalize">
                            {a.bookingSource || "Direct"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "departures" && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Today's Departures ({departures.length})
                  </span>
                  <Link
                    to="/admin/check-out"
                    className="text-xs text-amber-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    View All <ArrowRight size={11} />
                  </Link>
                </div>
                {departures.length === 0 ? (
                  <p className="text-center py-10 text-sm text-slate-400">No departures for today</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Reservation", "Guest", "Room", "Check-Out", "Status"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {departures.map((d: any) => (
                        <tr key={d._id} className="hover:bg-blue-50/40 transition">
                          <td className="px-4 py-3 font-mono font-bold text-blue-800">
                            {d.bookingReference || "—"}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {d.guestDetails?.firstName || d.guest?.fullName || d.guestName || "Guest"}{" "}
                            {d.guestDetails?.lastName || ""}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {d.assignedRoom?.roomNumber || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {d.checkOutDate ? format(new Date(d.checkOutDate), "h:mm a") : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>

          {/* ── SECTION C: ACTION QUEUE & IN-HOUSE GUESTS ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Action Queue */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Front Office Action Queue
                  </span>
                </div>
                {actionQueue.length > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold">
                    {actionQueue.length}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                {actionQueue.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">All clear — no pending front-office actions</p>
                  </div>
                ) : (
                  actionQueue.map((item: any, i: number) => (
                    <Link
                      key={i}
                      to={item.link || "#"}
                      className="block p-3 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.priority === "CRITICAL"
                              ? "bg-red-100 text-red-700"
                              : item.priority === "HIGH"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.priority}
                        </span>
                        <span className="text-xs text-slate-400">{item.entity}</span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{item.action}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* In-House Guests Preview */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Currently In-House ({inHouse?.guests?.length || 0})
                  </span>
                </div>
                <Link
                  to="/admin/in-house-list"
                  className="text-xs text-amber-700 font-semibold hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight size={11} />
                </Link>
              </div>

              <div className="flex-1 p-0 overflow-y-auto max-h-80">
                {!inHouse?.guests || inHouse.guests.length === 0 ? (
                  <p className="text-center py-12 text-sm text-slate-400">No guests currently in-house</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Guest", "Room", "Check-Out", "VIP"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {inHouse.guests.slice(0, 8).map((g: any) => (
                        <tr key={g._id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {g.guestDetails?.firstName} {g.guestDetails?.lastName}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-amber-700 font-mono">
                            {g.assignedRoom?.roomNumber || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {g.checkOutDate ? format(new Date(g.checkOutDate), "MMM d") : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {g.isVipGuest && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.5 rounded">
                                VIP
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION D: FRONT DESK QUICK ACTIONS ──────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "New Walk-In / Reservation",
                icon: Calendar,
                href: "/admin/guest-registration",
                color: "bg-amber-500 font-bold",
              },
              {
                label: "Quick Check-In",
                icon: LogIn,
                href: "/admin/check-in",
                color: "bg-emerald-500",
              },
              {
                label: "Quick Check-Out",
                icon: LogOut,
                href: "/admin/check-out",
                color: "bg-orange-500",
              },
              {
                label: "Guest Directory",
                icon: UserCheck,
                href: "/admin/guests",
                color: "bg-blue-500",
              },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className={`flex items-center gap-3 p-4 ${action.color} hover:opacity-90 text-white rounded-xl font-medium text-sm transition`}
              >
                <action.icon className="w-5 h-5" />
                {action.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
