import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BedDouble, Sparkles, CheckCircle2, Clock, AlertTriangle, UserCheck,
  RefreshCw, Filter, Search, ShieldCheck, ChevronRight, Play, ArrowRight,
  X, User, Tag, Layers, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DIRTY: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  ASSIGNED: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30" },
  CLEANING: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  CLEANING_COMPLETED: { bg: "bg-cyan-500/10", text: "text-cyan-300", border: "border-cyan-500/30" },
  INSPECTION: { bg: "bg-indigo-500/10", text: "text-indigo-300", border: "border-indigo-500/30" },
  INSPECTION_FAILED: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30" },
  INSPECTED: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/30" },
  WAITING_FOR_RELEASE: { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/30" },
  CLEAN: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
};

const LEGAL_NEXT_STATUSES: Record<string, { label: string; status: string; color: string }[]> = {
  DIRTY: [
    { label: "Start Cleaning", status: "CLEANING", color: "bg-blue-600 hover:bg-blue-500 text-white" },
    { label: "Assign Attendant", status: "ASSIGNED", color: "bg-amber-600 hover:bg-amber-500 text-white" }
  ],
  ASSIGNED: [
    { label: "Begin Cleaning", status: "CLEANING", color: "bg-blue-600 hover:bg-blue-500 text-white" },
  ],
  CLEANING: [
    { label: "Complete Cleaning", status: "CLEANING_COMPLETED", color: "bg-cyan-600 hover:bg-cyan-500 text-white" },
  ],
  CLEANING_COMPLETED: [
    { label: "Send to Inspection", status: "INSPECTION", color: "bg-indigo-600 hover:bg-indigo-500 text-white" },
    { label: "Mark Clean", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-500 text-white" }
  ],
  INSPECTION: [
    { label: "Pass & Release", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-500 text-white" },
    { label: "Fail Inspection", status: "INSPECTION_FAILED", color: "bg-rose-600 hover:bg-rose-500 text-white" }
  ],
  INSPECTION_FAILED: [
    { label: "Re-Clean Room", status: "DIRTY", color: "bg-red-600 hover:bg-red-500 text-white" },
  ],
  INSPECTED: [
    { label: "Release Room", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-500 text-white" }
  ],
  WAITING_FOR_RELEASE: [
    { label: "Authorize Release", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-500 text-white" }
  ],
  CLEAN: [
    { label: "Mark Dirty", status: "DIRTY", color: "bg-red-900/60 text-red-300 hover:bg-red-800" }
  ]
};

export default function AdminHousekeeping() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Assign staff modal
  const [assignModal, setAssignModal] = useState<{ open: boolean; task: any | null }>({ open: false, task: null });
  const [cleanerName, setCleanerName] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      // Fetch housekeeping tasks
      const resTasks = await fetch("/api/admin/housekeeping", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const jsonTasks = await resTasks.json();
      if (jsonTasks.success) {
        setTasks(jsonTasks.data || []);
      }

      // Fetch room rack to get complete room list
      const resRooms = await fetch("/api/room-rack", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const jsonRooms = await resRooms.json();
      if (jsonRooms.success) {
        const floors = jsonRooms.data?.floors || [];
        setRooms(floors.flatMap((f: any) => f.rooms || []));
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (taskId: string, targetStatus: string) => {
    setUpdatingTaskId(taskId);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/admin/housekeeping/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: targetStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Housekeeping Status Updated", description: `Task transitioned to ${targetStatus}` });
        fetchData();
      } else {
        toast({ title: "Transition Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleAssignSubmit = async () => {
    if (!assignModal.task) return;
    setUpdatingTaskId(assignModal.task._id);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/admin/housekeeping/${assignModal.task._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          priority,
          notes: `Assigned to ${cleanerName}`,
          status: "ASSIGNED"
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Task Assigned", description: `Assigned to ${cleanerName}` });
        setAssignModal({ open: false, task: null });
        fetchData();
      } else {
        toast({ title: "Assignment Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Extract floors dynamically
  const floorsList = Array.from(new Set(rooms.map((r) => r.floor || "1"))).sort();

  // Combine rooms and tasks into unified visual items
  const combinedItems = rooms.map((room) => {
    const task = tasks.find((t) => (t.room?._id || t.room) === room._id) || {
      _id: `virtual-${room._id}`,
      room: room,
      status: room.housekeepingStatus || "DIRTY",
      priority: room.occupancyStatus === "OCCUPIED" ? "HIGH" : "MEDIUM",
      updatedAt: room.updatedAt || new Date().toISOString()
    };
    return { room, task };
  });

  const filteredItems = combinedItems.filter(({ room, task }) => {
    const floorMatch = selectedFloor === "ALL" || (room.floor || "1").toString() === selectedFloor.toString();
    const currentStatus = task.status || room.housekeepingStatus || "DIRTY";
    const statusMatch = statusFilter === "ALL" || currentStatus === statusFilter;
    const searchMatch = !searchQuery || room.roomNumber.toString().toLowerCase().includes(searchQuery.toLowerCase());

    return floorMatch && statusMatch && searchMatch;
  });

  // KPI counters
  const dirtyCount = combinedItems.filter((i) => (i.task.status || i.room.housekeepingStatus) === "DIRTY").length;
  const cleaningCount = combinedItems.filter((i) => (i.task.status || i.room.housekeepingStatus) === "CLEANING").length;
  const inspectionCount = combinedItems.filter((i) => ["INSPECTION", "CLEANING_COMPLETED"].includes(i.task.status || i.room.housekeepingStatus)).length;
  const cleanCount = combinedItems.filter((i) => (i.task.status || i.room.housekeepingStatus) === "CLEAN").length;

  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white p-12 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-[#c9a227] text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-400 mt-3 font-mono">Loading Housekeeping Visual Board...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#121316] p-6 rounded-2xl border border-[#262930] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
            <BedDouble size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
              Housekeeping Visual Operations Board
              <span className="text-xs bg-[#c9a227]/20 text-[#e5c76b] px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30">REAL-TIME</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Live floor turnover status, housekeeping tasks, inspector verification & supervisor release management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/mobile-housekeeping"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1d24] text-[#e5c76b] hover:bg-[#262930] rounded-xl transition text-xs font-semibold border border-[#c9a227]/30 shadow-md"
          >
            <Sparkles size={16} /> Mobile HK View
          </Link>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a227] text-black hover:bg-[#e5c76b] rounded-xl transition text-xs font-bold shadow-md"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Sync Floor Data
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#121316] p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <div className="flex items-center justify-between text-red-400 mb-2">
            <AlertCircle size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">Dirty Rooms</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">{dirtyCount}</p>
          <p className="text-xs text-gray-400 mt-1">Pending Turnover</p>
        </div>

        <div className="bg-[#121316] p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <Clock size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">In Cleaning</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">{cleaningCount}</p>
          <p className="text-xs text-gray-400 mt-1">Attendant On-Site</p>
        </div>

        <div className="bg-[#121316] p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
          <div className="flex items-center justify-between text-indigo-400 mb-2">
            <ShieldCheck size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Pending Inspection</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">{inspectionCount}</p>
          <p className="text-xs text-gray-400 mt-1">Ready for Supervisor</p>
        </div>

        <div className="bg-[#121316] p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <CheckCircle2 size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">Clean & Ready</span>
          </div>
          <p className="text-3xl font-serif font-bold text-white">{cleanCount}</p>
          <p className="text-xs text-gray-400 mt-1">Available for Guest Check-In</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#121316] p-4 rounded-2xl border border-[#262930] flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Floor Selection */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Layers size={14} /> Floor:
          </span>
          <button
            onClick={() => setSelectedFloor("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              selectedFloor === "ALL"
                ? "bg-[#c9a227] text-black border-[#c9a227]"
                : "bg-[#1a1d24] text-gray-300 border-[#262930] hover:border-[#c9a227]/40"
            }`}
          >
            All Floors
          </button>
          {floorsList.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFloor(f.toString())}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                selectedFloor === f.toString()
                  ? "bg-[#c9a227] text-black border-[#c9a227]"
                  : "bg-[#1a1d24] text-gray-300 border-[#262930] hover:border-[#c9a227]/40"
              }`}
            >
              Floor {f}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#c9a227]"
          >
            <option value="ALL">All Housekeeping Statuses</option>
            <option value="DIRTY">DIRTY</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="CLEANING">CLEANING</option>
            <option value="CLEANING_COMPLETED">CLEANING COMPLETED</option>
            <option value="INSPECTION">INSPECTION</option>
            <option value="WAITING_FOR_RELEASE">WAITING FOR RELEASE</option>
            <option value="CLEAN">CLEAN</option>
          </select>

          {/* Search Box */}
          <div className="relative w-48">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search room #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white placeholder-gray-500 pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-[#c9a227]"
            />
          </div>
        </div>
      </div>

      {/* Main Room Operational Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredItems.map(({ room, task }) => {
          const statusKey = task.status || room.housekeepingStatus || "DIRTY";
          const statusStyle = STATUS_COLORS[statusKey] || STATUS_COLORS.DIRTY;
          const legalTransitions = LEGAL_NEXT_STATUSES[statusKey] || [];
          const isOccupied = room.occupancyStatus === "OCCUPIED";

          return (
            <div
              key={room._id}
              className={`bg-[#121316] rounded-2xl border p-4 shadow-xl space-y-4 flex flex-col justify-between transition-all hover:border-[#c9a227]/40 ${statusStyle.border}`}
            >
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-2xl font-bold text-white">Room {room.roomNumber}</span>
                    <span className="text-[10px] font-mono bg-[#1a1d24] text-gray-400 px-2 py-0.5 rounded border border-[#262930]">
                      Floor {room.floor || "1"}
                    </span>
                  </div>
                  {isOccupied ? (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                      OCCUPIED
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                      VACANT
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-400 truncate">
                  {room.roomCategory?.name || "Standard Luxury Suite"}
                </div>

                {/* Status Chip */}
                <div className={`p-2 rounded-xl border flex items-center justify-between text-xs font-bold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  <span className="uppercase font-mono">{statusKey.replace(/_/g, " ")}</span>
                  <Clock size={13} />
                </div>
              </div>

              {/* Task Details */}
              <div className="bg-[#1a1d24] p-3 rounded-xl border border-[#262930] space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="flex items-center gap-1"><User size={12} className="text-[#c9a227]" /> Attendant:</span>
                  <span className="font-semibold text-white">
                    {task.assignedTo?.firstName ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ''}` : "Unassigned"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-400">
                  <span className="flex items-center gap-1"><Tag size={12} className="text-[#c9a227]" /> Priority:</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    task.priority === "HIGH" || task.priority === "RUSH" ? "bg-red-500/20 text-red-300" : "bg-gray-800 text-gray-300"
                  }`}>
                    {task.priority || "NORMAL"}
                  </span>
                </div>

                {task.notes && (
                  <div className="text-[11px] text-gray-400 italic pt-1 border-t border-[#262930]">
                    "{task.notes}"
                  </div>
                )}
              </div>

              {/* Operational Action Triggers */}
              <div className="space-y-2 pt-1">
                {/* Assign Attendant Trigger */}
                <button
                  onClick={() => setAssignModal({ open: true, task })}
                  className="w-full py-1.5 bg-[#1a1d24] hover:bg-[#262930] text-gray-300 text-xs font-semibold rounded-xl border border-[#262930] transition flex items-center justify-center gap-1"
                >
                  <UserCheck size={13} className="text-[#c9a227]" /> Assign / Change Staff
                </button>

                {/* Legal Transition Actions */}
                <div className="grid grid-cols-1 gap-1.5">
                  {legalTransitions.map((tr) => (
                    <button
                      key={tr.status}
                      disabled={updatingTaskId === task._id}
                      onClick={() => handleUpdateStatus(task._id, tr.status)}
                      className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md ${tr.color} disabled:opacity-50`}
                    >
                      {updatingTaskId === task._id ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <>
                          <ArrowRight size={13} /> {tr.label}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ASSIGN ATTENDANT & PRIORITY */}
      {assignModal.open && assignModal.task && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-[#262930] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#262930] pb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="text-[#c9a227]" size={20} />
                <h3 className="font-serif text-lg font-bold">Assign Housekeeping Attendant</h3>
              </div>
              <button onClick={() => setAssignModal({ open: false, task: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Attendant Name / Staff Member</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar / Staff #104"
                value={cleanerName}
                onChange={(e) => setCleanerName(e.target.value)}
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Turnover Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              >
                <option value="LOW">LOW — Standard Maintenance</option>
                <option value="MEDIUM">MEDIUM — Standard Turnover</option>
                <option value="HIGH">HIGH — Today Arrival Priority</option>
                <option value="RUSH">RUSH — VIP Arrival Imminent</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#262930] pt-4">
              <button onClick={() => setAssignModal({ open: false, task: null })} className="px-4 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold">
                Cancel
              </button>
              <button
                disabled={!cleanerName}
                onClick={handleAssignSubmit}
                className="px-5 py-2 bg-[#c9a227] hover:bg-[#e5c76b] text-black rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                Assign & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
