import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getStoredAuthToken } from "@/lib/authStorage";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Wrench, AlertTriangle, Clock, CheckCircle, RefreshCw,
  Search, ChevronRight, BedDouble, ArrowRight, Plus
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-300",
  HIGH: "bg-orange-100 text-orange-700 border-orange-300",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-300",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  ON_HOLD: "bg-yellow-50 text-yellow-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

function TicketCard({ ticket, onUpdate }: { ticket: any; onUpdate: (id: string, status: string) => void }) {
  const room = ticket.room?.roomNumber || (ticket.room as any) || "—";

  return (
    <div className={`bg-white rounded-xl border p-4 hover:shadow-sm transition ${
      ticket.priority === "CRITICAL" ? "border-red-300" :
      ticket.priority === "HIGH" ? "border-orange-300" : "border-slate-200"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{ticket.title || ticket.description?.slice(0, 50)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Room {room} · #{ticket._id?.slice(-6)}</p>
        </div>
        <span className={`text-xs border rounded-full px-2 py-0.5 font-semibold shrink-0 ${PRIORITY_COLORS[ticket.priority] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
          {ticket.priority}
        </span>
      </div>

      {ticket.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{ticket.description}</p>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[ticket.status] || ""}`}>
          {ticket.status?.replace(/_/g, " ")}
        </span>
        {ticket.status === "OPEN" && (
          <button
            onClick={() => onUpdate(ticket._id, "IN_PROGRESS")}
            className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition"
          >
            Start <ChevronRight className="w-3 h-3" />
          </button>
        )}
        {ticket.status === "IN_PROGRESS" && (
          <button
            onClick={() => onUpdate(ticket._id, "RESOLVED")}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition"
          >
            Resolve <CheckCircle className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MaintenanceDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: commandData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mtCommandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30000,
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/maintenance/${id}`, {
        method: "PATCH",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mtCommandCenter"] });
      toast({ title: "Ticket Updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  });

  const mt = commandData?.maintenance || {};
  const allTickets: any[] = mt.tickets || [];
  const pulse = commandData?.hotelPulse || {};

  const displayTickets = allTickets.filter(t =>
    !search || String(t.room?.roomNumber || t.room || "").includes(search) ||
    (t.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Maintenance — Engineering Center">
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-orange-500" />
              Maintenance & Engineering
            </h1>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/maintenance"
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> New Ticket
            </Link>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Open", value: mt.open || 0, color: "bg-red-500", icon: AlertTriangle },
            { label: "Critical", value: mt.critical || 0, color: "bg-red-700", icon: AlertTriangle },
            { label: "High Priority", value: mt.high || 0, color: "bg-orange-500", icon: Clock },
            { label: "OOO Rooms", value: pulse.ooo || 0, color: "bg-slate-600", icon: BedDouble },
          ].map(s => (
            <div key={s.label} className={`${s.color} text-white rounded-xl p-4 flex items-center gap-4`}>
              <s.icon className="w-8 h-8 opacity-70" />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm font-medium opacity-90">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ticket List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <Wrench className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-800">Active Tickets</h3>
            <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">{allTickets.length}</span>
            <div className="ml-auto relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 w-36"
              />
            </div>
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : displayTickets.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No open tickets — all clear!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayTickets.map(ticket => (
                  <TicketCard
                    key={ticket._id}
                    ticket={ticket}
                    onUpdate={(id, status) => updateTicketMutation.mutate({ id, status })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "All Maintenance Tickets", href: "/admin/maintenance", color: "bg-orange-50 border-orange-200 text-orange-700" },
            { label: "Room Rack (OOO/OOS)", href: "/admin/room-rack", color: "bg-slate-50 border-slate-200 text-slate-700" },
            { label: "Housekeeping Status", href: "/admin/housekeeping", color: "bg-blue-50 border-blue-200 text-blue-700" },
          ].map(link => (
            <Link key={link.label} to={link.href}
              className={`flex items-center justify-between p-4 rounded-xl border ${link.color} font-medium text-sm hover:shadow-sm transition`}>
              {link.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
