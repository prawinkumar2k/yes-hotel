import React, { useState, useEffect } from "react";
import {
  BedDouble, RefreshCw, Filter, CheckCircle2, AlertTriangle, ShieldCheck,
  User, Lock, Sparkles, AlertCircle, Wrench, ChevronRight, X
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
    name: string;
    basePrice: number;
  };
  currentBooking?: {
    _id: string;
    bookingReference: string;
    guestDetails: { firstName: string; lastName: string; phone: string };
    checkInDate: string;
    checkOutDate: string;
    isVipGuest?: boolean;
  };
  activeHousekeepingTask?: {
    _id: string;
    status: string;
    assignedTo?: { name: string };
  };
  activeMaintenanceTicket?: {
    _id: string;
    priority: string;
    issueTitle: string;
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
        return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1"><User size={12} /> Occupied</span>;
      case "RESERVED":
        return <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1"><Lock size={12} /> Reserved</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> Vacant</span>;
    }
  };

  const getHousekeepingBadge = (status: string) => {
    switch (status) {
      case "CLEAN":
        return <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">Clean</span>;
      case "DIRTY":
        return <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">Dirty</span>;
      case "CLEANING":
        return <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">Cleaning</span>;
      case "INSPECTION":
        return <span className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded">Inspecting</span>;
      case "WAITING_FOR_RELEASE":
        return <span className="text-xs bg-purple-100 text-purple-900 border border-purple-300 font-bold px-2 py-0.5 rounded animate-pulse flex items-center gap-1"><ShieldCheck size={12} /> Release Required</span>;
      default:
        return <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{status}</span>;
    }
  };

  const getSellStatusBadge = (status: string) => {
    if (status === "SELLABLE") return null;
    switch (status) {
      case "OUT_OF_ORDER":
        return <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-300 flex items-center gap-1"><AlertTriangle size={12} /> OOO</span>;
      case "OUT_OF_SERVICE":
        return <span className="text-xs bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded border border-orange-300 flex items-center gap-1"><Wrench size={12} /> OOS</span>;
      case "BLOCKED":
        return <span className="text-xs bg-gray-200 text-gray-800 font-bold px-2 py-0.5 rounded border border-gray-400">Blocked</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <BedDouble className="text-hotel-gold" /> Visual Room Rack
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time multi-dimensional room status grid: Occupancy, Housekeeping & Operational Sell Status
          </p>
        </div>
        <button
          onClick={fetchRack}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-hotel-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Grid
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter size={16} /> Filters:
        </div>

        {/* Floor Filter */}
        <select
          value={selectedFloor}
          onChange={(e) => setSelectedFloor(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-hotel-gold outline-none"
        >
          <option value="ALL">All Floors</option>
          <option value="G">Ground Floor</option>
          <option value="1">Floor 1</option>
          <option value="2">Floor 2</option>
          <option value="3">Floor 3</option>
        </select>

        {/* Housekeeping Status */}
        <select
          value={selectedHousekeeping}
          onChange={(e) => setSelectedHousekeeping(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-hotel-gold outline-none"
        >
          <option value="ALL">All Housekeeping States</option>
          <option value="CLEAN">Clean</option>
          <option value="DIRTY">Dirty</option>
          <option value="CLEANING">Cleaning</option>
          <option value="INSPECTION">Inspection</option>
          <option value="WAITING_FOR_RELEASE">Waiting Release</option>
        </select>

        {/* Sell Status */}
        <select
          value={selectedSellStatus}
          onChange={(e) => setSelectedSellStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-hotel-gold outline-none"
        >
          <option value="ALL">All Operational States</option>
          <option value="SELLABLE">Sellable</option>
          <option value="OUT_OF_ORDER">Out of Order (OOO)</option>
          <option value="OUT_OF_SERVICE">Out of Service (OOS)</option>
          <option value="BLOCKED">Blocked</option>
        </select>

        {/* Occupancy Status */}
        <select
          value={selectedOccupancy}
          onChange={(e) => setSelectedOccupancy(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-hotel-gold outline-none"
        >
          <option value="ALL">All Occupancy States</option>
          <option value="VACANT">Vacant</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="RESERVED">Reserved</option>
        </select>

        <div className="ml-auto text-xs font-semibold text-gray-500">
          Total Rooms Shown: <span className="text-gray-900 font-bold text-sm">{totalRooms}</span>
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl text-center border border-gray-200">
          <div className="inline-block animate-spin text-hotel-gold text-2xl font-bold">YES HOTELS</div>
          <p className="text-sm text-gray-500 mt-2">Loading live room rack matrix...</p>
        </div>
      ) : floors.length === 0 ? (
        <div className="bg-white p-12 rounded-xl text-center border border-gray-200">
          <AlertCircle size={36} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-700 font-medium">No rooms found matching selected filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {floors.map((floorGroup) => (
            <div key={floorGroup.floor} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-hotel-gold"></span> Floor {floorGroup.floor}
                </h2>
                <span className="text-xs text-gray-500 font-semibold">{floorGroup.rooms.length} rooms</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {floorGroup.rooms.map((room) => {
                  const isWaitingRelease = room.housekeepingStatus === "WAITING_FOR_RELEASE";
                  const isOoo = room.sellStatus !== "SELLABLE";

                  return (
                    <div
                      key={room._id}
                      className={`relative border rounded-xl p-4 transition-all duration-200 flex flex-col justify-between ${
                        isOoo
                          ? "bg-red-50/50 border-red-200"
                          : isWaitingRelease
                          ? "bg-purple-50/60 border-purple-300 ring-2 ring-purple-400"
                          : room.occupancyStatus === "OCCUPIED"
                          ? "bg-purple-50/20 border-purple-200"
                          : "bg-gray-50/50 border-gray-200 hover:border-hotel-gold hover:shadow-md"
                      }`}
                    >
                      <div>
                        {/* Top bar: Room Number & Sell Status */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold font-serif text-gray-900">
                            Room {room.roomNumber}
                          </span>
                          {getSellStatusBadge(room.sellStatus)}
                        </div>

                        {/* Category & Price */}
                        <p className="text-xs text-gray-500 font-medium mb-3">
                          {room.category?.name || "Standard Room"} • ₹{room.category?.basePrice || 0}/night
                        </p>

                        {/* Status Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {getOccupancyBadge(room.occupancyStatus)}
                          {getHousekeepingBadge(room.housekeepingStatus)}
                        </div>

                        {/* Current Guest info if Occupied */}
                        {room.currentBooking && (
                          <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-xs space-y-1 mb-2">
                            <div className="flex items-center justify-between font-semibold text-gray-800">
                              <span className="truncate">{room.currentBooking.guestDetails?.firstName} {room.currentBooking.guestDetails?.lastName}</span>
                              {room.currentBooking.isVipGuest && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] px-1 rounded font-bold">VIP</span>
                              )}
                            </div>
                            <p className="text-gray-500 text-[11px]">Ref: #{room.currentBooking.bookingReference}</p>
                          </div>
                        )}

                        {/* Active Maintenance Ticket warning */}
                        {room.activeMaintenanceTicket && (
                          <div className="bg-orange-100 border border-orange-200 p-2 rounded text-[11px] text-orange-900 font-medium mb-2">
                            ⚠️ {room.activeMaintenanceTicket.issueTitle}
                          </div>
                        )}
                      </div>

                      {/* Room Action Buttons */}
                      <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between gap-1">
                        {isWaitingRelease ? (
                          <button
                            onClick={() => setReleaseModalRoom(room)}
                            className="w-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                          >
                            <ShieldCheck size={14} /> Release Room
                          </button>
                        ) : (
                          <button
                            onClick={() => setSellStatusModalRoom(room)}
                            className="text-[11px] text-gray-600 hover:text-gray-900 underline font-medium"
                          >
                            Manage Status
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

      {/* Manual Release Modal */}
      {releaseModalRoom && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <ShieldCheck className="text-purple-600" /> Manual Room Release
              </h3>
              <button onClick={() => setReleaseModalRoom(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              You are authorizing manual release of <strong>Room {releaseModalRoom.roomNumber}</strong> from{" "}
              <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono text-xs">WAITING_FOR_RELEASE</span> to{" "}
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-xs">CLEAN</span> and{" "}
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-xs">SELLABLE</span>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Release Audit Notes (Optional)</label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="e.g., Verified physical condition, manager authorized"
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setReleaseModalRoom(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleManualRelease}
                disabled={submittingRelease}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
              >
                {submittingRelease ? "Releasing..." : "Authorize Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Sell Status Modal */}
      {sellStatusModalRoom && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Wrench className="text-hotel-gold" /> Update Operational Sell Status
              </h3>
              <button onClick={() => setSellStatusModalRoom(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-600">
              Update sell status for <strong>Room {sellStatusModalRoom.roomNumber}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Target Status</label>
              <select
                value={targetSellStatus}
                onChange={(e) => setTargetSellStatus(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
              >
                <option value="SELLABLE">SELLABLE (Available for booking)</option>
                <option value="OUT_OF_ORDER">OUT_OF_ORDER (OOO — Major repairs)</option>
                <option value="OUT_OF_SERVICE">OUT_OF_SERVICE (OOS — Minor maintenance)</option>
                <option value="BLOCKED">BLOCKED (Managerial block)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Notes</label>
              <input
                type="text"
                value={sellStatusReason}
                onChange={(e) => setSellStatusReason(e.target.value)}
                placeholder="e.g., Plumbing repair under SLA"
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSellStatusModalRoom(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSellStatus}
                disabled={submittingSellStatus}
                className="flex-1 py-2 bg-hotel-black hover:bg-gray-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
              >
                {submittingSellStatus ? "Updating..." : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
