import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogIn, LogOut, Users, BedDouble, AlertCircle, RefreshCw,
  CheckCircle2, Clock, Calendar, ArrowRight, ShieldCheck, FileText, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";

interface FrontDeskSummary {
  todaysArrivals: any[];
  todaysDepartures: any[];
  inHouse: any[];
  dirtyRooms: any[];
  unassignedBookings: any[];
  counts: {
    arrivals: number;
    departures: number;
    inHouse: number;
    dirtyRooms: number;
    unassignedBookings: number;
  };
}

export default function AdminFrontDesk() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FrontDeskSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"ARRIVALS" | "DEPARTURES" | "IN_HOUSE" | "UNASSIGNED" | "DIRTY">("ARRIVALS");

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch("/api/front-desk/summary", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) {
        setSummary(json.data);
      } else {
        toast({ title: "Failed to load front desk summary", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading && !summary) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin text-hotel-gold text-2xl font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-500 mt-2">Initializing Front Desk Command Center...</p>
      </div>
    );
  }

  const counts = summary?.counts || { arrivals: 0, departures: 0, inHouse: 0, dirtyRooms: 0, unassignedBookings: 0 };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <LogIn className="text-hotel-gold" /> Front Desk Command Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time operations hub for Check-Ins, Check-Outs, Room Assignments & In-House Guests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/room-rack"
            className="flex items-center gap-2 px-4 py-2 bg-hotel-gold/10 text-hotel-gold hover:bg-hotel-gold/20 rounded-lg transition text-sm font-semibold border border-hotel-gold/30"
          >
            <BedDouble size={16} /> Open Room Rack
          </Link>
          <button
            onClick={fetchSummary}
            className="flex items-center gap-2 px-4 py-2 bg-hotel-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Arrivals Card */}
        <div
          onClick={() => setActiveTab("ARRIVALS")}
          className={`cursor-pointer bg-white p-5 rounded-xl border transition-all ${
            activeTab === "ARRIVALS" ? "border-emerald-500 ring-2 ring-emerald-200 shadow-md" : "border-gray-200 hover:border-emerald-400"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <LogIn size={20} />
            <span className="text-xs font-bold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">Arrivals</span>
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{counts.arrivals}</p>
          <p className="text-xs text-gray-500 mt-1">Expected Today</p>
        </div>

        {/* Departures Card */}
        <div
          onClick={() => setActiveTab("DEPARTURES")}
          className={`cursor-pointer bg-white p-5 rounded-xl border transition-all ${
            activeTab === "DEPARTURES" ? "border-blue-500 ring-2 ring-blue-200 shadow-md" : "border-gray-200 hover:border-blue-400"
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <LogOut size={20} />
            <span className="text-xs font-bold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">Departures</span>
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{counts.departures}</p>
          <p className="text-xs text-gray-500 mt-1">Checking Out Today</p>
        </div>

        {/* In House Card */}
        <div
          onClick={() => setActiveTab("IN_HOUSE")}
          className={`cursor-pointer bg-white p-5 rounded-xl border transition-all ${
            activeTab === "IN_HOUSE" ? "border-purple-500 ring-2 ring-purple-200 shadow-md" : "border-gray-200 hover:border-purple-400"
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <Users size={20} />
            <span className="text-xs font-bold uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded">In-House</span>
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{counts.inHouse}</p>
          <p className="text-xs text-gray-500 mt-1">Active Stay Guests</p>
        </div>

        {/* Unassigned Card */}
        <div
          onClick={() => setActiveTab("UNASSIGNED")}
          className={`cursor-pointer bg-white p-5 rounded-xl border transition-all ${
            activeTab === "UNASSIGNED" ? "border-amber-500 ring-2 ring-amber-200 shadow-md" : "border-gray-200 hover:border-amber-400"
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <AlertCircle size={20} />
            <span className="text-xs font-bold uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded">Unassigned</span>
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{counts.unassignedBookings}</p>
          <p className="text-xs text-gray-500 mt-1">Rooms to Allocate</p>
        </div>

        {/* Dirty Rooms Card */}
        <div
          onClick={() => setActiveTab("DIRTY")}
          className={`cursor-pointer bg-white p-5 rounded-xl border transition-all ${
            activeTab === "DIRTY" ? "border-red-500 ring-2 ring-red-200 shadow-md" : "border-gray-200 hover:border-red-400"
          }`}
        >
          <div className="flex items-center justify-between text-red-600 mb-2">
            <BedDouble size={20} />
            <span className="text-xs font-bold uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded">Dirty Rooms</span>
          </div>
          <p className="text-3xl font-bold font-serif text-gray-900">{counts.dirtyRooms}</p>
          <p className="text-xs text-gray-500 mt-1">Turnover Pending</p>
        </div>
      </div>

      {/* Main Tab Content Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab("ARRIVALS")}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "ARRIVALS" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Today's Arrivals ({summary?.todaysArrivals?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("DEPARTURES")}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "DEPARTURES" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Today's Departures ({summary?.todaysDepartures?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("IN_HOUSE")}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "IN_HOUSE" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            In-House Guests ({summary?.inHouse?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("UNASSIGNED")}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "UNASSIGNED" ? "border-amber-600 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Unassigned Reservations ({summary?.unassignedBookings?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("DIRTY")}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "DIRTY" ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Dirty / Unreleased Rooms ({summary?.dirtyRooms?.length || 0})
          </button>
        </div>

        {/* Tab 1: Arrivals */}
        {activeTab === "ARRIVALS" && (
          <div className="space-y-4">
            {summary?.todaysArrivals.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No expected arrivals remaining for today.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                    <tr>
                      <th className="p-3 rounded-l-lg">Booking Ref</th>
                      <th className="p-3">Guest Name</th>
                      <th className="p-3">Room Category</th>
                      <th className="p-3">Assigned Room</th>
                      <th className="p-3">Nights</th>
                      <th className="p-3 rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary?.todaysArrivals.map((b: any) => (
                      <tr key={b._id} className="hover:bg-gray-50/80">
                        <td className="p-3 font-mono font-bold text-gray-900">#{b.bookingReference}</td>
                        <td className="p-3 font-medium text-gray-900">
                          {b.guestDetails?.firstName} {b.guestDetails?.lastName}
                          {b.isVipGuest && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">VIP</span>}
                        </td>
                        <td className="p-3 text-gray-600">{b.roomCategory?.name || "Standard"}</td>
                        <td className="p-3">
                          {b.assignedRoom ? (
                            <span className="font-serif font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              Room {b.assignedRoom.roomNumber}
                            </span>
                          ) : (
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-600">{b.numberOfNights} night(s)</td>
                        <td className="p-3 text-right">
                          <Link
                            to={`/admin/check-in?bookingId=${b._id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
                          >
                            Process Check-In <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Departures */}
        {activeTab === "DEPARTURES" && (
          <div className="space-y-4">
            {summary?.todaysDepartures.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No departures scheduled for today.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                    <tr>
                      <th className="p-3 rounded-l-lg">Room</th>
                      <th className="p-3">Booking Ref</th>
                      <th className="p-3">Guest Name</th>
                      <th className="p-3">Folio Balance</th>
                      <th className="p-3 rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary?.todaysDepartures.map((b: any) => (
                      <tr key={b._id} className="hover:bg-gray-50/80">
                        <td className="p-3 font-serif font-bold text-gray-900">Room {b.assignedRoom?.roomNumber || "N/A"}</td>
                        <td className="p-3 font-mono text-gray-600">#{b.bookingReference}</td>
                        <td className="p-3 font-medium text-gray-900">{b.guestDetails?.firstName} {b.guestDetails?.lastName}</td>
                        <td className="p-3 font-semibold text-gray-900">₹{b.totalPrice || 0}</td>
                        <td className="p-3 text-right space-x-2">
                          <Link
                            to={`/admin/check-out?bookingId=${b._id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
                          >
                            Process Checkout <LogOut size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: In House */}
        {activeTab === "IN_HOUSE" && (
          <div className="space-y-4">
            {summary?.inHouse.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No in-house guests at this moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                    <tr>
                      <th className="p-3 rounded-l-lg">Room</th>
                      <th className="p-3">Guest Name</th>
                      <th className="p-3">Booking Ref</th>
                      <th className="p-3">Check-Out Date</th>
                      <th className="p-3 rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary?.inHouse.map((b: any) => (
                      <tr key={b._id} className="hover:bg-gray-50/80">
                        <td className="p-3 font-serif font-bold text-gray-900">Room {b.assignedRoom?.roomNumber || "N/A"}</td>
                        <td className="p-3 font-medium text-gray-900">{b.guestDetails?.firstName} {b.guestDetails?.lastName}</td>
                        <td className="p-3 font-mono text-gray-600">#{b.bookingReference}</td>
                        <td className="p-3 text-gray-600">{new Date(b.checkOutDate).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <Link
                            to={`/admin/bookings/${b._id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-300 px-3 py-1 rounded-lg"
                          >
                            View Booking <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Unassigned */}
        {activeTab === "UNASSIGNED" && (
          <div className="space-y-4">
            {summary?.unassignedBookings.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">All confirmed reservations have allocated rooms.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                    <tr>
                      <th className="p-3 rounded-l-lg">Booking Ref</th>
                      <th className="p-3">Guest</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Check-In Date</th>
                      <th className="p-3 rounded-r-lg text-right">Assign Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary?.unassignedBookings.map((b: any) => (
                      <tr key={b._id} className="hover:bg-gray-50/80">
                        <td className="p-3 font-mono font-bold text-gray-900">#{b.bookingReference}</td>
                        <td className="p-3 font-medium text-gray-900">{b.guestDetails?.firstName} {b.guestDetails?.lastName}</td>
                        <td className="p-3 text-gray-600">{b.roomCategory?.name || "Standard"}</td>
                        <td className="p-3 text-gray-600">{new Date(b.checkInDate).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <Link
                            to="/admin/room-rack"
                            className="inline-flex items-center gap-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
                          >
                            Allocate on Room Rack <BedDouble size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Dirty Rooms */}
        {activeTab === "DIRTY" && (
          <div className="space-y-4">
            {summary?.dirtyRooms.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">All rooms are clean and ready for guests.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {summary?.dirtyRooms.map((room: any) => (
                  <div key={room._id} className="p-4 border border-red-200 bg-red-50/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-lg font-bold text-gray-900">Room {room.roomNumber}</span>
                      <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">{room.housekeepingStatus}</span>
                    </div>
                    <p className="text-xs text-gray-500">Floor: {room.floor || "G"}</p>
                    <div className="pt-2">
                      <Link
                        to="/admin/housekeeping"
                        className="w-full text-center block text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 py-1.5 rounded-lg"
                      >
                        Housekeeping Dashboard →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
