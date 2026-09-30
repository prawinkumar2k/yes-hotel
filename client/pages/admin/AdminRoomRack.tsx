import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BedDouble, RefreshCw, Filter, CheckCircle2, AlertTriangle, ShieldCheck,
  User, Lock, Sparkles, AlertCircle, Wrench, ChevronRight, X, FileText,
  Clock, DollarSign, Calendar, ArrowRight, Layers, Tag, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface RoomRackItem {
  _id: string;
  roomNumber: string;
  floor?: string;
  occupancyStatus: "VACANT" | "OCCUPIED" | "RESERVED";
  housekeepingStatus: "CLEAN" | "DIRTY" | "CLEANING" | "CLEANING_COMPLETED" | "INSPECTION" | "WAITING_FOR_RELEASE";
  sellStatus: "SELLABLE" | "OUT_OF_ORDER" | "OUT_OF_SERVICE" | "BLOCKED";
  category?: {
    _id: string;
    name: string;
    basePrice: number;
  };
  currentBooking?: {
    _id: string;
    bookingReference: string;
    guestDetails: { firstName: string; lastName: string; phone: string; email: string };
    checkInDate: string;
    checkOutDate: string;
    isVipGuest?: boolean;
    totalPrice?: number;
    paidAmount?: number;
  };
  activeHousekeepingTask?: {
    _id: string;
    status: string;
    assignedTo?: { firstName: string; lastName: string };
    notes?: string;
  };
  activeMaintenanceTicket?: {
    _id: string;
    priority: string;
    issueTitle: string;
    status: string;
  };
}

interface FloorGroup {
  floor: string;
  rooms: RoomRackItem[];
}

