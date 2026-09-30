import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getStoredAuthToken } from "@/lib/authStorage";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  UtensilsCrossed, RefreshCw, Clock, CheckCircle,
  AlertTriangle, ArrowRight, Plus, ChevronRight
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ORDER_STATUS_COLORS: Record<string, string> = {
  KITCHEN_PENDING: "bg-blue-100 text-blue-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  READY: "bg-emerald-100 text-emerald-700",
  SERVED: "bg-slate-100 text-slate-500",
  BILLED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-100 text-red-500",
};

const fmt = (n: number = 0) => `₹${n.toLocaleString("en-IN")}`;

function OrderCard({ order, onUpdateStatus }: { order: any; onUpdateStatus: (id: string, status: string) => void }) {
  const age = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const isDelayed = age > 20 && order.status === "PREPARING";
  const items = order.items || [];

  return (
    <div className={`bg-white rounded-xl border p-4 hover:shadow-sm transition ${isDelayed ? "border-red-300" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-slate-800 text-sm">
            {order.tableNumber ? `Table ${order.tableNumber}` : order.roomNumber ? `Room ${order.roomNumber}` : "Order"} · #{order._id?.slice(-6)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} · {fmt(order.totalAmount)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${ORDER_STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"}`}>
            {order.status}
          </span>
          {isDelayed && (
            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {age}m delayed
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-3 space-y-0.5">
        {items.slice(0, 3).map((item: any, i: number) => (
          <p key={i}>{item.quantity}× {item.name || "Item"}</p>
        ))}
        {items.length > 3 && <p className="text-slate-400">+{items.length - 3} more...</p>}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          <Clock className="w-3 h-3 inline mr-0.5" />{age}m ago
        </span>
        {order.status === "KITCHEN_PENDING" && (
          <button onClick={() => onUpdateStatus(order._id, "PREPARING")}
            className="flex items-center gap-1 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-lg transition">
            Start KOT <ChevronRight className="w-3 h-3" />
          </button>
        )}
        {order.status === "PREPARING" && (
          <button onClick={() => onUpdateStatus(order._id, "READY")}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition">
            Mark Ready <CheckCircle className="w-3 h-3" />
          </button>
        )}
        {order.status === "READY" && (
          <button onClick={() => onUpdateStatus(order._id, "SERVED")}
            className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition">
            Served <CheckCircle className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: commandData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["restaurantCommandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 15000, // Faster refresh for kitchen
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/pos/orders/${id}/status`, {
        method: "PATCH",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurantCommandCenter"] });
      toast({ title: "Order Updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  });

  const restaurant = commandData?.restaurant || {};
  const orders: any[] = restaurant.orders || [];
  const fmt = (n: number = 0) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <AdminLayout title="Restaurant — Operations Center">
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-red-500" />
              Restaurant Operations
            </h1>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {" · "} Auto-refreshes every 15s
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/pos" className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition">
              <Plus className="w-4 h-4" /> New Order
            </Link>
            <button onClick={() => refetch()} disabled={isRefetching}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Open Orders", value: restaurant.openOrders || 0, color: "bg-blue-500" },
            { label: "KOT (New)", value: restaurant.kot || 0, color: "bg-slate-700" },
            { label: "Preparing", value: restaurant.preparing || 0, color: "bg-yellow-500" },
            { label: "Ready", value: restaurant.ready || 0, color: "bg-emerald-500" },
            { label: "Delayed", value: restaurant.delayed || 0, color: (restaurant.delayed || 0) > 0 ? "bg-red-500" : "bg-slate-300" },
            { label: "Today F&B", value: fmt(restaurant.todayRevenue), color: "bg-indigo-500" },
          ].map(s => (
            <div key={s.label} className={`${s.color} text-white rounded-xl p-4`}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs font-medium mt-0.5 opacity-90">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Live Orders Grid (KDS-style) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-slate-800">Kitchen Display</h3>
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">{orders.length} live</span>
            </div>
            <Link to="/admin/pos" className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
              Full POS <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No active orders — kitchen is clear</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {orders.map(order => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onUpdateStatus={(id, status) => updateOrderMutation.mutate({ id, status })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Full POS Terminal", href: "/admin/pos", color: "bg-red-50 border-red-200 text-red-700" },
            { label: "Menu Management", href: "/admin/menu", color: "bg-slate-50 border-slate-200 text-slate-700" },
            { label: "Banquets & Events", href: "/admin/banquets", color: "bg-blue-50 border-blue-200 text-blue-700" },
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
