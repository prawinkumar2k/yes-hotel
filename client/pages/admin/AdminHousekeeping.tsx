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
  DIRTY: { bg: "bg-red-50", text: "text-red-900 font-bold", border: "border-red-200" },
  ASSIGNED: { bg: "bg-amber-50", text: "text-amber-900 font-bold", border: "border-amber-200" },
  CLEANING: { bg: "bg-sky-50", text: "text-sky-900 font-bold", border: "border-sky-200" },
  CLEANING_COMPLETED: { bg: "bg-blue-50", text: "text-blue-900 font-bold", border: "border-blue-200" },
  INSPECTION: { bg: "bg-purple-50", text: "text-purple-900 font-bold", border: "border-purple-200" },
  INSPECTION_FAILED: { bg: "bg-rose-50", text: "text-rose-900 font-bold", border: "border-rose-200" },
  INSPECTED: { bg: "bg-indigo-50", text: "text-indigo-900 font-bold", border: "border-indigo-200" },
  WAITING_FOR_RELEASE: { bg: "bg-orange-50", text: "text-orange-900 font-bold", border: "border-orange-200" },
  CLEAN: { bg: "bg-emerald-50", text: "text-emerald-900 font-bold", border: "border-emerald-200" },
};

const LEGAL_NEXT_STATUSES: Record<string, { label: string; status: string; color: string }[]> = {
  DIRTY: [
    { label: "Start Cleaning", status: "CLEANING", color: "bg-blue-600 hover:bg-blue-700 text-white font-semibold" },
    { label: "Assign Attendant", status: "ASSIGNED", color: "bg-amber-600 hover:bg-amber-700 text-white font-semibold" }
  ],
  ASSIGNED: [
    { label: "Begin Cleaning", status: "CLEANING", color: "bg-blue-600 hover:bg-blue-700 text-white font-semibold" },
  ],
  CLEANING: [
    { label: "Complete Cleaning", status: "CLEANING_COMPLETED", color: "bg-sky-600 hover:bg-sky-700 text-white font-semibold" },
  ],
  CLEANING_COMPLETED: [
    { label: "Send to Inspection", status: "INSPECTION", color: "bg-purple-600 hover:bg-purple-700 text-white font-semibold" },
    { label: "Mark Clean", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" }
  ],
  INSPECTION: [
    { label: "Pass & Release", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" },
    { label: "Fail Inspection", status: "INSPECTION_FAILED", color: "bg-rose-600 hover:bg-rose-700 text-white font-semibold" }
  ],
  INSPECTION_FAILED: [
    { label: "Re-Clean Room", status: "DIRTY", color: "bg-red-600 hover:bg-red-700 text-white font-semibold" },
  ],
  INSPECTED: [
    { label: "Release Room", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" }
  ],
  WAITING_FOR_RELEASE: [
    { label: "Authorize Release", status: "CLEAN", color: "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" }
  ],
  CLEAN: [
    { label: "Mark Dirty", status: "DIRTY", color: "bg-stone-200 text-red-800 hover:bg-red-100 hover:text-red-900 border border-red-300 font-semibold" }
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

  // Proof photo upload modal state
  const [proofUploadModal, setProofUploadModal] = useState<{ open: boolean; taskId: string; targetStatus: string; roomNumber?: string }>({
    open: false,
    taskId: "",
    targetStatus: "",
  });
  const [cleaningProofPhoto, setCleaningProofPhoto] = useState<string>("");
  const [viewCleaningProofModal, setViewCleaningProofModal] = useState<{ open: boolean; photo: string; roomNumber: string; staffName?: string } | null>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCleaningProofPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateStatus = async (taskId: string, targetStatus: string, roomNumber?: string, photoOverride?: string) => {
    if ((targetStatus === "CLEANING_COMPLETED" || targetStatus === "CLEAN") && !photoOverride && !cleaningProofPhoto) {
      setProofUploadModal({ open: true, taskId, targetStatus, roomNumber });
      return;
    }

    setUpdatingTaskId(taskId);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/admin/housekeeping/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: targetStatus,
          cleaningProofPhoto: photoOverride || cleaningProofPhoto || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Housekeeping Status Updated", description: `Task transitioned to ${targetStatus}` });
        setProofUploadModal({ open: false, taskId: "", targetStatus: "" });
        setCleaningProofPhoto("");
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
      
      const payload: any = {
        priority,
        notes: `Assigned to ${cleanerName}`,
      };
      if (!assignModal.task.status || assignModal.task.status === "DIRTY") {
        payload.status = "ASSIGNED";
      }

      const res = await fetch(`/api/admin/housekeeping/${assignModal.task._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
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

  const floorsList = Array.from(new Set(rooms.map((r) => r.floor || "1"))).sort();

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

  const dirtyCount = combinedItems.filter((i) => (i.task.status || i.room.housekeepingStatus) === "DIRTY").length;
  const cleaningCount = combinedItems.filter((i) => (i.task.status || i.room.housekeepingStatus) === "CLEANING").length;
  const inspectionCount = combinedItems.filter((i) => ["INSPECTION", "CLEANING_COMPLETED"].includes(i.task.status || i.room.housekeepingStatus)).length;
  const cleanCount = combinedItems.filter((i) => (i.task.status || i.room.housekeepingStatus) === "CLEAN").length;

  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-12 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-amber-600 text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-slate-500 mt-3 font-mono">Loading Housekeeping Visual Board...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100/80 rounded-xl border border-amber-200 text-amber-700">
            <BedDouble size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
              Housekeeping Visual Operations Board
              <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-mono font-bold border border-amber-300">REAL-TIME</span>
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Live floor turnover status, housekeeping tasks, inspector verification & supervisor release management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/staff/mobile-housekeeping"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-amber-800 hover:bg-amber-50 rounded-xl transition text-xs font-semibold border border-amber-300/80 shadow-sm"
          >
            <Sparkles size={16} /> Mobile HK View
          </Link>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 rounded-xl transition text-xs font-bold shadow-sm"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Sync Floor Data
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/50 shadow-sm">
          <div className="flex items-center justify-between text-red-700 mb-2">
            <AlertCircle size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-900 px-2 py-0.5 rounded border border-red-300">Dirty Rooms</span>
          </div>
          <p className="text-3xl font-serif font-bold text-red-950">{dirtyCount}</p>
          <p className="text-xs font-semibold text-red-700 mt-1">Pending Turnover</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-sky-200 bg-sky-50/50 shadow-sm">
          <div className="flex items-center justify-between text-sky-700 mb-2">
            <Clock size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-900 px-2 py-0.5 rounded border border-sky-300">In Cleaning</span>
          </div>
          <p className="text-3xl font-serif font-bold text-sky-950">{cleaningCount}</p>
          <p className="text-xs font-semibold text-sky-700 mt-1">Attendant On-Site</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-purple-50/50 shadow-sm">
          <div className="flex items-center justify-between text-purple-700 mb-2">
            <ShieldCheck size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 px-2 py-0.5 rounded border border-purple-300">Pending Inspection</span>
          </div>
          <p className="text-3xl font-serif font-bold text-purple-950">{inspectionCount}</p>
          <p className="text-xs font-semibold text-purple-700 mt-1">Ready for Supervisor</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <CheckCircle2 size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">Clean & Ready</span>
          </div>
          <p className="text-3xl font-serif font-bold text-emerald-950">{cleanCount}</p>
          <p className="text-xs font-semibold text-emerald-700 mt-1">Available for Guest Check-In</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Floor Selection */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Layers size={14} className="text-amber-600" /> Floor:
          </span>
          <button
            onClick={() => setSelectedFloor("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
              selectedFloor === "ALL"
                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300"
            }`}
          >
            All Floors
          </button>
          {floorsList.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFloor(f.toString())}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                selectedFloor === f.toString()
                  ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300"
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
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 focus:bg-white"
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
          <div className="relative flex-1 md:w-48 md:flex-none">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search room #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white"
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
              className={`bg-white rounded-2xl border p-4 shadow-sm space-y-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-amber-400/60 ${statusStyle.border}`}
            >
              {/* Header */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-serif text-xl sm:text-2xl font-bold text-slate-900 whitespace-nowrap">Room {room.roomNumber}</span>
                    <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                      Floor {room.floor || "1"}
                    </span>
                  </div>
                  {isOccupied ? (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 whitespace-nowrap">
                      OCCUPIED
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 whitespace-nowrap">
                      VACANT
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium truncate">
                  {room.roomCategory?.name || "Standard Luxury Suite"}
                </div>

                {/* Status Chip */}
                <div className={`p-2 rounded-xl border flex items-center justify-between text-xs font-bold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  <span className="uppercase font-mono tracking-wider">{statusKey.replace(/_/g, " ")}</span>
                  <Clock size={13} />
                </div>
              </div>

              {/* Task Details & Cleaning Proof */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-slate-600 font-semibold"><User size={12} className="text-amber-600" /> Attendant:</span>
                  <span className="font-bold text-slate-900">
                    {task.assignedTo?.firstName ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ''}` : "Unassigned"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-slate-600 font-semibold"><Tag size={12} className="text-amber-600" /> Priority:</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                    task.priority === "HIGH" || task.priority === "RUSH" 
                      ? "bg-red-100 text-red-900 border-red-300" 
                      : "bg-slate-200 text-slate-800 border-slate-300"
                  }`}>
                    {task.priority || "NORMAL"}
                  </span>
                </div>

                {(task.cleaningProofPhoto || room.cleaningProofPhoto) && (
                  <button
                    onClick={() => setViewCleaningProofModal({
                      open: true,
                      photo: task.cleaningProofPhoto || room.cleaningProofPhoto,
                      roomNumber: room.roomNumber,
                      staffName: task.assignedTo?.firstName ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ''}` : "Staff Member"
                    })}
                    className="w-full py-1.5 px-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1"
                  >
                    📷 View Cleaning Proof Photo
                  </button>
                )}

                {task.notes && (
                  <div className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-200">
                    "{task.notes}"
                  </div>
                )}
              </div>

              {/* Operational Action Triggers */}
              <div className="space-y-2 pt-1">
                {!["CLEAN", "WAITING_FOR_RELEASE", "INSPECTED"].includes(task.status || room.housekeepingStatus || "") && (
                  <button
                    onClick={() => setAssignModal({ open: true, task })}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center justify-center gap-1"
                  >
                    <UserCheck size={13} className="text-amber-600" /> Assign / Change Staff
                  </button>
                )}

                {/* Legal Transition Actions */}
                <div className="grid grid-cols-1 gap-1.5">
                  {legalTransitions.map((tr) => (
                    <button
                      key={tr.status}
                      disabled={updatingTaskId === task._id}
                      onClick={() => handleUpdateStatus(task._id, tr.status, room.roomNumber)}
                      className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm ${tr.color} disabled:opacity-50`}
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="text-amber-600" size={20} />
                <h3 className="font-serif text-lg font-bold text-slate-900">Assign Housekeeping Attendant</h3>
              </div>
              <button onClick={() => setAssignModal({ open: false, task: null })} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Attendant Name / Staff Member</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar / Staff #104"
                value={cleanerName}
                onChange={(e) => setCleanerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl p-3 focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Turnover Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl p-3 focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
              >
                <option value="LOW">LOW — Standard Maintenance</option>
                <option value="MEDIUM">MEDIUM — Standard Turnover</option>
                <option value="HIGH">HIGH — Today Arrival Priority</option>
                <option value="RUSH">RUSH — VIP Arrival Imminent</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button onClick={() => setAssignModal({ open: false, task: null })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200">
                Cancel
              </button>
              <button
                disabled={!cleanerName}
                onClick={handleAssignSubmit}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
              >
                Assign & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD ROOM CLEANING PROOF PHOTO */}
      {proofUploadModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">📷 Upload Cleaning Proof Photo</h3>
              <button onClick={() => setProofUploadModal({ open: false, taskId: "", targetStatus: "" })} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Please snap or upload a photo proof of Room {proofUploadModal.roomNumber || "Cleaning Work"} (e.g. bed made, clean bathroom, room overview) to complete turnover.
            </p>

            <div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoFileChange}
                className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
              />
            </div>

            {cleaningProofPhoto && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-emerald-700 font-bold">✓ Photo Ready for Upload</p>
                <img src={cleaningProofPhoto} alt="Cleaning Proof Preview" className="h-40 w-full object-cover rounded-xl border border-slate-200" />
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                onClick={() => setProofUploadModal({ open: false, taskId: "", targetStatus: "" })}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(proofUploadModal.taskId, proofUploadModal.targetStatus, proofUploadModal.roomNumber, cleaningProofPhoto)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Confirm & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIGHTBOX VIEW CLEANING PROOF */}
      {viewCleaningProofModal?.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setViewCleaningProofModal(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-5 shadow-2xl space-y-4 text-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">📷 Room {viewCleaningProofModal.roomNumber} Cleaning Proof</h3>
                <p className="text-xs text-slate-500">Cleaned by {viewCleaningProofModal.staffName || "Staff Member"}</p>
              </div>
              <button onClick={() => setViewCleaningProofModal(null)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="flex justify-center max-h-[70vh] overflow-hidden rounded-xl bg-slate-900 border border-slate-200">
              <img src={viewCleaningProofModal.photo} alt="Cleaning Proof" className="max-h-[65vh] w-auto object-contain" />
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
              <span>Verified Room Turnover Photo</span>
              <button onClick={() => setViewCleaningProofModal(null)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-sm">
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


