import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getStoredAuthToken } from "@/lib/authStorage";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  DollarSign, RefreshCw, CreditCard, ArrowRight,
  TrendingUp, RotateCcw, AlertCircle, CheckCircle,
  Banknote, Smartphone, Globe, BarChart2
} from "lucide-react";

function StatCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; href?: string;
}) {
  const card = (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 hover:shadow-md transition ${href ? "cursor-pointer group" : ""}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {href && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 ml-auto self-center transition" />}
    </div>
  );
  return href ? <Link to={href}>{card}</Link> : card;
}

const fmt = (n: number = 0) => `₹${n.toLocaleString("en-IN")}`;

export default function CashierDashboard() {
  const { user } = useAuth();

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: commandData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cashierCommandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30000,
  });

  const { data: shiftData } = useQuery({
    queryKey: ["cashierCurrentShift"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/cashier-shifts/current", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30000,
  });

  const revenue = commandData?.revenue || {};
  const currentShift = shiftData || null;

  return (
    <AdminLayout title="Cashier — Payment Terminal">
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-teal-500" />
              Cashier Terminal
            </h1>
            <p className="text-sm text-slate-500">
              Welcome, {user?.firstName}. {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Current Shift Banner */}
        {currentShift ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="font-semibold text-emerald-800">Shift Open</p>
              <p className="text-sm text-emerald-600">
                Started at {new Date(currentShift.openedAt).toLocaleTimeString("en-IN")} · Opening float: {fmt(currentShift.openingFloat)}
              </p>
            </div>
            <Link to="/admin/cashier-shifts" className="ml-auto flex items-center gap-1 text-sm text-emerald-700 font-medium hover:underline">
              Manage Shift <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <div>
              <p className="font-semibold text-amber-800">No Active Shift</p>
              <p className="text-sm text-amber-600">Open a cashier shift before processing payments.</p>
            </div>
            <Link to="/admin/cashier-shifts" className="ml-auto flex items-center gap-1 text-sm text-amber-700 font-medium hover:underline">
              Open Shift <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Today Revenue KPIs */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Today's Collections</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Revenue" value={fmt(revenue.todayRevenue)} icon={TrendingUp} color="bg-teal-500" />
            <StatCard label="Cash" value={fmt(revenue.todayCash)} icon={Banknote} color="bg-emerald-500" href="/admin/cashier-shifts" />
            <StatCard label="Card" value={fmt(revenue.todayCard)} icon={CreditCard} color="bg-blue-500" />
            <StatCard label="Unified Payments Interface" value={fmt(revenue.todayUPI)} icon={Smartphone} color="bg-indigo-500" />
            <StatCard label="Gateway" value={fmt(revenue.todayGateway)} icon={Globe} color="bg-purple-500" />
            <StatCard label="Open Folios" value={revenue.pendingFolios || 0} sub="With balance" icon={AlertCircle} color={(revenue.pendingFolios || 0) > 0 ? "bg-red-500" : "bg-slate-400"} href="/admin/advances" />
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Receive Payment", icon: DollarSign, href: "/admin/front-desk", color: "bg-teal-500" },
              { label: "Advance Payments", icon: CreditCard, href: "/admin/advances", color: "bg-blue-500" },
              { label: "Process Refund", icon: RotateCcw, href: "/admin/refunds", color: "bg-orange-500" },
              { label: "Shift Management", icon: BarChart2, href: "/admin/cashier-shifts", color: "bg-indigo-500" },
            ].map(action => (
              <Link key={action.label} to={action.href}
                className={`flex items-center gap-3 p-4 ${action.color} hover:opacity-90 text-white rounded-xl font-medium text-sm transition`}>
                <action.icon className="w-5 h-5" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Transactions Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
            <Link to="/admin/payments" className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5 text-center text-slate-400 text-sm py-10">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>View detailed payment history in <Link to="/admin/payments" className="text-amber-600 underline">Payments</Link></p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
