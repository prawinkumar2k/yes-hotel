import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getStoredAuthToken } from "@/lib/authStorage";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  LogIn, LogOut, BedDouble, Users, AlertCircle, Clock,
  ArrowRight, Phone, Mail, MapPin, CheckCircle, XCircle,
  RefreshCw, Calendar, UserCheck, Sparkles
} from "lucide-react";

function StatCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; href?: string;
}) {
  const card = (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 hover:shadow-md transition group ${href ? "cursor-pointer" : ""}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {href && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 ml-auto self-center transition" />}
    </div>
  );
  return href ? <Link to={href}>{card}</Link> : card;
}

function BookingRow({ booking, type }: { booking: any; type: "arrival" | "departure" }) {
  const guestName = booking.guest?.fullName || booking.guestName || "Guest";
  const room = booking.assignedRoom?.roomNumber || (booking.assignedRoom as any) || "—";
  const ref = booking.bookingReference || booking._id?.slice(-6);
  const time = type === "arrival"
    ? new Date(booking.checkInDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : new Date(booking.checkOutDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className={`w-2 h-2 rounded-full shrink-0 ${type === "arrival" ? "bg-emerald-500" : "bg-orange-500"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{guestName}</p>
        <p className="text-xs text-slate-400">#{ref} · Room {room}</p>
      </div>
      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full shrink-0">{time}</span>
    </div>
  );
}

export default function FrontDeskDashboard() {
  const { user } = useAuth();

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: commandData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["frontDeskCommandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30000,
  });

  const { data: frontDeskSummary } = useQuery({
    queryKey: ["frontDeskSummary"],
    queryFn: async () => {
      const res = await fetch("/api/front-desk/summary", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30000,
  });

  const pulse = commandData?.hotelPulse || {};
  const arrivals = commandData?.arrivals || [];
  const departures = commandData?.departures || [];
  const inHouse = commandData?.inHouse || [];
  const actionQueue = commandData?.actionQueue || [];
  const hk = commandData?.housekeeping || {};

  return (
    <AdminLayout title="Front Desk — Command Center">
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Front Desk</h1>
            <p className="text-sm text-slate-500">
              Welcome back, {user?.firstName}. Today is{" "}
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Arrivals Today" value={arrivals.length} icon={LogIn} color="bg-emerald-500" href="/admin/check-in" />
          <StatCard label="Departures Today" value={departures.length} icon={LogOut} color="bg-orange-500" href="/admin/check-out" />
          <StatCard label="In-House" value={inHouse.length} icon={Users} color="bg-blue-500" href="/admin/in-house-list" />
          <StatCard label="Occupied" value={pulse.occupied || 0} sub={`of ${pulse.totalRooms || 0} rooms`} icon={BedDouble} color="bg-indigo-500" />
          <StatCard label="Available" value={pulse.available || 0} sub="Ready to sell" icon={CheckCircle} color="bg-teal-500" href="/admin/room-rack" />
          <StatCard label="Needs Cleaning" value={hk.dirty || 0} sub="Dirty rooms" icon={Sparkles} color={(hk.dirty || 0) > 0 ? "bg-red-500" : "bg-slate-400"} href="/admin/housekeeping" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Arrivals */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-slate-800">Arrivals Today</h3>
                <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">{arrivals.length}</span>
              </div>
              <Link to="/admin/check-in" className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                Check-In <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto">
              {isLoading ? (
                <p className="text-center text-slate-400 py-8 text-sm">Loading...</p>
              ) : arrivals.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No arrivals today</p>
              ) : (
                arrivals.map((a: any) => <BookingRow key={a._id} booking={a} type="arrival" />)
              )}
            </div>
          </div>

          {/* Departures */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-orange-500" />
                <h3 className="font-semibold text-slate-800">Departures Today</h3>
                <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">{departures.length}</span>
              </div>
              <Link to="/admin/check-out" className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                Check-Out <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto">
              {isLoading ? (
                <p className="text-center text-slate-400 py-8 text-sm">Loading...</p>
              ) : departures.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No departures today</p>
              ) : (
                departures.map((d: any) => <BookingRow key={d._id} booking={d} type="departure" />)
              )}
            </div>
          </div>

          {/* Action Queue */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-slate-800">Action Queue</h3>
              {actionQueue.length > 0 && (
                <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">{actionQueue.length}</span>
              )}
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {actionQueue.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">All clear — no pending actions</p>
                </div>
              ) : (
                actionQueue.map((item: any, i: number) => (
                  <Link key={i} to={item.link || "#"} className="block p-3 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 transition">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        item.priority === "CRITICAL" ? "bg-red-100 text-red-700" :
                        item.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{item.priority}</span>
                      <span className="text-xs text-slate-400">{item.entity}</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium">{item.action}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Room Status Overview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BedDouble className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800">Room Status Overview</h3>
            <Link to="/admin/room-rack" className="ml-auto text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
              Room Rack <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-3">
            {[
              { label: "Occupied", value: pulse.occupied, color: "bg-blue-50 text-blue-700 border-blue-200" },
              { label: "Available", value: pulse.available, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Dirty", value: pulse.dirty, color: "bg-red-50 text-red-700 border-red-200" },
              { label: "Cleaning", value: pulse.cleaning, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
              { label: "Inspection", value: pulse.inspection, color: "bg-purple-50 text-purple-700 border-purple-200" },
              { label: "Waiting", value: pulse.waitingRelease, color: "bg-orange-50 text-orange-700 border-orange-200" },
              { label: "OOO", value: pulse.ooo, color: "bg-slate-100 text-slate-600 border-slate-200" },
              { label: "OOS", value: pulse.oos, color: "bg-slate-100 text-slate-600 border-slate-200" },
              { label: "Total", value: pulse.totalRooms, color: "bg-slate-800 text-white border-slate-800" },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
                <p className="text-xl font-bold">{s.value ?? 0}</p>
                <p className="text-xs font-medium mt-0.5 opacity-80">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "New Reservation", icon: Calendar, href: "/admin/front-desk", color: "bg-amber-500" },
            { label: "Quick Check-In", icon: LogIn, href: "/admin/check-in", color: "bg-emerald-500" },
            { label: "Quick Check-Out", icon: LogOut, href: "/admin/check-out", color: "bg-orange-500" },
            { label: "Guest Directory", icon: UserCheck, href: "/admin/guests", color: "bg-blue-500" },
          ].map(action => (
            <Link key={action.label} to={action.href}
              className={`flex items-center gap-3 p-4 ${action.color} hover:opacity-90 text-white rounded-xl font-medium text-sm transition`}>
              <action.icon className="w-5 h-5" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
