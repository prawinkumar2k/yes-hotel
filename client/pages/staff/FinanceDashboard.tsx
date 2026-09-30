import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getStoredAuthToken } from "@/lib/authStorage";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Landmark, RefreshCw, TrendingUp, AlertCircle,
  ArrowRight, CreditCard, RotateCcw, Moon,
  Banknote, Smartphone, Globe, CheckCircle
} from "lucide-react";

const fmt = (n: number = 0) => `₹${n.toLocaleString("en-IN")}`;

function KPICard({ label, value, sub, icon: Icon, color, href }: {
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

export default function FinanceDashboard() {
  const { user } = useAuth();

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: commandData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["financeCommandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 60000,
  });

  const { data: execData } = useQuery({
    queryKey: ["financeExecSummary"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/reports/executive-summary", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 120000,
  });

  const revenue = commandData?.revenue || {};
  const audit = commandData?.audit || {};

  return (
    <AdminLayout title="Finance — Control Center">
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-6 h-6 text-green-600" />
              Finance Control Center
            </h1>
            <p className="text-sm text-slate-500">
              Business Date: <strong>{audit.currentBusinessDate ? new Date(audit.currentBusinessDate).toLocaleDateString("en-IN") : "Loading..."}</strong>
              {audit.isAuditDone && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">Night Audit Done</span>}
              {audit.currentBusinessDate && !audit.isAuditDone && <span className="ml-2 text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">Audit Pending</span>}
            </p>
          </div>
          <button onClick={() => refetch()} disabled={isRefetching}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Alert if audit pending */}
        {audit.currentBusinessDate && !audit.isAuditDone && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-orange-500" />
            <div>
              <p className="font-semibold text-orange-800">Night Audit Pending</p>
              <p className="text-sm text-orange-600">Run night audit to close the business day and post room charges.</p>
            </div>
            <Link to="/admin/night-audit" className="ml-auto flex items-center gap-1 text-sm text-orange-700 font-medium hover:underline">
              Run Audit <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Today Revenue */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Today's Revenue</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard label="Total Revenue" value={fmt(revenue.todayRevenue)} icon={TrendingUp} color="bg-green-500" />
            <KPICard label="Cash" value={fmt(revenue.todayCash)} icon={Banknote} color="bg-emerald-500" href="/admin/cashier-shifts" />
            <KPICard label="Card" value={fmt(revenue.todayCard)} icon={CreditCard} color="bg-blue-500" />
            <KPICard label="Unified Payments Interface" value={fmt(revenue.todayUPI)} icon={Smartphone} color="bg-indigo-500" />
            <KPICard label="Gateway" value={fmt(revenue.todayGateway)} icon={Globe} color="bg-purple-500" />
            <KPICard label="Open Shifts" value={revenue.openCashierShifts || 0} sub="Cashier shifts open" icon={AlertCircle} color={(revenue.openCashierShifts || 0) > 0 ? "bg-orange-500" : "bg-slate-400"} href="/admin/cashier-shifts" />
          </div>
        </div>

        {/* Monthly KPIs */}
        {execData && (
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Property Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard label="MTD Revenue" value={fmt(execData.monthlyRevenue)} sub="Month to date" icon={TrendingUp} color="bg-teal-500" />
              <KPICard label="Occupied Rooms" value={`${execData.occupancyPct || 0}%`} sub={`${execData.inHouseCount || 0}/${execData.totalRooms || 0} rooms`} icon={Landmark} color="bg-blue-600" />
              <KPICard label="Average Room Price Per Night" value={fmt(execData.adr)} sub="Avg Daily Rate" icon={CreditCard} color="bg-violet-500" />
              <KPICard label="Open Complaints" value={execData.openComplaints || 0} icon={AlertCircle} color={(execData.openComplaints || 0) > 0 ? "bg-red-500" : "bg-emerald-500"} href="/admin/complaints" />
            </div>
          </div>
        )}

        {/* Pending Folios Alert */}
        {(revenue.pendingFolios || 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-semibold text-red-800">{revenue.pendingFolios} Folio{revenue.pendingFolios > 1 ? "s" : ""} with Outstanding Balance</p>
              <p className="text-sm text-red-600">Review and collect outstanding payments.</p>
            </div>
            <Link to="/admin/advances" className="ml-auto flex items-center gap-1 text-sm text-red-700 font-medium hover:underline">
              Review <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Night Audit", icon: Moon, href: "/admin/night-audit", color: "bg-slate-800" },
            { label: "Cashier Shifts", icon: Banknote, href: "/admin/cashier-shifts", color: "bg-teal-600" },
            { label: "Refunds", icon: RotateCcw, href: "/admin/refunds", color: "bg-orange-500" },
            { label: "Advances", icon: CreditCard, href: "/admin/advances", color: "bg-blue-600" },
          ].map(action => (
            <Link key={action.label} to={action.href}
              className={`flex items-center gap-3 p-4 ${action.color} hover:opacity-90 text-white rounded-xl font-medium text-sm transition`}>
              <action.icon className="w-5 h-5" />
              {action.label}
            </Link>
          ))}
        </div>

        {/* Reports Links */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Finance Reports</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: "Revenue Reports", href: "/admin/reports" },
              { label: "Payment History", href: "/admin/payments" },
              { label: "Accounting Ledger", href: "/admin/accounting" },
              { label: "Corporate Accounts", href: "/admin/corporate-accounts" },
              { label: "Audit Logs", href: "/admin/audit-logs" },
              { label: "Executive Overview", href: "/admin/executive" },
            ].map(link => (
              <Link key={link.label} to={link.href}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-300 rounded-xl text-sm text-slate-700 font-medium transition group">
                {link.label}
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-green-600 transition" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
