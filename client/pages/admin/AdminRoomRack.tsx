import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BedDouble, RefreshCw, Filter, CheckCircle2, AlertTriangle, ShieldCheck,
  User, Lock, Sparkles, AlertCircle, Wrench, ChevronRight, X, FileText,
  Clock, DollarSign, Calendar, ArrowRight, Layers, Tag, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";

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
  const [loading, setLoading] = useState(true);
  const [floors, setFloors] = useState<FloorGroup[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);

  // Filters
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [selectedHousekeeping, setSelectedHousekeeping] = useState<string>("ALL");
  const [selectedSellStatus, setSelectedSellStatus] = useState<string>("ALL");
  const [selectedOccupancy, setSelectedOccupancy] = useState<string>("ALL");

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

  const fetchRack = async () => {
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      const params = new URLSearchParams();
      if (selectedFloor !== "ALL") params.append("floor", selectedFloor);
      if (selectedHousekeeping !== "ALL") params.append("housekeepingStatus", selectedHousekeeping);
      if (selectedSellStatus !== "ALL") params.append("sellStatus", selectedSellStatus);
      if (selectedOccupancy !== "ALL") params.append("occupancyStatus", selectedOccupancy);

      const res = await fetch(`/api/room-rack?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) {
        setFloors(json.data.floors || []);
        setTotalRooms(json.data.totalRooms || 0);
      } else {
        toast({ title: "Failed to load room rack", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRack();
  }, [selectedFloor, selectedHousekeeping, selectedSellStatus, selectedOccupancy]);

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
        fetchRack();
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
        fetchRack();
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
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><User size={10} /> Occupied</span>;
      case "RESERVED":
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Lock size={10} /> Reserved</span>;
      default:
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10} /> Vacant</span>;
    }
  };

  const getHousekeepingBadge = (status: string) => {
    switch (status) {
      case "CLEAN":
        return <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2 py-0.5 rounded">Clean</span>;
      case "DIRTY":
        return <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 font-bold px-2 py-0.5 rounded">Dirty</span>;
      case "CLEANING":
        return <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold px-2 py-0.5 rounded">Cleaning</span>;
      case "INSPECTION":
        return <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold px-2 py-0.5 rounded">Inspecting</span>;
      case "WAITING_FOR_RELEASE":
        return <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"><ShieldCheck size={10} /> Release Req</span>;
      default:
        return <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{status}</span>;
    }
  };

  const getSellStatusBadge = (status: string) => {
    if (status === "SELLABLE") return null;
    switch (status) {
      case "OUT_OF_ORDER":
        return <span className="text-[10px] bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1"><AlertTriangle size={10} /> OOO</span>;
      case "OUT_OF_SERVICE":
        return <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1"><Wrench size={10} /> OOS</span>;
      case "BLOCKED":
        return <span className="text-[10px] bg-gray-800 text-gray-300 font-bold px-2 py-0.5 rounded border border-gray-700">Blocked</span>;
      default:
        return null;
    }
  };

  if (loading && floors.length === 0) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white p-12 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-[#c9a227] text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-400 mt-3 font-mono">Loading Interactive Room Rack 2.0...</p>
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
              Interactive Room Rack 2.0
              <span className="text-xs bg-[#c9a227]/20 text-[#e5c76b] px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30">OPERATIONAL MATRIX</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Architectural floor layout, multi-dimensional room states, slide-over guest folio drawer & OOO lock controls
            </p>
          </div>
        </div>

        <button
          onClick={fetchRack}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a227] text-black font-bold rounded-xl hover:bg-[#e5c76b] transition text-xs shadow-md disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Sync Room Rack Grid
        </button>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-[#121316] p-4 rounded-2xl border border-[#262930] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Filter size={14} /> Matrix Filters:
          </span>

          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl px-3 py-1.5 focus:border-[#c9a227]"
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
            className="bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl px-3 py-1.5 focus:border-[#c9a227]"
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
            className="bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl px-3 py-1.5 focus:border-[#c9a227]"
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
            className="bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl px-3 py-1.5 focus:border-[#c9a227]"
          >
            <option value="ALL">All Occupancy States</option>
            <option value="VACANT">Vacant</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="RESERVED">Reserved</option>
          </select>
        </div>

        <div className="text-xs font-mono text-gray-400">
          Total Rooms: <span className="text-[#c9a227] font-bold text-sm">{totalRooms}</span>
        </div>
      </div>

      {/* Grid Content by Floors */}
      {floors.length === 0 ? (
        <div className="bg-[#121316] p-16 rounded-2xl text-center border border-[#262930] text-gray-500">
          <AlertCircle size={40} className="mx-auto text-gray-600 mb-2 opacity-50" />
          <p className="text-sm font-medium">No rooms found matching selected room rack filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map((floorGroup) => (
            <div key={floorGroup.floor} className="bg-[#121316] rounded-2xl border border-[#262930] p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#262930] pb-3">
                <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]"></span> Floor {floorGroup.floor} Architectural Block
                </h2>
                <span className="text-xs font-mono text-gray-400">{floorGroup.rooms.length} Rooms</span>
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
                      className={`cursor-pointer border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3 hover:scale-[1.02] shadow-lg ${
                        isOoo
                          ? "bg-red-500/10 border-red-500/40"
                          : isWaitingRelease
                          ? "bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-400"
                          : isOccupied
                          ? "bg-purple-950/20 border-purple-500/30"
                          : "bg-[#1a1d24] border-[#262930] hover:border-[#c9a227]"
                      }`}
                    >
                      <div>
                        {/* Header: Room Number & Sell Status */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xl font-serif font-bold text-white">
                            Room {room.roomNumber}
                          </span>
                          {getSellStatusBadge(room.sellStatus)}
                        </div>

                        {/* Category */}
                        <p className="text-xs text-gray-400 font-medium mb-3">
                          {room.category?.name || "Suite"} · ₹{room.category?.basePrice || 0}/night
                        </p>

                        {/* Multi-Dimensional Status Chips */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {getOccupancyBadge(room.occupancyStatus)}
                          {getHousekeepingBadge(room.housekeepingStatus)}
                        </div>

                        {/* Current Guest Summary if Occupied */}
                        {room.currentBooking && (
                          <div className="bg-[#121316] p-2.5 rounded-xl border border-[#262930] text-xs space-y-1">
                            <div className="flex items-center justify-between font-semibold text-white">
                              <span className="truncate">{room.currentBooking.guestDetails?.firstName} {room.currentBooking.guestDetails?.lastName}</span>
                              {room.currentBooking.isVipGuest && (
                                <span className="bg-[#c9a227]/20 text-[#e5c76b] text-[9px] px-1 py-0.5 rounded font-bold border border-[#c9a227]/30">VIP</span>
                              )}
                            </div>
                            <p className="text-gray-400 text-[10px] font-mono">#{room.currentBooking.bookingReference}</p>
                          </div>
                        )}
                      </div>

                      {/* Room Action Triggers */}
                      <div className="pt-2 border-t border-[#262930] flex items-center justify-between text-xs">
                        <span className="text-[#c9a227] font-semibold flex items-center gap-1">
                          <Eye size={12} /> Inspect Details
                        </span>
                        {isWaitingRelease && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReleaseModalRoom(room);
                            }}
                            className="text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#121316] border-l border-[#262930] w-full max-w-xl h-full p-6 shadow-2xl overflow-y-auto space-y-6 text-white flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#262930] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
                    <BedDouble size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold">Room {drawerRoom.roomNumber} Detail Inspector</h3>
                    <p className="text-xs text-gray-400 font-mono">{drawerRoom.category?.name || "Standard Luxury Suite"} · Floor {drawerRoom.floor || "1"}</p>
                  </div>
                </div>
                <button onClick={() => setDrawerRoom(null)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Status Ribbon */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1a1d24] p-3 rounded-xl border border-[#262930] text-center space-y-1">
                  <span className="text-[10px] text-gray-400 font-mono uppercase">Occupancy</span>
                  <div className="flex justify-center">{getOccupancyBadge(drawerRoom.occupancyStatus)}</div>
                </div>
                <div className="bg-[#1a1d24] p-3 rounded-xl border border-[#262930] text-center space-y-1">
                  <span className="text-[10px] text-gray-400 font-mono uppercase">Housekeeping</span>
                  <div className="flex justify-center">{getHousekeepingBadge(drawerRoom.housekeepingStatus)}</div>
                </div>
                <div className="bg-[#1a1d24] p-3 rounded-xl border border-[#262930] text-center space-y-1">
                  <span className="text-[10px] text-gray-400 font-mono uppercase">Sell Status</span>
                  <div className="text-xs font-bold text-white">{drawerRoom.sellStatus}</div>
                </div>
              </div>

              {/* Guest & Booking Card */}
              {drawerRoom.currentBooking ? (
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-[#262930] space-y-3">
                  <div className="flex justify-between items-center border-b border-[#262930] pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">Active Reservation Details</span>
                    <span className="text-xs font-mono text-gray-400">#{drawerRoom.currentBooking.bookingReference}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block font-mono">Guest Name:</span>
                      <span className="font-bold text-white text-sm">
                        {drawerRoom.currentBooking.guestDetails?.firstName} {drawerRoom.currentBooking.guestDetails?.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-mono">Phone:</span>
                      <span className="font-mono text-white">{drawerRoom.currentBooking.guestDetails?.phone || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-mono">Check-In Date:</span>
                      <span className="font-mono text-white">{new Date(drawerRoom.currentBooking.checkInDate).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-mono">Check-Out Date:</span>
                      <span className="font-mono text-white">{new Date(drawerRoom.currentBooking.checkOutDate).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Folio Breakdown inside Drawer */}
                  <div className="bg-[#121316] p-3 rounded-xl border border-[#262930] space-y-2 mt-3 font-mono text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Total Room Charges:</span>
                      <span className="text-white">₹{(drawerRoom.currentBooking.totalPrice || 0).toLocaleString()}</span>
                    </div>
                    {drawerFolio && (
                      <div className="flex justify-between text-gray-400">
                        <span>Net Folio Balance:</span>
                        <span className="text-[#c9a227] font-bold">₹{(drawerFolio.balance || 0).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-[#262930] text-center py-6 text-xs text-gray-400">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2" />
                  Room is currently vacant and available for guest assignment.
                </div>
              )}

              {/* Maintenance & Housekeeping Records */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Maintenance & Task Status</h4>
                {drawerRoom.activeMaintenanceTicket ? (
                  <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-red-300 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Active Maintenance Ticket
                    </div>
                    <p className="text-gray-300">{drawerRoom.activeMaintenanceTicket.issueTitle}</p>
                  </div>
                ) : (
                  <div className="bg-[#1a1d24] border border-[#262930] p-3 rounded-xl text-xs text-gray-400">
                    No open maintenance work orders logged against Room {drawerRoom.roomNumber}.
                  </div>
                )}
              </div>

              {/* Action Triggers */}
              <div className="space-y-2 pt-2 border-t border-[#262930]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">Room Action Triggers</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setDrawerRoom(null);
                      setSellStatusModalRoom(drawerRoom);
                    }}
                    className="py-2.5 bg-[#1a1d24] hover:bg-[#262930] text-gray-300 text-xs font-semibold rounded-xl border border-[#262930] transition flex items-center justify-center gap-1"
                  >
                    <Wrench size={14} className="text-[#c9a227]" /> Lock / OOO Status
                  </button>

                  <Link
                    to="/admin/front-desk"
                    className="py-2.5 bg-[#c9a227] hover:bg-[#e5c76b] text-black text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 text-center shadow-md"
                  >
                    Front Desk Action →
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Close */}
            <div className="border-t border-[#262930] pt-4">
              <button
                onClick={() => setDrawerRoom(null)}
                className="w-full py-2.5 bg-[#262930] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition"
              >
                Close Room Inspector Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Release Modal */}
      {releaseModalRoom && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#262930] text-white">
            <div className="flex justify-between items-center border-b border-[#262930] pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <ShieldCheck className="text-purple-400" size={20} /> Authorize Manual Release
              </h3>
              <button onClick={() => setReleaseModalRoom(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Authorizing manual release of <strong className="text-white">Room {releaseModalRoom.roomNumber}</strong> from{" "}
              <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono text-[10px]">WAITING_FOR_RELEASE</span> to{" "}
              <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono text-[10px]">CLEAN & SELLABLE</span>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Release Audit Notes</label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Verified physical room cleanliness"
                className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setReleaseModalRoom(null)}
                className="flex-1 py-2 bg-[#1a1d24] rounded-xl text-xs text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleManualRelease}
                disabled={submittingRelease}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
              >
                {submittingRelease ? "Releasing..." : "Authorize Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Sell Status Modal */}
      {sellStatusModalRoom && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#262930] text-white">
            <div className="flex justify-between items-center border-b border-[#262930] pb-3">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                <Wrench className="text-[#c9a227]" size={20} /> Update Operational Sell Status
              </h3>
              <button onClick={() => setSellStatusModalRoom(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Update operational sell status for <strong className="text-white">Room {sellStatusModalRoom.roomNumber}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Target Sell Status</label>
              <select
                value={targetSellStatus}
                onChange={(e) => setTargetSellStatus(e.target.value)}
                className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              >
                <option value="SELLABLE">SELLABLE (Available for booking)</option>
                <option value="OUT_OF_ORDER">OUT_OF_ORDER (OOO — Major maintenance)</option>
                <option value="OUT_OF_SERVICE">OUT_OF_SERVICE (OOS — Minor maintenance)</option>
                <option value="BLOCKED">BLOCKED (Managerial block)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Reason / Notes</label>
              <input
                type="text"
                value={sellStatusReason}
                onChange={(e) => setSellStatusReason(e.target.value)}
                placeholder="Plumbing repair under maintenance SLA"
                className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSellStatusModalRoom(null)}
                className="flex-1 py-2 bg-[#1a1d24] rounded-xl text-xs text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSellStatus}
                disabled={submittingSellStatus}
                className="flex-1 py-2 bg-[#c9a227] hover:bg-[#e5c76b] text-black rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
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
