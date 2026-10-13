import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { getStoredAuthToken } from "@/lib/authStorage";
import { Link } from "react-router-dom";
import {
  BedDouble, Users, LogIn, LogOut, DollarSign, Sparkles, Wrench,
  TrendingUp, Wallet, RefreshCw, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, Building2, ArrowRight, Activity, BarChart2,
  ShieldAlert, Calendar, Banknote, ReceiptText, UserCheck, FileText
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { FrontDeskDashboard } from "@/components/admin/command-center/roles/FrontDeskDashboard";
import { HousekeepingDashboard } from "@/components/admin/command-center/roles/HousekeepingDashboard";
import { MaintenanceDashboard } from "@/components/admin/command-center/roles/MaintenanceDashboard";
import { format } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n || 0);

const num = (n: number) =>
  new Intl.NumberFormat("en-IN").format(n || 0);

function StatBadge({ label, value, color = "slate" }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{label}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors[color] || colors.slate}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle, link, linkLabel }: {
  title: string; subtitle?: string; link?: string; linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {link && linkLabel && (
        <Link to={link} className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition">
          {linkLabel} <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, iconColor = "text-amber-700", onClick }: {
  label: string; value: string | number; sub?: string;
  icon: any; iconColor?: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-sm hover:border-amber-200 transition-all text-left w-full group"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest font-bold text-slate-400">{label}</span>
        <Icon size={15} className={`${iconColor} opacity-70 group-hover:opacity-100 transition`} />
      </div>
      <div className="text-2xl font-bold text-slate-900 font-serif tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 font-medium leading-tight">{sub}</div>}
    </button>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700 border border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border border-orange-200",
    MEDIUM: "bg-amber-100 text-amber-700 border border-amber-200",
    LOW: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${map[p] || map.LOW}`}>{p}</span>;
}

function StatusDot({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s?.includes("CLEAN") || s === "AVAILABLE") return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />;
  if (s === "DIRTY" || s?.includes("FAIL") || s === "CRITICAL") return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />;
  if (s?.includes("CLEAN") || s?.includes("ASSIGN")) return <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />;
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const { hasPageAccess } = usePermissions();
  const [tab, setTab] = useState<"overview" | "arrivals" | "departures">("overview");

  const isExecutive = hasPageAccess("DASHBOARD.ADMIN");
  const isFrontDesk = hasPageAccess("DASHBOARD.FRONT_DESK");
  const isHousekeeping = hasPageAccess("DASHBOARD.HOUSEKEEPING");
  const isMaintenance = hasPageAccess("DASHBOARD.MAINTENANCE");
  const hasAnyAccess = isExecutive || isFrontDesk || isHousekeeping || isMaintenance;

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: D, isLoading, refetch, isRefetching, dataUpdatedAt } = useQuery({
    queryKey: ["commandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: hasAnyAccess,
    refetchInterval: 30000,
  });

  if (!hasAnyAccess) {
    return (
      <AdminLayout title="Dashboard">
        <div className="p-10 flex justify-center text-slate-400 text-sm">Operations command center requires staff clearance.</div>
      </AdminLayout>
    );
  }

  if (isFrontDesk && !isExecutive) return <AdminLayout title="Front Desk Dashboard"><FrontDeskDashboard commandData={D} /></AdminLayout>;
  if (isHousekeeping && !isExecutive) return <AdminLayout title="Housekeeping Dashboard"><HousekeepingDashboard commandData={D} /></AdminLayout>;
  if (isMaintenance && !isExecutive) return <AdminLayout title="Maintenance Dashboard"><MaintenanceDashboard commandData={D} /></AdminLayout>;

  // Derived values
  const pulse = D?.hotelPulse;
  const rev = D?.revenue;
  const adv = D?.advances;
  const hk = D?.housekeeping;
  const mt = D?.maintenance;
  const inHouse: any = D?.inHouse;
  const arrivals: any[] = D?.arrivals || [];
  const departures: any[] = D?.departures || [];
  const forecast: any[] = D?.forecast || [];
  const revTrend: any[] = D?.revenueTrend || [];
  const sources: any[] = D?.bookingSources || [];
  const actionQueue: any[] = D?.actionQueue || [];
  const activity: any[] = D?.recentActivity || [];

  const lastUpdated = dataUpdatedAt ? format(new Date(dataUpdatedAt), "h:mm a") : "—";

  // Occupancy ring
  const occPct = pulse?.occupancyPct || 0;
  const ringColor = occPct >= 80 ? "#059669" : occPct >= 50 ? "#D97706" : "#64748b";

  return (
    <AdminLayout title="Executive Command Center">
      <div className="max-w-[1600px] mx-auto pb-20 space-y-0">

        {/* ── TOP HEADER STRIP ──────────────────────────────────────── */}
        <div className="flex items-start sm:items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Building2 size={12} className="text-amber-700" />
              <span className="font-semibold text-amber-800">YES HOTELS</span>
              <span>/</span>
              <span>Executive Command Center</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-slate-900">
              Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {user?.firstName || "Executive"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {format(new Date(), "EEEE, MMMM d, yyyy")} · Last synced {lastUpdated}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/check-in" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition">
              <LogIn size={13} /> Check-In
            </Link>
            <Link to="/admin/check-out" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition">
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

        {isLoading && !D ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm animate-pulse">Loading operational data…</div>
        ) : (
          <>
            {/* ── SECTION A: OCCUPANCY & ROOMS ───────────────────────── */}
            <section className="mb-8">
              <SectionHeader title="Occupancy & Room Status" subtitle={`${pulse?.totalRooms || 0} total rooms`} link="/admin/calendar" linkLabel="Room Rack" />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                  { label: "Occupied", sublabel: "In-House", value: pulse?.occupied || 0, icon: BedDouble, color: "green" as const },
                  { label: "Available", sublabel: "Clean & Ready", value: pulse?.available || 0, icon: BedDouble, color: "blue" as const },
                  { label: "Reserved", sublabel: "Upcoming", value: pulse?.reserved || 0, icon: Calendar, color: "purple" as const },
                  { label: "Dirty", sublabel: "Turnover Req", value: pulse?.dirty || 0, icon: Sparkles, color: "amber" as const },
                  { label: "Cleaning", sublabel: "In Progress", value: pulse?.cleaning || 0, icon: Sparkles, color: "blue" as const },
                  { label: "Inspection", sublabel: "Verification", value: (pulse?.cleaningCompleted || 0) + (pulse?.inspection || 0), icon: CheckCircle2, color: "amber" as const },
                  { label: "OOO", sublabel: "Out of Order", value: pulse?.ooo || 0, icon: AlertTriangle, color: "red" as const },
                  { label: "OOS", sublabel: "Out of Service", value: pulse?.oos || 0, icon: AlertTriangle, color: "slate" as const },
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
                    <div key={label} title={`${label}: ${sublabel}`} className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between gap-1 shadow-xs transition hover:shadow-sm ${cs[color]}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                        <Icon size={13} className="opacity-60 shrink-0" />
                      </div>
                      <span className="text-2xl font-bold font-serif tabular-nums leading-none my-0.5">{value}</span>
                      <span className="text-[9px] font-semibold opacity-75 truncate leading-tight block">
                        {sublabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Occupancy progress bar */}
              <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-600">Occupancy</span>
                    <span className="text-xs font-bold text-slate-900">{occPct}% · {pulse?.occupied || 0} of {pulse?.totalRooms || 0} rooms</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, occPct)}%`, backgroundColor: ringColor }}
                    />
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Sellable: {pulse?.sellableRooms || 0}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" /> Blocked: {pulse?.blocked || 0}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Awaiting Release: {pulse?.waitingRelease || 0}</span>
                </div>
              </div>
            </section>

            {/* ── SECTION B: GUEST MOVEMENT ──────────────────────────── */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Guest Movement</h2>
                  <p className="text-xs text-slate-500">Today's arrivals & departures</p>
                </div>
                <div className="ml-auto flex gap-1.5">
                  {(["overview", "arrivals", "departures"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${tab === t ? "bg-amber-100 text-amber-800 border border-amber-200" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "overview" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Exp. Arrivals", value: inHouse?.stats?.expectedArrivals ?? arrivals.length, icon: LogIn, color: "green" as const, link: "/admin/check-in" },
                    { label: "Checked In", value: inHouse?.stats?.actualArrivals || 0, icon: UserCheck, color: "green" as const, link: "/admin/check-in" },
                    { label: "Arrivals Pending", value: Math.max(0, (inHouse?.stats?.expectedArrivals || 0) - (inHouse?.stats?.actualArrivals || 0)), icon: Clock, color: "amber" as const, link: "/admin/check-in" },
                    { label: "Exp. Departures", value: inHouse?.stats?.expectedDepartures || 0, icon: LogOut, color: "blue" as const, link: "/admin/check-out" },
                    { label: "Checked Out", value: inHouse?.stats?.actualCheckouts || 0, icon: CheckCircle2, color: "blue" as const, link: "/admin/check-out" },
                    { label: "In-House", value: inHouse?.stats?.inHouseStays ?? inHouse?.guests?.length ?? 0, icon: Users, color: "purple" as const, link: "/admin/in-house-list" },
                  ].map(({ label, value, icon: Icon, color, link }) => (
                    <Link key={label} to={link} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-200 hover:shadow-sm transition-all flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</span>
                        <Icon size={14} className={color === "green" ? "text-emerald-500" : color === "blue" ? "text-blue-500" : color === "purple" ? "text-purple-500" : "text-amber-500"} />
                      </div>
                      <span className="text-2xl font-bold font-serif tabular-nums text-slate-900">{value}</span>
                    </Link>
                  ))}
                </div>
              )}

              {tab === "overview" && inHouse?.stats && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                  {/* Day use / hourly stays */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Day Use (Hourly)</span>
                      <Clock size={14} className="text-amber-500" />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        ["In-House", inHouse.stats.dayUse?.inHouse ?? 0],
                        ["Arriving", inHouse.stats.dayUse?.arrivalsToday ?? 0],
                        ["Checked Out", inHouse.stats.dayUse?.checkedOutToday ?? 0],
                        ["Booked Today", inHouse.stats.dayUse?.bookedToday ?? 0],
                      ].map(([k, v]) => (
                        <div key={k as string}>
                          <div className="text-xl font-bold font-serif tabular-nums text-slate-900">{v as number}</div>
                          <div className="text-[10px] font-semibold text-slate-500">{k as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Today's bookings by kind */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Bookings Made Today</span>
                      <span className="text-xl font-bold font-serif tabular-nums text-slate-900">{inHouse.stats.bookingsTodayTotal ?? 0}</span>
                    </div>
                    {Object.keys(inHouse.stats.bookingsToday ?? {}).length === 0 ? (
                      <p className="text-xs text-slate-400">No bookings made today yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(inHouse.stats.bookingsToday as Record<string, number>)
                          .sort((a, b) => b[1] - a[1])
                          .map(([source, count]) => (
                            <span key={source} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                              {source.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                              <span className="font-bold text-slate-900 tabular-nums">{count}</span>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "arrivals" && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Today's Arrivals ({arrivals.length})</span>
                    <Link to="/admin/check-in" className="text-xs text-amber-700 font-semibold hover:underline flex items-center gap-1">View All <ArrowRight size={11} /></Link>
                  </div>
                  {arrivals.length === 0 ? (
                    <p className="text-center py-10 text-sm text-slate-400">No arrivals for today</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Reservation", "Guest", "Room Type", "Room", "Adults", "Source", "Status"].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {arrivals.map((a: any) => (
                          <tr key={a._id} className="hover:bg-amber-50/40 transition">
                            <td className="px-4 py-3 font-mono font-bold text-amber-800">{a.bookingReference || "—"}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{a.guestDetails?.firstName} {a.guestDetails?.lastName}</td>
                            <td className="px-4 py-3 text-slate-500">{a.roomCategoryName || "Standard"}</td>
                            <td className="px-4 py-3 font-bold text-slate-700">{a.assignedRoom?.roomNumber || <span className="text-slate-300">Unassigned</span>}</td>
                            <td className="px-4 py-3 text-slate-500">{a.adults || 1}</td>
                            <td className="px-4 py-3 text-slate-500 capitalize">{a.bookingSource || "Direct"}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">{a.status}</span>
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
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Today's Departures ({departures.length})</span>
                    <Link to="/admin/check-out" className="text-xs text-amber-700 font-semibold hover:underline flex items-center gap-1">View All <ArrowRight size={11} /></Link>
                  </div>
                  {departures.length === 0 ? (
                    <p className="text-center py-10 text-sm text-slate-400">No departures for today</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Reservation", "Guest", "Room", "Check-Out", "Status"].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {departures.map((d: any) => (
                          <tr key={d._id} className="hover:bg-blue-50/40 transition">
                            <td className="px-4 py-3 font-mono font-bold text-blue-800">{d.bookingReference || "—"}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{d.guestDetails?.firstName} {d.guestDetails?.lastName}</td>
                            <td className="px-4 py-3 font-bold text-slate-700">{d.assignedRoom?.roomNumber || "—"}</td>
                            <td className="px-4 py-3 text-slate-500">{d.checkOutDate ? format(new Date(d.checkOutDate), "h:mm a") : "—"}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">{d.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>

            {/* ── SECTION C: FINANCIAL OVERVIEW ─────────────────────── */}
            {rev && (
              <section className="mb-8">
                <SectionHeader title="Financial Overview" subtitle="Realized payments & balances" link="/admin/reports" linkLabel="Full Reports" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KPICard label="Today's Revenue" value={fmt(rev.todayRevenue)} sub="Realized gross" icon={Banknote} iconColor="text-emerald-600" />
                  <KPICard label="Monthly Revenue" value={fmt(rev.monthlyRevenue)} sub="Month to date" icon={TrendingUp} iconColor="text-blue-600" />
                  <KPICard label="ADR" value={fmt(rev.adr)} sub="Avg daily rate" icon={DollarSign} iconColor="text-amber-700" />
                  <KPICard label="RevPAR" value={fmt(rev.revPar)} sub="Rev per avail. room" icon={BarChart2} iconColor="text-purple-600" />
                  <KPICard label="Open Folios" value={rev.pendingFolios || 0} sub="With outstanding balance" icon={FileText} iconColor="text-orange-600" />
                  <KPICard label="Open Shifts" value={rev.openCashierShifts || 0} sub="Cashier shifts" icon={Activity} iconColor="text-slate-500" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3">Payments by Method</p>
                    <div className="space-y-2">
                      {[
                        { m: "Cash", v: rev.todayCash, color: "bg-emerald-500" },
                        { m: "Card", v: rev.todayCard, color: "bg-blue-500" },
                        { m: "UPI", v: rev.todayUPI, color: "bg-purple-500" },
                        { m: "Gateway", v: rev.todayGateway, color: "bg-amber-500" },
                      ].map(({ m, v, color }) => {
                        const total = rev.todayRevenue || 1;
                        const pct = Math.round((v / total) * 100);
                        return (
                          <div key={m} className="flex items-center gap-2">
                            <span className="w-16 text-[11px] text-slate-500 font-medium shrink-0">{m}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 tabular-nums w-16 text-right shrink-0">{fmt(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {adv && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Advance Payments</p>
                        <Link to="/admin/advances" className="text-[11px] text-amber-700 font-semibold hover:underline">Ledger →</Link>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { label: "Held (Unapplied)", value: fmt(adv.held), color: "text-amber-700" },
                          { label: "Received Today", value: fmt(adv.receivedToday), color: "text-emerald-700" },
                          { label: "Applied", value: fmt(adv.applied), color: "text-blue-600" },
                          { label: "Refunded", value: fmt(adv.refunded), color: "text-slate-500" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{label}</span>
                            <span className={`text-xs font-bold ${color}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
                    <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-3">Revenue Trend (7 Days)</p>
                    {revTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={110}>
                        <AreaChart data={revTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#D97706" stopOpacity={0.15} />
                              <stop offset="100%" stopColor="#D97706" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                            formatter={(v: any) => [fmt(v), "Revenue"]}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#D97706" strokeWidth={2} fill="url(#revGrad)" dot={{ r: 3, fill: "#D97706" }} />
                          <Area type="monotone" dataKey="expected" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" fill="none" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-8">No revenue data for this period</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ── SECTION D: HOUSEKEEPING & MAINTENANCE ─────────────── */}
            <section className="mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Housekeeping */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-500" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Housekeeping</h3>
                        <p className="text-[11px] text-slate-400">{hk?.pending || 0} tasks active</p>
                      </div>
                    </div>
                    <Link to="/admin/housekeeping" className="text-xs text-blue-600 font-semibold hover:underline">Manage →</Link>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                    {[
                      { label: "Unassigned", value: hk?.dirty || 0, color: "text-red-600" },
                      { label: "Cleaning", value: hk?.cleaning || 0, color: "text-blue-600" },
                      { label: "Inspection", value: (hk?.completed || 0) + (hk?.inspection || 0), color: "text-amber-600" },
                      { label: "Awaiting Rel.", value: hk?.waitingRelease || 0, color: "text-purple-600" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="p-3 text-center">
                        <p className={`text-xl font-bold font-serif ${color}`}>{value}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                    {(!hk?.tasks || hk.tasks.length === 0) ? (
                      <p className="text-center py-8 text-sm text-slate-400">All rooms clean ✓</p>
                    ) : hk.tasks.map((t: any) => (
                      <div key={t._id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <StatusDot status={t.status} />
                          <div>
                            <p className="text-xs font-bold text-slate-800">Room {t.room?.roomNumber || "—"}</p>
                            <p className="text-[10px] text-slate-400">{t.taskType || t.type}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Maintenance */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench size={16} className="text-orange-500" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Maintenance</h3>
                        <p className="text-[11px] text-slate-400">{mt?.open || 0} open tickets</p>
                      </div>
                    </div>
                    <Link to="/admin/maintenance" className="text-xs text-orange-600 font-semibold hover:underline">Manage →</Link>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                    {[
                      { label: "Critical", value: mt?.critical || 0, color: "text-red-600" },
                      { label: "High / Med", value: (mt?.high || 0) + (mt?.medium || 0), color: "text-orange-600" },
                      { label: "Total Open", value: mt?.open || 0, color: "text-slate-700" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="p-3 text-center">
                        <p className={`text-xl font-bold font-serif ${color}`}>{value}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                    {(!mt?.tickets || mt.tickets.length === 0) ? (
                      <p className="text-center py-8 text-sm text-slate-400">No active maintenance issues ✓</p>
                    ) : mt.tickets.map((t: any) => (
                      <div key={t._id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Room {t.room?.roomNumber || "—"}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{t.issueDescription || t.description}</p>
                        </div>
                        <PriorityBadge p={t.priority || "LOW"} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── SECTION E: ANALYTICS CHARTS ────────────────────────── */}
            <section className="mb-8">
              <SectionHeader title="Analytics" subtitle="Booking sources & 7-day forecast" link="/admin/reports" linkLabel="All Reports" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Booking sources */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-4">Booking Sources (MTD)</p>
                  {sources.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-400">No booking data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={sources} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => [`${v} bookings`, ""]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                          {sources.map((_: any, i: number) => (
                            <Cell key={i} fill={["#D97706", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"][i % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* 7-day forecast */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2">
                  <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-4">7-Day Forecast</p>
                  {forecast.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-400">Forecast unavailable</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={forecast} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} formatter={(v: any, name: string) => [name === "occupancyPct" ? `${v}%` : fmt(v), name === "occupancyPct" ? "Occupancy" : "Revenue"]} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="occupancyPct" name="Occupancy %" fill="#3B82F6" radius={[3, 3, 0, 0]} barSize={18} opacity={0.8} />
                        <Bar yAxisId="right" dataKey="revenue" name="Revenue ₹" fill="#D97706" radius={[3, 3, 0, 0]} barSize={18} opacity={0.8} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </section>

            {/* ── SECTION F: ACTION QUEUE + RECENT ACTIVITY ─────────── */}
            <section className="mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Action Queue */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <ShieldAlert size={15} className="text-red-500" />
                    <h3 className="text-sm font-bold text-slate-800">Action Queue</h3>
                    <span className="ml-auto text-[11px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                      {actionQueue.length} items
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {actionQueue.length === 0 ? (
                      <p className="text-center py-8 text-sm text-slate-400">No pending actions ✓</p>
                    ) : actionQueue.map((a: any, i: number) => (
                      <Link key={i} to={a.link || "#"} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition">
                        <PriorityBadge p={a.priority} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700">{a.action}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{a.entity}</p>
                        </div>
                        <ChevronRight size={13} className="text-slate-300 shrink-0 mt-0.5" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Activity size={15} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {activity.length === 0 ? (
                      <p className="text-center py-8 text-sm text-slate-400">No recent activity</p>
                    ) : activity.map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
                          {(a.user || "S")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{a.action}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{a.user} · {a.time ? format(new Date(a.time), "h:mm a") : "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── SECTION G: IN-HOUSE GUESTS ─────────────────────────── */}
            {inHouse?.guests?.length > 0 && (
              <section className="mb-8">
                <SectionHeader title="In-House Guests" subtitle={`${inHouse.guests.length} guests currently resident`} link="/admin/in-house-list" linkLabel="Full Guest Log" />
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {["Guest", "Room", "Check-Out", "VIP"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {inHouse.guests.slice(0, 10).map((g: any) => (
                        <tr key={g._id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-medium text-slate-800">{g.guestDetails?.firstName} {g.guestDetails?.lastName}</td>
                          <td className="px-4 py-3 font-bold text-amber-700 font-mono">{g.assignedRoom?.roomNumber || "—"}</td>
                          <td className="px-4 py-3 text-slate-500">{g.checkOutDate ? format(new Date(g.checkOutDate), "MMM d") : "—"}</td>
                          <td className="px-4 py-3">
                            {g.isVipGuest && <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.5 rounded">VIP</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
