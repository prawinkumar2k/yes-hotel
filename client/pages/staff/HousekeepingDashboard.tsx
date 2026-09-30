import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getStoredAuthToken } from "@/lib/authStorage";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Sparkles, CheckCircle, Clock, Search, RefreshCw,
  ChevronRight, AlertTriangle, Star, MapPin, User, ArrowRight
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS: Record<string, string> = {
  DIRTY: "bg-red-100 text-red-700 border-red-200",
  ASSIGNED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  CLEANING: "bg-blue-100 text-blue-700 border-blue-200",
  CLEANING_COMPLETED: "bg-purple-100 text-purple-700 border-purple-200",
  INSPECTION: "bg-indigo-100 text-indigo-700 border-indigo-200",
  WAITING_FOR_RELEASE: "bg-orange-100 text-orange-700 border-orange-200",
  CLEAN: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const STATUS_NEXT: Record<string, string> = {
  ASSIGNED: "CLEANING",
  CLEANING: "CLEANING_COMPLETED",
};

const STATUS_ACTION: Record<string, string> = {
  ASSIGNED: "Start Cleaning",
  CLEANING: "Complete Cleaning",
};

function TaskCard({ task, userId, onUpdate }: { task: any; userId?: string; onUpdate: (id: string, status: string) => void }) {
  const isAssignedToMe = task.assignedTo?._id === userId || task.assignedTo?.id === userId;
  const roomNo = task.room?.roomNumber || (task.room as any) || "—";
  const floor = task.room?.floor;
  const nextStatus = STATUS_NEXT[task.status];
  const action = STATUS_ACTION[task.status];

  return (
    <div className={`bg-white rounded-xl border p-4 ${task.priority === "HIGH" || task.priority === "URGENT" ? "border-red-200" : "border-slate-200"} hover:shadow-sm transition`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-bold text-slate-900">Room {roomNo}</span>
            {floor && <span className="text-xs text-slate-400">Floor {floor}</span>}
            {(task.isVip || task.isVipRoom) && (
              <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                <Star className="w-3 h-3" /> VIP
              </span>
            )}
          </div>
          <span className={`inline-block text-xs font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_COLORS[task.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {task.status?.replace(/_/g, " ")}
          </span>
        </div>
        {task.assignedTo && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <User className="w-3 h-3" />
            {task.assignedTo.firstName || "Staff"}
          </div>
        )}
      </div>

      {task.notes && (
        <p className="text-xs text-slate-500 mb-3 italic">"{task.notes}"</p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {task.createdAt ? new Date(task.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
        </span>
        {isAssignedToMe && nextStatus && action && (
          <button
            onClick={() => onUpdate(task._id, nextStatus)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition"
          >
            {action} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function HousekeepingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "mine">("mine");
  const [search, setSearch] = useState("");

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: commandData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["hkCommandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 20000,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/housekeeping/${id}`, {
        method: "PATCH",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hkCommandCenter"] });
      toast({ title: "Task Updated", description: "Room status updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  });

  const hk = commandData?.housekeeping || {};
  const pulse = commandData?.hotelPulse || {};
  const allTasks: any[] = hk.tasks || [];

  const myTasks = allTasks.filter(t =>
    t.assignedTo?._id === user?._id || t.assignedTo?.id === user?._id
  );

  const displayTasks = (filter === "mine" ? myTasks : allTasks).filter(t =>
    !search || String(t.room?.roomNumber || t.room || "").includes(search)
  );

  const stats = {
    dirty: hk.dirty || 0,
    assigned: hk.assigned || 0,
    cleaning: hk.cleaning || 0,
    completed: hk.completed || 0,
    inspection: hk.inspection || 0,
    waitingRelease: hk.waitingRelease || 0,
  };

  return (
    <AdminLayout title="Housekeeping — Operations Center">
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              Housekeeping Operations
            </h1>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Status KPIs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Dirty", value: stats.dirty, color: "border-red-200 bg-red-50 text-red-700" },
            { label: "Assigned", value: stats.assigned, color: "border-yellow-200 bg-yellow-50 text-yellow-700" },
            { label: "Cleaning", value: stats.cleaning, color: "border-blue-200 bg-blue-50 text-blue-700" },
            { label: "Completed", value: stats.completed, color: "border-purple-200 bg-purple-50 text-purple-700" },
            { label: "Inspection", value: stats.inspection, color: "border-indigo-200 bg-indigo-50 text-indigo-700" },
            { label: "Waiting", value: stats.waitingRelease, color: "border-orange-200 bg-orange-50 text-orange-700" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Room overview mini-tiles */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-700 text-sm">Property Overview</h3>
            <span className="text-xs text-slate-400 ml-auto">Occupancy: {pulse.occupancyPct || 0}%</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(commandData?.hotelPulse?.totalRooms || 0) === 0 && (
              <p className="text-slate-400 text-xs italic">Room data loading...</p>
            )}
            {/* Status summary bars */}
            {Object.entries(stats).map(([key, val]) => (
              (val as number) > 0 && (
                <span key={key} className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[key.toUpperCase().replace(/([A-Z])/g, "_$1").slice(1)] || "bg-slate-100 text-slate-600"}`}>
                  {(val as number)} {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
              )
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center">
            <h3 className="font-semibold text-slate-800">Cleaning Queue</h3>
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Room number..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400 w-28"
                />
              </div>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => setFilter("mine")} className={`px-3 py-1.5 text-xs font-medium transition ${filter === "mine" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  My Tasks ({myTasks.length})
                </button>
                <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs font-medium transition ${filter === "all" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  All ({allTasks.length})
                </button>
              </div>
            </div>
          </div>

          <div className="p-5">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : displayTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">
                  {filter === "mine" ? "No tasks assigned to you right now" : "All rooms are clean!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayTasks.map(task => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    userId={user?._id}
                    onUpdate={(id, status) => updateTaskMutation.mutate({ id, status })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
