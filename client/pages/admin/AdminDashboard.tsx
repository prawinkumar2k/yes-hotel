import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BedDouble, TrendingUp, DollarSign, Users, AlertCircle, LogIn, LogOut,
  Sparkles, Wrench, RefreshCw, CalendarDays, ArrowUpRight, ArrowDownRight,
  ShieldCheck, Clock, CheckCircle2, ChevronRight, Eye, Phone, CreditCard,
  Building2, UtensilsCrossed, Moon, Plus
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, BarChart, Bar, Cell
} from "recharts";
import { getStoredAuthToken } from "@/lib/authStorage";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 1. Executive Summary KPIs
  const { data: execSummary, isLoading: loadingExec, refetch: refetchExec } = useQuery({
    queryKey: ["adminExecSummary"],
    queryFn: async () => {
      const res = await fetch("/api/reports/executive-summary", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 45000,
  });

  // 2. Front Desk Summary (Today's operational pulse)
  const { data: fdSummary, isLoading: loadingFd, refetch: refetchFd } = useQuery({
    queryKey: ["adminFrontDeskPulse"],
    queryFn: async () => {
      const res = await fetch("/api/front-desk/summary", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30000,
  });

  // 3. Revenue & ADR Trend (Last 14 days)
  const { data: revenueTrend = [] } = useQuery({
    queryKey: ["adminRevenueTrend"],
    queryFn: async () => {
      const res = await fetch("/api/reports/revenue-trend?days=14", { headers: getHeaders() });
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    },
  });

  // 4. Department P&L Distribution
  const { data: deptPL } = useQuery({
    queryKey: ["adminDeptPL"],
    queryFn: async () => {
      const res = await fetch("/api/reports/department-pl", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
  });

  // 5. Room Rack Matrix Snapshot
  const { data: roomRack } = useQuery({
    queryKey: ["adminRoomMatrix"],
    queryFn: async () => {
      const res = await fetch("/api/room-rack", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 60000,
  });

  const handleRefreshAll = () => {
    refetchExec();
    refetchFd();
  };

  const fmtCurrency = (n: number) => {
    if (!n) return "₹0";
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  // Extract metrics
  const occupancyPct = execSummary?.occupancyPct ?? Math.round(((execSummary?.inHouseCount || 0) / Math.max(1, execSummary?.totalRooms || 24)) * 100);
  const adr = execSummary?.adr ?? 0;
  const revPAR = execSummary?.revPAR ?? 0;
  const todayRevenue = execSummary?.todayRevenue ?? 0;
  const mtdRevenue = execSummary?.mtdRevenue ?? 0;

  const arrivals = fdSummary?.todaysArrivals || [];
  const departures = fdSummary?.todaysDepartures || [];
  const inHouse = fdSummary?.inHouse || [];
  const dirtyRooms = fdSummary?.dirtyRooms || [];
  const vipArrivals = arrivals.filter((a: any) => a.isVipGuest);

  const floors = roomRack?.floors || [];

  return (
    <AdminLayout title="Executive Command Center">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Top Control Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#15171c] via-[#1a1d24] to-[#121316] border border-white/10 p-6 shadow-2xl">
          <div className="absolute right-0 top-0 w-96 h-96 bg-hotel-gold/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-hotel-gold/15 text-hotel-gold border border-hotel-gold/30">
                  ✦ Hotel Flight Deck
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  Operational Date: {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Welcome, {user?.firstName || "General Manager"}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                Live operational status across all suites, front desk queues, revenue performance, and housekeeping lifecycles.
              </p>
            </div>

            {/* Quick Action Matrix on Banner */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={handleRefreshAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-semibold transition"
              >
                <RefreshCw size={14} className={loadingExec || loadingFd ? "animate-spin text-hotel-gold" : ""} />
                <span>Sync Live State</span>
              </button>
              <Link
                to="/admin/check-in"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
              >
                <LogIn size={14} />
                <span>Express Check-In</span>
              </Link>
              <Link
                to="/admin/room-rack"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-hotel-gold text-black hover:bg-champagne text-xs font-bold transition shadow-sm"
              >
                <BedDouble size={14} />
                <span>Open Room Rack</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Primary Operational KPI Fleet */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Occupancy */}
          <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-hotel-gold/40 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Occupancy</span>
              <BedDouble size={16} className="text-hotel-gold" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-2xl font-bold text-white">{occupancyPct}%</span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {execSummary?.inHouseCount || inHouse.length} / {execSummary?.totalRooms || 24} rooms
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-hotel-gold to-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, occupancyPct)}%` }}
              />
            </div>
          </div>

          {/* ADR */}
          <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-hotel-gold/40 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">ADR (Avg Rate)</span>
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-2xl font-bold text-white">₹{Math.round(adr).toLocaleString("en-IN")}</span>
            </div>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-2">
              <ArrowUpRight size={12} /> Realized average rate
            </p>
          </div>

          {/* RevPAR */}
          <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-hotel-gold/40 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">RevPAR</span>
              <DollarSign size={16} className="text-purple-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-2xl font-bold text-white">₹{Math.round(revPAR).toLocaleString("en-IN")}</span>
            </div>
            <p className="text-[10px] text-purple-400 mt-2">Per available room</p>
          </div>

          {/* Revenue Today */}
          <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-hotel-gold/40 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Today's Rev</span>
              <DollarSign size={16} className="text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-2xl font-bold text-white">{fmtCurrency(todayRevenue)}</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-2 font-mono">MTD: {fmtCurrency(mtdRevenue)}</p>
          </div>

          {/* Arrivals Pulse */}
          <div
            onClick={() => navigate("/admin/front-desk")}
            className="bg-[#121316] rounded-xl border border-white/10 p-4 cursor-pointer hover:border-emerald-500/40 transition group"
          >
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Arrivals</span>
              <LogIn size={16} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-2xl font-bold text-white">{arrivals.length}</span>
              <span className="text-[10px] text-zinc-400">Expected</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-emerald-400/80">
              <span>{vipArrivals.length} VIP Guest{vipArrivals.length > 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Housekeeping Turnovers */}
          <div
            onClick={() => navigate("/admin/housekeeping")}
            className="bg-[#121316] rounded-xl border border-white/10 p-4 cursor-pointer hover:border-red-500/40 transition group"
          >
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">HK Queue</span>
              <Sparkles size={16} className="text-red-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-2xl font-bold text-white">{dirtyRooms.length}</span>
              <span className="text-[10px] text-red-400 font-semibold">Dirty</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-2">Turnover in progress</p>
          </div>
        </div>

        {/* Analytics & Spatial Floor Matrix Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Revenue & ADR Trend (7 Cols) */}
          <div className="lg:col-span-7 bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-base text-white flex items-center gap-2">
                  <TrendingUp className="text-hotel-gold" size={18} /> Revenue & ADR Trajectory
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Realized stay revenue & ADR across past 14 business cycles</p>
              </div>
              <Link to="/admin/reports" className="text-xs text-hotel-gold hover:underline flex items-center gap-1 font-semibold">
                Full Analytics <ChevronRight size={14} />
              </Link>
            </div>

            <div className="h-64 w-full mt-2">
              {revenueTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="goldRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A227" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#C9A227" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      stroke="#71717a"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis
                      stroke="#71717a"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: 8, fontSize: 12, color: "#fff" }}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#C9A227"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#goldRevenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                  Awaiting operational trend aggregation...
                </div>
              )}
            </div>
          </div>

          {/* Floor-by-Floor Mini Room Matrix (5 Cols) */}
          <div className="lg:col-span-5 bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-serif font-bold text-base text-white flex items-center gap-2">
                    <BedDouble className="text-hotel-gold" size={18} /> Floor Room Matrix
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Live status map of all floors & suites</p>
                </div>
                <Link to="/admin/room-rack" className="text-xs text-hotel-gold hover:underline flex items-center gap-1 font-semibold">
                  Full Rack <ChevronRight size={14} />
                </Link>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap gap-2.5 text-[10px] mb-4 p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Occupied
                </span>
                <span className="flex items-center gap-1 text-hotel-gold">
                  <span className="w-2 h-2 rounded-full bg-hotel-gold" /> Clean & Ready
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Dirty
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Cleaning
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-zinc-600" /> OOO / Blocked
                </span>
              </div>

              {/* Floor Rows */}
              <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
                {floors.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">Loading room matrices...</p>
                ) : (
                  floors.map((floor: any) => (
                    <div key={floor.floor} className="space-y-1.5">
                      <span className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase font-mono">
                        Floor {floor.floor}
                      </span>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                        {floor.rooms?.map((r: any) => {
                          let bgColor = "bg-hotel-gold/15 text-hotel-gold border-hotel-gold/30"; // Clean default
                          if (r.occupancyStatus === "OCCUPIED") {
                            bgColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
                          } else if (r.sellStatus !== "SELLABLE") {
                            bgColor = "bg-zinc-800 text-zinc-400 border-zinc-700";
                          } else if (r.housekeepingStatus === "DIRTY") {
                            bgColor = "bg-red-500/20 text-red-400 border-red-500/30";
                          } else if (r.housekeepingStatus === "CLEANING") {
                            bgColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
                          }

                          return (
                            <Link
                              key={r._id}
                              to="/admin/room-rack"
                              className={`p-1.5 rounded-lg border text-center font-mono text-xs font-bold transition hover:scale-105 ${bgColor}`}
                              title={`Room ${r.roomNumber}: ${r.occupancyStatus} · ${r.housekeepingStatus}`}
                            >
                              {r.roomNumber}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>Total Inventory: {roomRack?.totalRooms || 24} Rooms</span>
              <span className="text-hotel-gold font-semibold">Click room to inspect & assign</span>
            </div>
          </div>
        </div>

        {/* Live Operations Split Panels: Arrivals, Departures & In-House */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Expected Arrivals */}
          <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <LogIn size={18} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">Expected Arrivals</h3>
                  <p className="text-[11px] text-zinc-400">Check-ins due today ({arrivals.length})</p>
                </div>
              </div>
              <Link to="/admin/check-in" className="text-xs text-emerald-400 hover:underline font-semibold">
                Check In &rarr;
              </Link>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
              {arrivals.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-10">No pending arrivals for today.</p>
              ) : (
                arrivals.slice(0, 5).map((a: any) => (
                  <div
                    key={a._id}
                    className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-emerald-500/30 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-white truncate">
                          {a.guestDetails?.firstName} {a.guestDetails?.lastName}
                        </span>
                        {a.isVipGuest && (
                          <span className="text-[9px] bg-hotel-gold/20 text-hotel-gold px-1.5 py-0.5 rounded font-bold">
                            VIP
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                        Ref: #{a.bookingReference}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {a.assignedRoom ? (
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Room {a.assignedRoom.roomNumber}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Today's Expected Departures */}
          <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <LogOut size={18} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">Expected Departures</h3>
                  <p className="text-[11px] text-zinc-400">Check-outs due today ({departures.length})</p>
                </div>
              </div>
              <Link to="/admin/check-out" className="text-xs text-blue-400 hover:underline font-semibold">
                Settle &rarr;
              </Link>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
              {departures.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-10">No pending departures for today.</p>
              ) : (
                departures.slice(0, 5).map((d: any) => {
                  const balance = (d.totalAmount || 0) - (d.paidAmount || 0);
                  return (
                    <div
                      key={d._id}
                      className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-blue-500/30 transition flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-xs text-white truncate block">
                          {d.guestDetails?.firstName} {d.guestDetails?.lastName}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {d.assignedRoom ? `Room ${d.assignedRoom.roomNumber}` : `#${d.bookingReference}`}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        {balance > 0 ? (
                          <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 font-bold block">
                            ₹{balance.toLocaleString("en-IN")} Due
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold block">
                            Settled
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* In-House VIPs & Stay Focus */}
          <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">In-House Guests</h3>
                  <p className="text-[11px] text-zinc-400">Active resident guests ({inHouse.length})</p>
                </div>
              </div>
              <Link to="/admin/in-house-list" className="text-xs text-hotel-gold hover:underline font-semibold">
                Guest Log &rarr;
              </Link>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
              {inHouse.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-10">No guests currently in-house.</p>
              ) : (
                inHouse.slice(0, 5).map((h: any) => (
                  <div
                    key={h._id}
                    className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-hotel-gold/30 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs text-white truncate">
                          {h.guestDetails?.firstName} {h.guestDetails?.lastName}
                        </span>
                        {h.isVipGuest && (
                          <span className="text-[9px] bg-hotel-gold/20 text-hotel-gold px-1.5 py-0.5 rounded font-bold">
                            VIP
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                        Stay: until {format(new Date(h.checkOutDate), "dd MMM")}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-hotel-gold bg-hotel-gold/10 px-2 py-0.5 rounded border border-hotel-gold/20">
                        Room {h.assignedRoom?.roomNumber || "—"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Live Operational Control Hub Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            to="/admin/pos"
            className="p-4 rounded-xl bg-gradient-to-br from-[#18191f] to-[#121316] border border-white/10 hover:border-purple-500/40 transition group flex items-center gap-3"
          >
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition">
              <UtensilsCrossed size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white tracking-wide">Restaurant POS & KDS</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Kitchen display & orders</p>
            </div>
          </Link>

          <Link
            to="/admin/advances"
            className="p-4 rounded-xl bg-gradient-to-br from-[#18191f] to-[#121316] border border-white/10 hover:border-amber-500/40 transition group flex items-center gap-3"
          >
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition">
              <CreditCard size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white tracking-wide">Advance Payments</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Deposits & adjustments</p>
            </div>
          </Link>

          <Link
            to="/admin/cashier-shifts"
            className="p-4 rounded-xl bg-gradient-to-br from-[#18191f] to-[#121316] border border-white/10 hover:border-emerald-500/40 transition group flex items-center gap-3"
          >
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition">
              <DollarSign size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white tracking-wide">Cashier Shift Drawer</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Float & drawer balance</p>
            </div>
          </Link>

          <Link
            to="/admin/night-audit"
            className="p-4 rounded-xl bg-gradient-to-br from-[#18191f] to-[#121316] border border-white/10 hover:border-blue-500/40 transition group flex items-center gap-3"
          >
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition">
              <Moon size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white tracking-wide">Night Audit Control</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Automated date rollover</p>
            </div>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