export default function AdminRoomRack() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [selectedHousekeeping, setSelectedHousekeeping] = useState<string>("ALL");
  const [selectedSellStatus, setSelectedSellStatus] = useState<string>("ALL");
  const [selectedOccupancy, setSelectedOccupancy] = useState<string>("ALL");

  const { data: rackData, isLoading: loading, refetch } = useQuery({
    queryKey: ["room-rack", selectedFloor, selectedHousekeeping, selectedSellStatus, selectedOccupancy],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const params = new URLSearchParams();
      if (selectedFloor !== "ALL") params.append("floor", selectedFloor);
      if (selectedHousekeeping !== "ALL") params.append("housekeepingStatus", selectedHousekeeping);
      if (selectedSellStatus !== "ALL") params.append("sellStatus", selectedSellStatus);
      if (selectedOccupancy !== "ALL") params.append("occupancyStatus", selectedOccupancy);

      const res = await fetch(`/api/room-rack?${params.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    }
  });

  const floors = rackData?.floors || [];
  const totalRooms = rackData?.totalRooms || 0;

  // Slide-over drawer state
  const [drawerRoom, setDrawerRoom] = useState<RoomRackItem | null>(null);
  const [drawerFolio, setDrawerFolio] = useState<any | null>(null);
  const [loadingFolio, setLoadingFolio] = useState(false);

  // Modals
  const [releaseModalRoom, setReleaseModalRoom] = useState<RoomRackItem | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [submittingRelease, setSubmittingRelease] = useState(false);

  const [sellStatusModalRoom, setSellStatusModalRoom] = useState<RoomRackItem | null>(null);
  const [targetSellStatus, setTargetSellStatus] = useState<string>("OUT_OF_ORDER");
  const [sellStatusReason, setSellStatusReason] = useState("");
  const [submittingSellStatus, setSubmittingSellStatus] = useState(false);

  // Removed fetchRack and useEffect as useQuery handles it automatically.

  // Open Room Drawer & Fetch Folio
  const handleOpenRoomDrawer = async (room: RoomRackItem) => {
    setDrawerRoom(room);
    setDrawerFolio(null);
    if (room.currentBooking?._id) {
      setLoadingFolio(true);
      try {
        const token = getStoredAuthToken();
        const res = await fetch(`/api/folios/booking/${room.currentBooking._id}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const json = await res.json();
        if (json.success) {
          setDrawerFolio(json.data);
        }
      } catch (err) {
        console.error("Failed to load folio for drawer", err);
      } finally {
        setLoadingFolio(false);
      }
    }
  };

  const handleManualRelease = async () => {
    if (!releaseModalRoom) return;
    setSubmittingRelease(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/room-rack/${releaseModalRoom._id}/manual-release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes: releaseNotes }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Room Released", description: json.message });
        setReleaseModalRoom(null);
        setReleaseNotes("");
        queryClient.invalidateQueries({ queryKey: ["room-rack"] });
      } else {
        toast({ title: "Release Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingRelease(false);
    }
  };

  const handleUpdateSellStatus = async () => {
    if (!sellStatusModalRoom) return;
    setSubmittingSellStatus(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/room-rack/${sellStatusModalRoom._id}/sell-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sellStatus: targetSellStatus, reason: sellStatusReason }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Sell Status Updated", description: json.message });
        setSellStatusModalRoom(null);
        setSellStatusReason("");
        queryClient.invalidateQueries({ queryKey: ["room-rack"] });
      } else {
        toast({ title: "Update Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingSellStatus(false);
    }
  };

  const getOccupancyBadge = (status: string) => {
    switch (status) {
      case "OCCUPIED":
        return <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><User size={10} /> Occupied</span>;
      case "RESERVED":
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Lock size={10} /> Reserved</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10} /> Vacant</span>;
    }
  };

  const getHousekeepingBadge = (status: string) => {
    switch (status) {
      case "CLEAN":
        return <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded">Clean</span>;
      case "DIRTY":
        return <span className="text-[10px] bg-red-100 text-red-800 border border-red-200 font-bold px-2 py-0.5 rounded">Dirty</span>;
      case "CLEANING":
        return <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 font-bold px-2 py-0.5 rounded">Cleaning</span>;
      case "INSPECTION":
        return <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-200 font-bold px-2 py-0.5 rounded">Inspecting</span>;
      case "WAITING_FOR_RELEASE":
        return <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 font-bold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"><ShieldCheck size={10} /> Release Req</span>;
      default:
        return <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{status}</span>;
    }
  };

  const getSellStatusBadge = (status: string) => {
    if (status === "SELLABLE") return null;
    switch (status) {
      case "OUT_OF_ORDER":
        return <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-200 flex items-center gap-1"><AlertTriangle size={10} /> OOO</span>;
      case "OUT_OF_SERVICE":
        return <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1"><Wrench size={10} /> OOS</span>;
      case "BLOCKED":
        return <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded border border-slate-300">Blocked</span>;
      default:
        return null;
    }
  };

  if (loading && floors.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-12 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-hotel-gold text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-slate-500 mt-3 font-mono">Loading Interactive Room Rack 2.0...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-hotel-gold-text">
            <BedDouble size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-800 flex items-center gap-2">
              Interactive Room Rack 2.0
              <span className="text-xs bg-amber-100 text-hotel-gold-text px-2.5 py-0.5 rounded-full font-mono border border-amber-200 font-bold">OPERATIONAL MATRIX</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Architectural floor layout, multi-dimensional room states, slide-over guest folio drawer & OOO lock controls
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-hotel-gold text-black font-bold rounded-xl hover:bg-amber-500 transition text-xs shadow-xs disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Sync Room Rack Grid
        </button>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Filter size={14} /> Matrix Filters:
          </span>

          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-1.5 focus:border-hotel-gold"
          >
            <option value="ALL">All Floors</option>
            <option value="G">Ground Floor</option>
            <option value="1">Floor 1</option>
            <option value="2">Floor 2</option>
            <option value="3">Floor 3</option>
          </select>

          <select
            value={selectedHousekeeping}
            onChange={(e) => setSelectedHousekeeping(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-1.5 focus:border-hotel-gold"
          >
            <option value="ALL">All Housekeeping States</option>
            <option value="CLEAN">Clean</option>
            <option value="DIRTY">Dirty</option>
            <option value="CLEANING">Cleaning</option>
            <option value="INSPECTION">Inspection</option>
            <option value="WAITING_FOR_RELEASE">Waiting Release</option>
          </select>

          <select
            value={selectedSellStatus}
            onChange={(e) => setSelectedSellStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-1.5 focus:border-hotel-gold"
          >
            <option value="ALL">All Operational States</option>
            <option value="SELLABLE">Sellable</option>
            <option value="OUT_OF_ORDER">Out of Order (OOO)</option>
            <option value="OUT_OF_SERVICE">Out of Service (OOS)</option>
            <option value="BLOCKED">Blocked</option>
          </select>

          <select
            value={selectedOccupancy}
            onChange={(e) => setSelectedOccupancy(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-1.5 focus:border-hotel-gold"
          >
            <option value="ALL">All Occupancy States</option>
            <option value="VACANT">Vacant</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="RESERVED">Reserved</option>
          </select>
        </div>

        <div className="text-xs font-mono text-slate-500">
          Total Rooms: <span className="text-hotel-gold-text font-bold text-sm">{totalRooms}</span>
        </div>
      </div>

      {/* Grid Content by Floors */}
      {floors.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl text-center border border-slate-200 text-slate-500 shadow-xs">
          <AlertCircle size={40} className="mx-auto text-slate-400 mb-2 opacity-50" />
          <p className="text-sm font-medium">No rooms found matching selected room rack filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map((floorGroup) => (
            <div key={floorGroup.floor} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-serif font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-hotel-gold"></span> Floor {floorGroup.floor} Architectural Block
                </h2>
                <span className="text-xs font-mono text-slate-500">{floorGroup.rooms.length} Rooms</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {floorGroup.rooms.map((room) => {
                  const isWaitingRelease = room.housekeepingStatus === "WAITING_FOR_RELEASE";
                  const isOoo = room.sellStatus !== "SELLABLE";
                  const isOccupied = room.occupancyStatus === "OCCUPIED";

                  return (
                    <div
                      key={room._id}
                      onClick={() => handleOpenRoomDrawer(room)}
                      className={`cursor-pointer border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3 hover:shadow-md ${
                        isOoo
                          ? "bg-red-50 border-red-200"
                          : isWaitingRelease
                          ? "bg-purple-50 border-purple-300 ring-1 ring-purple-400"
                          : isOccupied
                          ? "bg-purple-50/60 border-purple-200"
                          : "bg-white border-slate-200 hover:border-amber-400"
                      }`}
                    >
                      <div>
                        {/* Header: Room Number & Sell Status */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xl font-serif font-bold text-slate-800">
                            Room {room.roomNumber}
                          </span>
                          {getSellStatusBadge(room.sellStatus)}
                        </div>

                        {/* Category */}
                        <p className="text-xs text-slate-500 font-medium mb-3">
                          {room.category?.name || "Suite"} · ₹{room.category?.basePrice || 0}/night
                        </p>

                        {/* Multi-Dimensional Status Chips */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {getOccupancyBadge(room.occupancyStatus)}
                          {getHousekeepingBadge(room.housekeepingStatus)}
                        </div>

                        {/* Current Guest Summary if Occupied */}
                        {room.currentBooking && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span className="truncate">{room.currentBooking.guestDetails?.firstName} {room.currentBooking.guestDetails?.lastName}</span>
                              {room.currentBooking.isVipGuest && (
                                <span className="bg-amber-100 text-hotel-gold-text text-[9px] px-1 py-0.5 rounded font-bold border border-amber-200">VIP</span>
                              )}
                            </div>
                            <p className="text-slate-500 text-[10px] font-mono">#{room.currentBooking.bookingReference}</p>
                          </div>
                        )}
                      </div>

                      {/* Room Action Triggers */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-hotel-gold-text font-semibold flex items-center gap-1">
                          <Eye size={12} /> Inspect Details
                        </span>
                        {isWaitingRelease && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReleaseModalRoom(room);
                            }}
                            className="text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded"
                          >
                            Release
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SLIDE-OVER DRAWER: DEEP OPERATIONAL DETAILS */}
      {drawerRoom && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white border-l border-slate-200 w-full max-w-xl h-full p-6 shadow-2xl overflow-y-auto space-y-6 text-slate-800 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-hotel-gold-text">
                    <BedDouble size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-slate-800">Room {drawerRoom.roomNumber} Detail Inspector</h3>
                    <p className="text-xs text-slate-500 font-mono">{drawerRoom.category?.name || "Standard Luxury Suite"} · Floor {drawerRoom.floor || "1"}</p>
                  </div>
                </div>
                <button onClick={() => setDrawerRoom(null)} className="text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              {/* Status Ribbon */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">Occupied Rooms</span>
                  <div className="flex justify-center">{getOccupancyBadge(drawerRoom.occupancyStatus)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">Housekeeping</span>
                  <div className="flex justify-center">{getHousekeepingBadge(drawerRoom.housekeepingStatus)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">Sell Status</span>
                  <div className="text-xs font-bold text-slate-800">{drawerRoom.sellStatus}</div>
                </div>
              </div>

              {/* Guest & Booking Card */}
              {drawerRoom.currentBooking ? (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-hotel-gold-text">Active Reservation Details</span>
                    <span className="text-xs font-mono text-slate-500">#{drawerRoom.currentBooking.bookingReference}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block font-mono">Guest Name:</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {drawerRoom.currentBooking.guestDetails?.firstName} {drawerRoom.currentBooking.guestDetails?.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-mono">Phone:</span>
                      <span className="font-mono text-slate-800">{drawerRoom.currentBooking.guestDetails?.phone || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-mono">Check-In Date:</span>
                      <span className="font-mono text-slate-800">{new Date(drawerRoom.currentBooking.checkInDate).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-mono">Check-Out Date:</span>
                      <span className="font-mono text-slate-800">{new Date(drawerRoom.currentBooking.checkOutDate).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Folio Breakdown inside Drawer */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 mt-3 font-mono text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Room Charges:</span>
                      <span className="text-slate-800">₹{(drawerRoom.currentBooking.totalPrice || 0).toLocaleString()}</span>
                    </div>
                    {drawerFolio && (
                      <div className="flex justify-between text-slate-500">
                        <span>Net Folio Balance:</span>
                        <span className="text-hotel-gold-text font-bold">₹{(drawerFolio.balance || 0).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center py-6 text-xs text-slate-500">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-2" />
                  Room is currently vacant and available for guest assignment.
                </div>
              )}

              {/* Maintenance & Housekeeping Records */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Maintenance & Task Status</h4>
                {drawerRoom.activeMaintenanceTicket ? (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-red-800 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Active Maintenance Ticket
                    </div>
                    <p className="text-slate-700">{drawerRoom.activeMaintenanceTicket.issueTitle}</p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-500">
                    No open maintenance work orders logged against Room {drawerRoom.roomNumber}.
                  </div>
                )}
              </div>

              {/* Action Triggers */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-hotel-gold-text">Room Action Triggers</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setDrawerRoom(null);
                      setSellStatusModalRoom(drawerRoom);
                    }}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center justify-center gap-1"
                  >
                    <Wrench size={14} className="text-hotel-gold-text" /> Lock / OOO Status
                  </button>

                  <Link
                    to="/admin/front-desk"
                    className="py-2.5 bg-hotel-gold hover:bg-amber-500 text-black text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 text-center shadow-xs"
                  >
                    Front Desk Action →
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Close */}
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => setDrawerRoom(null)}
                className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition"
              >
                Close Room Inspector Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Release Modal */}
      {releaseModalRoom && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2 text-slate-800">
                <ShieldCheck className="text-purple-600" size={20} /> Authorize Manual Release
              </h3>
              <button onClick={() => setReleaseModalRoom(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Authorizing manual release of <strong className="text-slate-800">Room {releaseModalRoom.roomNumber}</strong> from{" "}
              <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono text-[10px]">WAITING_FOR_RELEASE</span> to{" "}
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-[10px]">CLEAN & SELLABLE</span>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Release Audit Notes</label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Verified physical room cleanliness"
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2.5 focus:border-hotel-gold"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setReleaseModalRoom(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleManualRelease}
                disabled={submittingRelease}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {submittingRelease ? "Releasing..." : "Authorize Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Sell Status Modal */}
      {sellStatusModalRoom && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2 text-slate-800">
                <Wrench className="text-hotel-gold-text" size={20} /> Update Operational Sell Status
              </h3>
              <button onClick={() => setSellStatusModalRoom(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Update operational sell status for <strong className="text-slate-800">Room {sellStatusModalRoom.roomNumber}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Target Sell Status</label>
              <select
                value={targetSellStatus}
                onChange={(e) => setTargetSellStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2.5 focus:border-hotel-gold"
              >
                <option value="SELLABLE">SELLABLE (Available for booking)</option>
                <option value="OUT_OF_ORDER">OUT_OF_ORDER (OOO — Major maintenance)</option>
                <option value="OUT_OF_SERVICE">OUT_OF_SERVICE (OOS — Minor maintenance)</option>
                <option value="BLOCKED">BLOCKED (Managerial block)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Notes</label>
              <input
                type="text"
                value={sellStatusReason}
                onChange={(e) => setSellStatusReason(e.target.value)}
                placeholder="Plumbing repair under maintenance SLA"
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2.5 focus:border-hotel-gold"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSellStatusModalRoom(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSellStatus}
                disabled={submittingSellStatus}
                className="flex-1 py-2 bg-hotel-gold hover:bg-amber-500 text-black rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {submittingSellStatus ? "Saving..." : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
