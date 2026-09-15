import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogIn, LogOut, Users, BedDouble, AlertCircle, RefreshCw,
  CheckCircle2, Clock, Calendar, ArrowRight, ShieldCheck, FileText, ChevronRight,
  Search, Filter, Plus, X, DollarSign, ArrowLeftRight, UserCheck, CreditCard,
  Sparkles, Eye, AlertTriangle, ChevronDown
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
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [vipOnlyFilter, setVipOnlyFilter] = useState(false);
  const [unpaidOnlyFilter, setUnpaidOnlyFilter] = useState(false);

  // Available Rooms for Assignment/Move
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // Modals state
  const [checkInModal, setCheckInModal] = useState<{ open: boolean; booking: any | null }>({ open: false, booking: null });
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [idType, setIdType] = useState("Passport / Govt ID");
  const [idNumber, setIdNumber] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [checkOutModal, setCheckOutModal] = useState<{ open: boolean; booking: any | null; preview: any | null }>({ open: false, booking: null, preview: null });
  const [paymentMode, setPaymentMode] = useState("CARD");
  
  const [roomMoveModal, setRoomMoveModal] = useState<{ open: boolean; booking: any | null }>({ open: false, booking: null });
  const [moveReason, setMoveReason] = useState("");
  
  const [extendModal, setExtendModal] = useState<{ open: boolean; booking: any | null }>({ open: false, booking: null });
  const [newCheckOutDate, setNewCheckOutDate] = useState("");
  const [extensionConflict, setExtensionConflict] = useState<string | null>(null);
  const [extensionCost, setExtensionCost] = useState<number>(0);

  const [folioDrawer, setFolioDrawer] = useState<{ open: boolean; booking: any | null; folio: any | null }>({ open: false, booking: null, folio: null });
  const [newChargeDesc, setNewChargeDesc] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState("");

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

  const fetchAvailableRooms = async () => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch("/api/room-rack/availability", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        setAvailableRooms(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load available rooms", err);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchAvailableRooms();
  }, []);

  // Handlers for Check-In
  const openCheckIn = (booking: any) => {
    setSelectedRoomId(booking.assignedRoom?._id || booking.assignedRoom || "");
    setIdNumber(booking.guestDetails?.idNumber || "");
    setCheckInModal({ open: true, booking });
  };

  const handleProcessCheckIn = async () => {
    if (!checkInModal.booking) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      
      // If room was selected/changed
      if (selectedRoomId && selectedRoomId !== (checkInModal.booking.assignedRoom?._id || checkInModal.booking.assignedRoom)) {
        await fetch(`/api/room-rack/${selectedRoomId}/assign-booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ bookingId: checkInModal.booking._id }),
        });
      }

      const res = await fetch(`/api/bookings/${checkInModal.booking._id}/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          idType,
          idNumber,
          notes: "In-line Front Desk Check-In",
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({ title: "Check-In Complete", description: `Guest ${checkInModal.booking.guestDetails?.firstName} is now Checked In!` });
        setCheckInModal({ open: false, booking: null });
        fetchSummary();
      } else {
        toast({ title: "Check-In Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handlers for Check-Out
  const openCheckOut = async (booking: any) => {
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/bookings/${booking._id}/checkout-preview`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        setCheckOutModal({ open: true, booking, preview: json.data });
      } else {
        toast({ title: "Failed to generate checkout preview", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessCheckOut = async () => {
    if (!checkOutModal.booking) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/bookings/${checkOutModal.booking._id}/check-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          paymentMode,
          notes: "Front Desk Express Checkout",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Check-Out Complete", description: `Guest ${checkOutModal.booking.guestDetails?.firstName} checked out. Room is now DIRTY for turnover.` });
        setCheckOutModal({ open: false, booking: null, preview: null });
        fetchSummary();
      } else {
        toast({ title: "Check-Out Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handlers for Room Move
  const openRoomMove = (booking: any) => {
    setSelectedRoomId("");
    setMoveReason("");
    setRoomMoveModal({ open: true, booking });
  };

  const handleProcessRoomMove = async () => {
    if (!roomMoveModal.booking || !selectedRoomId) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/room-rack/${selectedRoomId}/assign-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bookingId: roomMoveModal.booking._id,
          reason: moveReason || "Guest Request / Room Upgrade",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Room Move Complete", description: `Reassigned to new room.` });
        setRoomMoveModal({ open: false, booking: null });
        fetchSummary();
      } else {
        toast({ title: "Room Move Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handlers for Stay Extension
  const openExtendStay = (booking: any) => {
    setNewCheckOutDate("");
    setExtensionConflict(null);
    setExtensionCost(0);
    setExtendModal({ open: true, booking });
  };

  const handleCheckExtension = async (dateVal: string) => {
    setNewCheckOutDate(dateVal);
    if (!extendModal.booking || !dateVal) return;
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/bookings/${extendModal.booking._id}/extension-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ newCheckOutDate: dateVal }),
      });
      const json = await res.json();
      if (json.success) {
        setExtensionConflict(null);
        setExtensionCost(json.data?.additionalAmount || 0);
      } else {
        setExtensionConflict(json.message || "Room unavailable for selected dates");
      }
    } catch (err: any) {
      setExtensionConflict(err.message);
    }
  };

  const handleProcessExtend = async () => {
    if (!extendModal.booking || !newCheckOutDate || extensionConflict) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/bookings/${extendModal.booking._id}/extend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ newCheckOutDate }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Stay Extended", description: `Check-out extended to ${new Date(newCheckOutDate).toLocaleDateString()}` });
        setExtendModal({ open: false, booking: null });
        fetchSummary();
      } else {
        toast({ title: "Extension Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handlers for Folio Drawer
  const openFolioDrawer = async (booking: any) => {
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/folios/booking/${booking._id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        setFolioDrawer({ open: true, booking, folio: json.data });
      } else {
        toast({ title: "Failed to load guest folio", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFolioCharge = async () => {
    if (!folioDrawer.folio || !newChargeDesc || !newChargeAmount) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/folios/${folioDrawer.folio._id}/charges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          description: newChargeDesc,
          amount: parseFloat(newChargeAmount),
          type: "ANCILLARY",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Charge Posted", description: `Added ₹${newChargeAmount} to folio.` });
        setNewChargeDesc("");
        setNewChargeAmount("");
        // Reload folio
        openFolioDrawer(folioDrawer.booking);
      } else {
        toast({ title: "Failed to post charge", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  const counts = summary?.counts || { arrivals: 0, departures: 0, inHouse: 0, dirtyRooms: 0, unassignedBookings: 0 };
  const vipsCount = (summary?.inHouse?.filter((b: any) => b.isVipGuest) || []).length +
                    (summary?.todaysArrivals?.filter((b: any) => b.isVipGuest) || []).length;

  // Filter current tab data based on search & filters
  const getTabItems = () => {
    let rawList: any[] = [];
    if (activeTab === "ARRIVALS") rawList = summary?.todaysArrivals || [];
    if (activeTab === "DEPARTURES") rawList = summary?.todaysDepartures || [];
    if (activeTab === "IN_HOUSE") rawList = summary?.inHouse || [];
    if (activeTab === "UNASSIGNED") rawList = summary?.unassignedBookings || [];
    if (activeTab === "DIRTY") rawList = summary?.dirtyRooms || [];

    return rawList.filter((item: any) => {
      // Search text match
      const guestName = `${item.guestDetails?.firstName || ''} ${item.guestDetails?.lastName || ''}`.toLowerCase();
      const ref = (item.bookingReference || '').toLowerCase();
      const phone = (item.guestDetails?.phoneNumber || item.guestDetails?.phone || '').toLowerCase();
      const roomNum = (item.assignedRoom?.roomNumber || item.roomNumber || '').toString().toLowerCase();
      
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || guestName.includes(q) || ref.includes(q) || phone.includes(q) || roomNum.includes(q);

      // VIP filter
      const matchesVip = !vipOnlyFilter || Boolean(item.isVipGuest);

      // Unpaid filter
      const matchesUnpaid = !unpaidOnlyFilter || ((item.totalPrice || 0) - (item.paidAmount || 0) > 0);

      return matchesQuery && matchesVip && matchesUnpaid;
    });
  };

  const filteredItems = getTabItems();

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white p-12 text-center flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-[#c9a227] text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-400 mt-3 font-mono">Connecting to Front Desk Command Center...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Operational Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#121316] p-6 rounded-2xl border border-[#262930] shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
              <LogIn size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                Front Desk Operations Engine
                <span className="text-xs bg-[#c9a227]/20 text-[#e5c76b] px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30">LIVE RUNTIME</span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time check-ins, express check-outs, live room allocation & guest folio manager
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/room-rack"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1d24] text-[#e5c76b] hover:bg-[#262930] rounded-xl transition text-xs font-semibold border border-[#c9a227]/30 shadow-md"
          >
            <BedDouble size={16} /> Interactive Room Rack 2.0
          </Link>
          <button
            onClick={fetchSummary}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a227] text-black hover:bg-[#e5c76b] rounded-xl transition text-xs font-bold shadow-md"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Sync Summary
          </button>
        </div>
      </div>

      {/* Top KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Arrivals Card */}
        <div
          onClick={() => setActiveTab("ARRIVALS")}
          className={`cursor-pointer bg-[#121316] p-4 rounded-xl border transition-all ${
            activeTab === "ARRIVALS"
              ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-950/20"
              : "border-[#262930] hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <LogIn size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">Arrivals</span>
          </div>
          <p className="text-2xl font-serif font-bold text-white">{counts.arrivals}</p>
          <p className="text-[11px] text-gray-400 mt-1">Expected Today</p>
        </div>

        {/* Departures Card */}
        <div
          onClick={() => setActiveTab("DEPARTURES")}
          className={`cursor-pointer bg-[#121316] p-4 rounded-xl border transition-all ${
            activeTab === "DEPARTURES"
              ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-950/20"
              : "border-[#262930] hover:border-blue-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <LogOut size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">Departures</span>
          </div>
          <p className="text-2xl font-serif font-bold text-white">{counts.departures}</p>
          <p className="text-[11px] text-gray-400 mt-1">Checking Out</p>
        </div>

        {/* In House Card */}
        <div
          onClick={() => setActiveTab("IN_HOUSE")}
          className={`cursor-pointer bg-[#121316] p-4 rounded-xl border transition-all ${
            activeTab === "IN_HOUSE"
              ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-950/20"
              : "border-[#262930] hover:border-purple-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <Users size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">In-House</span>
          </div>
          <p className="text-2xl font-serif font-bold text-white">{counts.inHouse}</p>
          <p className="text-[11px] text-gray-400 mt-1">Active Stays</p>
        </div>

        {/* Unassigned Card */}
        <div
          onClick={() => setActiveTab("UNASSIGNED")}
          className={`cursor-pointer bg-[#121316] p-4 rounded-xl border transition-all ${
            activeTab === "UNASSIGNED"
              ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-950/20"
              : "border-[#262930] hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <AlertCircle size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">Unassigned</span>
          </div>
          <p className="text-2xl font-serif font-bold text-white">{counts.unassignedBookings}</p>
          <p className="text-[11px] text-gray-400 mt-1">To Allocate</p>
        </div>

        {/* Dirty Rooms Card */}
        <div
          onClick={() => setActiveTab("DIRTY")}
          className={`cursor-pointer bg-[#121316] p-4 rounded-xl border transition-all ${
            activeTab === "DIRTY"
              ? "border-red-500 bg-red-500/10 shadow-lg shadow-red-950/20"
              : "border-[#262930] hover:border-red-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-red-400 mb-2">
            <BedDouble size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">Dirty Rooms</span>
          </div>
          <p className="text-2xl font-serif font-bold text-white">{counts.dirtyRooms}</p>
          <p className="text-[11px] text-gray-400 mt-1">Pending Cleaning</p>
        </div>

        {/* VIP Guests Card */}
        <div className="bg-[#121316] p-4 rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/5">
          <div className="flex items-center justify-between text-[#c9a227] mb-2">
            <Sparkles size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#c9a227]/20 text-[#e5c76b] px-2 py-0.5 rounded border border-[#c9a227]/30">VIP Guests</span>
          </div>
          <p className="text-2xl font-serif font-bold text-white">{vipsCount}</p>
          <p className="text-[11px] text-gray-400 mt-1">High Priority</p>
        </div>
      </div>

      {/* Live Search & Filter Bar */}
      <div className="bg-[#121316] p-4 rounded-2xl border border-[#262930] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search guest name, booking ref #, phone, room #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white placeholder-gray-500 pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-[#c9a227] transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5 text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setVipOnlyFilter(!vipOnlyFilter)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 ${
              vipOnlyFilter
                ? "bg-[#c9a227] text-black border-[#c9a227]"
                : "bg-[#1a1d24] text-gray-300 border-[#262930] hover:border-[#c9a227]/40"
            }`}
          >
            <Sparkles size={14} /> VIP Only
          </button>
          <button
            onClick={() => setUnpaidOnlyFilter(!unpaidOnlyFilter)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 ${
              unpaidOnlyFilter
                ? "bg-red-500 text-white border-red-500"
                : "bg-[#1a1d24] text-gray-300 border-[#262930] hover:border-red-500/40"
            }`}
          >
            <DollarSign size={14} /> Balance Due
          </button>
          {(searchQuery || vipOnlyFilter || unpaidOnlyFilter) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setVipOnlyFilter(false);
                setUnpaidOnlyFilter(false);
              }}
              className="px-3 py-1.5 text-xs font-mono text-gray-400 hover:text-white underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content Panel */}
      <div className="bg-[#121316] rounded-2xl border border-[#262930] p-6 shadow-xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#262930] gap-4 md:gap-8 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("ARRIVALS")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "ARRIVALS" ? "border-emerald-500 text-emerald-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <LogIn size={15} /> Expected Arrivals ({summary?.todaysArrivals?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("DEPARTURES")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "DEPARTURES" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <LogOut size={15} /> Scheduled Departures ({summary?.todaysDepartures?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("IN_HOUSE")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "IN_HOUSE" ? "border-purple-500 text-purple-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Users size={15} /> In-House Stays ({summary?.inHouse?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("UNASSIGNED")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "UNASSIGNED" ? "border-amber-500 text-amber-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <AlertCircle size={15} /> Unassigned Bookings ({summary?.unassignedBookings?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("DIRTY")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "DIRTY" ? "border-red-500 text-red-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <BedDouble size={15} /> Dirty / Turnover Rooms ({summary?.dirtyRooms?.length || 0})
          </button>
        </div>

        {/* Render Tab Data */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <CheckCircle2 size={36} className="mx-auto text-gray-600 mb-2 opacity-50" />
            <p className="text-sm font-medium">No records found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "DIRTY" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((room: any) => (
                  <div key={room._id} className="p-4 bg-[#1a1d24] border border-red-500/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-lg font-bold text-white">Room {room.roomNumber}</span>
                      <span className="text-[10px] bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded border border-red-500/40">
                        {room.housekeepingStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">Category: {room.roomCategory?.name || "Standard"}</p>
                    <p className="text-xs text-gray-400">Floor: {room.floor || "G"}</p>
                    <div className="pt-2">
                      <Link
                        to="/admin/housekeeping"
                        className="w-full text-center block text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 py-2 rounded-lg border border-red-500/30 transition"
                      >
                        Housekeeping Dispatch Board →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1a1d24] text-gray-400 text-xs uppercase font-mono border-b border-[#262930]">
                  <tr>
                    <th className="p-3.5 rounded-l-xl">Ref & Guest</th>
                    <th className="p-3.5">Category & Room</th>
                    <th className="p-3.5">Stay Dates</th>
                    <th className="p-3.5">Financial Status</th>
                    <th className="p-3.5 text-right rounded-r-xl">Operations / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262930]/60 text-gray-200">
                  {filteredItems.map((b: any) => {
                    const guestName = `${b.guestDetails?.firstName || "Guest"} ${b.guestDetails?.lastName || ""}`;
                    const roomNum = b.assignedRoom?.roomNumber || b.roomNumber;
                    const paid = b.paidAmount || 0;
                    const total = b.totalPrice || 0;
                    const balance = total - paid;

                    return (
                      <tr key={b._id} className="hover:bg-[#1a1d24]/80 transition">
                        {/* Guest & Ref */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#262930] flex items-center justify-center font-bold text-xs text-[#c9a227] border border-[#c9a227]/30">
                              {guestName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                {guestName}
                                {b.isVipGuest && (
                                  <span className="text-[10px] bg-[#c9a227]/20 text-[#e5c76b] px-1.5 py-0.5 rounded font-bold border border-[#c9a227]/40 flex items-center gap-0.5">
                                    <Sparkles size={10} /> VIP
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-mono text-gray-400 flex items-center gap-2">
                                <span>#{b.bookingReference}</span>
                                <span>·</span>
                                <span>{b.guestDetails?.phoneNumber || b.guestDetails?.phone || "No phone"}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Room & Category */}
                        <td className="p-3.5">
                          <div className="text-xs font-medium text-gray-300">{b.roomCategory?.name || "Standard Luxury Suite"}</div>
                          <div className="mt-1">
                            {roomNum ? (
                              <span className="font-serif font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 text-xs">
                                Room {roomNum}
                              </span>
                            ) : (
                              <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-500/30">
                                Unassigned
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Stay Dates */}
                        <td className="p-3.5 text-xs text-gray-300">
                          <div className="flex items-center gap-1 text-gray-400 font-mono">
                            <Calendar size={13} className="text-[#c9a227]" />
                            {new Date(b.checkInDate).toLocaleDateString()} → {new Date(b.checkOutDate).toLocaleDateString()}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{b.numberOfNights || 1} Night(s)</div>
                        </td>

                        {/* Financial Status */}
                        <td className="p-3.5 text-xs">
                          <div className="font-mono text-white">Total: ₹{total.toLocaleString()}</div>
                          <div className="mt-0.5">
                            {balance <= 0 ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">
                                PAID IN FULL
                              </span>
                            ) : (
                              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold border border-red-500/30">
                                BAL DUE: ₹{balance.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right space-x-1.5">
                          {/* Folio Drawer Button */}
                          <button
                            onClick={() => openFolioDrawer(b)}
                            className="inline-flex items-center gap-1 text-xs font-semibold bg-[#1a1d24] text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-[#262930] hover:border-[#c9a227]/40 transition"
                            title="Inspect Guest Folio"
                          >
                            <FileText size={13} className="text-[#c9a227]" /> Folio
                          </button>

                          {/* Specific Actions based on Tab */}
                          {activeTab === "ARRIVALS" && (
                            <button
                              onClick={() => openCheckIn(b)}
                              className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-md transition"
                            >
                              <LogIn size={13} /> Check In
                            </button>
                          )}

                          {activeTab === "DEPARTURES" && (
                            <button
                              onClick={() => openCheckOut(b)}
                              className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-md transition"
                            >
                              <LogOut size={13} /> Check Out
                            </button>
                          )}

                          {activeTab === "IN_HOUSE" && (
                            <>
                              <button
                                onClick={() => openRoomMove(b)}
                                className="inline-flex items-center gap-1 text-xs font-semibold bg-[#1a1d24] text-amber-300 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/30 transition"
                              >
                                <ArrowLeftRight size={13} /> Move
                              </button>
                              <button
                                onClick={() => openExtendStay(b)}
                                className="inline-flex items-center gap-1 text-xs font-semibold bg-[#1a1d24] text-purple-300 hover:bg-purple-500/20 px-2.5 py-1.5 rounded-lg border border-purple-500/30 transition"
                              >
                                <Clock size={13} /> Extend
                              </button>
                              <button
                                onClick={() => openCheckOut(b)}
                                className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-md transition"
                              >
                                Express Checkout
                              </button>
                            </>
                          )}

                          {activeTab === "UNASSIGNED" && (
                            <button
                              onClick={() => openCheckIn(b)}
                              className="inline-flex items-center gap-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg shadow-md transition"
                            >
                              <BedDouble size={13} /> Allocate & Check In
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: CHECK-IN */}
      {checkInModal.open && checkInModal.booking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-[#262930] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#262930] pb-4">
              <div className="flex items-center gap-2">
                <LogIn className="text-emerald-400" size={20} />
                <h3 className="font-serif text-lg font-bold">Process Guest Check-In</h3>
              </div>
              <button onClick={() => setCheckInModal({ open: false, booking: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="bg-[#1a1d24] p-4 rounded-xl border border-[#262930] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Guest Name:</span>
                <span className="font-bold text-white">{checkInModal.booking.guestDetails?.firstName} {checkInModal.booking.guestDetails?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Booking Ref:</span>
                <span className="font-mono text-[#c9a227]">#{checkInModal.booking.bookingReference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Category Reserved:</span>
                <span className="text-white">{checkInModal.booking.roomCategory?.name || "Standard Suite"}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Assign Clean Room</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                >
                  <option value="">-- Select Available Room --</option>
                  {availableRooms.map((rm) => (
                    <option key={rm._id} value={rm._id}>
                      Room {rm.roomNumber} ({rm.roomCategory?.name || "Suite"}) — {rm.housekeepingStatus}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">ID Type / Document</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                  >
                    <option>Passport / Govt ID</option>
                    <option>Aadhaar Card</option>
                    <option>Driver's License</option>
                    <option>Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">ID Number / Reg Ref</label>
                  <input
                    type="text"
                    placeholder="Enter ID number"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#262930] pt-4">
              <button
                onClick={() => setCheckInModal({ open: false, booking: null })}
                className="px-4 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold hover:bg-[#262930]"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction || !selectedRoomId}
                onClick={handleProcessCheckIn}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingAction ? "Processing..." : "Confirm Check-In"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHECK-OUT PREVIEW & SETTLE */}
      {checkOutModal.open && checkOutModal.booking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-[#262930] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#262930] pb-4">
              <div className="flex items-center gap-2">
                <LogOut className="text-blue-400" size={20} />
                <h3 className="font-serif text-lg font-bold">Express Guest Checkout & Folio Settlement</h3>
              </div>
              <button onClick={() => setCheckOutModal({ open: false, booking: null, preview: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="bg-[#1a1d24] p-4 rounded-xl border border-[#262930] space-y-3 font-mono text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Room Charges:</span>
                <span>₹{(checkOutModal.preview?.roomCharges || checkOutModal.booking.totalPrice || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Restaurant & Ancillary POS:</span>
                <span>₹{(checkOutModal.preview?.ancillaryCharges || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Taxes & GST:</span>
                <span>₹{(checkOutModal.preview?.taxAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Advance Paid:</span>
                <span>- ₹{(checkOutModal.preview?.paidAmount || checkOutModal.booking.paidAmount || 0).toLocaleString()}</span>
              </div>
              <div className="border-t border-[#262930] pt-2 flex justify-between font-bold text-sm text-white">
                <span>Balance Due at Checkout:</span>
                <span className="text-amber-400">₹{(checkOutModal.preview?.balanceDue || 0).toLocaleString()}</span>
              </div>
            </div>

            {(checkOutModal.preview?.balanceDue || 0) > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Select Payment Mode to Settle</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
                >
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="UPI">UPI / GPay / QR Scan</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="CITY_LEDGER">Direct Bill / Corporate City Ledger</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-[#262930] pt-4">
              <button
                onClick={() => setCheckOutModal({ open: false, booking: null, preview: null })}
                className="px-4 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold hover:bg-[#262930]"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction}
                onClick={handleProcessCheckOut}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingAction ? "Processing..." : "Settle Folio & Complete Checkout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ROOM MOVE */}
      {roomMoveModal.open && roomMoveModal.booking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-[#262930] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#262930] pb-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="text-amber-400" size={20} />
                <h3 className="font-serif text-lg font-bold">Quick In-House Room Move</h3>
              </div>
              <button onClick={() => setRoomMoveModal({ open: false, booking: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Select New Clean Room</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              >
                <option value="">-- Select Destination Room --</option>
                {availableRooms.map((rm) => (
                  <option key={rm._id} value={rm._id}>
                    Room {rm.roomNumber} ({rm.roomCategory?.name || "Suite"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Reason for Move</label>
              <input
                type="text"
                placeholder="e.g. AC issue, Guest requested high floor"
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-[#262930] pt-4">
              <button onClick={() => setRoomMoveModal({ open: false, booking: null })} className="px-4 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold">
                Cancel
              </button>
              <button
                disabled={submittingAction || !selectedRoomId}
                onClick={handleProcessRoomMove}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingAction ? "Moving..." : "Confirm Room Move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: STAY EXTENSION */}
      {extendModal.open && extendModal.booking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-[#262930] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#262930] pb-4">
              <div className="flex items-center gap-2">
                <Clock className="text-purple-400" size={20} />
                <h3 className="font-serif text-lg font-bold">Extend Guest Stay</h3>
              </div>
              <button onClick={() => setExtendModal({ open: false, booking: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">New Check-Out Date</label>
              <input
                type="date"
                value={newCheckOutDate}
                onChange={(e) => handleCheckExtension(e.target.value)}
                className="w-full bg-[#1a1d24] border border-[#262930] text-sm text-white rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            {extensionConflict && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-xs text-red-300">
                {extensionConflict}
              </div>
            )}

            {newCheckOutDate && !extensionConflict && (
              <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-xl text-xs text-purple-200">
                Additional Room Tariff: <span className="font-mono font-bold text-white">₹{extensionCost.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-[#262930] pt-4">
              <button onClick={() => setExtendModal({ open: false, booking: null })} className="px-4 py-2 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold">
                Cancel
              </button>
              <button
                disabled={submittingAction || !newCheckOutDate || Boolean(extensionConflict)}
                onClick={handleProcessExtend}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingAction ? "Extending..." : "Confirm Extension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: FOLIO DETAILS */}
      {folioDrawer.open && folioDrawer.booking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#121316] border-l border-[#262930] w-full max-w-xl h-full p-6 shadow-2xl overflow-y-auto space-y-6 text-white flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#262930] pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="text-[#c9a227]" size={22} />
                  <div>
                    <h3 className="font-serif text-lg font-bold">Guest Folio Inspection</h3>
                    <p className="text-xs text-gray-400 font-mono">Folio #{folioDrawer.folio?._id || "N/A"}</p>
                  </div>
                </div>
                <button onClick={() => setFolioDrawer({ open: false, booking: null, folio: null })} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Guest Card */}
              <div className="bg-[#1a1d24] p-4 rounded-xl border border-[#262930] space-y-2 text-xs">
                <div className="flex justify-between font-bold text-white text-sm">
                  <span>{folioDrawer.booking.guestDetails?.firstName} {folioDrawer.booking.guestDetails?.lastName}</span>
                  <span className="text-[#c9a227]">Room {folioDrawer.booking.assignedRoom?.roomNumber || "N/A"}</span>
                </div>
                <div className="flex justify-between text-gray-400 font-mono">
                  <span>Booking Ref: #{folioDrawer.booking.bookingReference}</span>
                  <span>{new Date(folioDrawer.booking.checkInDate).toLocaleDateString()} - {new Date(folioDrawer.booking.checkOutDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Post Charge Form */}
              <div className="bg-[#1a1d24] p-4 rounded-xl border border-[#262930] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">Post Room / Ancillary Charge</h4>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Item description (e.g. Minibar, Laundry)"
                    value={newChargeDesc}
                    onChange={(e) => setNewChargeDesc(e.target.value)}
                    className="col-span-2 bg-[#121316] border border-[#262930] text-xs text-white rounded-lg p-2 focus:border-[#c9a227]"
                  />
                  <input
                    type="number"
                    placeholder="Amount (₹)"
                    value={newChargeAmount}
                    onChange={(e) => setNewChargeAmount(e.target.value)}
                    className="bg-[#121316] border border-[#262930] text-xs text-white rounded-lg p-2 focus:border-[#c9a227]"
                  />
                </div>
                <button
                  disabled={submittingAction || !newChargeDesc || !newChargeAmount}
                  onClick={handleAddFolioCharge}
                  className="w-full py-2 bg-[#c9a227] text-black text-xs font-bold rounded-lg hover:bg-[#e5c76b] transition disabled:opacity-50"
                >
                  Post Charge to Folio
                </button>
              </div>

              {/* Folio Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Itemized Charges & Credits</h4>
                <div className="overflow-x-auto border border-[#262930] rounded-xl bg-[#1a1d24]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#121316] text-gray-400 border-b border-[#262930]">
                      <tr>
                        <th className="p-2.5">Date & Item</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262930]">
                      {(folioDrawer.folio?.charges || []).map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2.5">
                            <div className="text-white font-sans">{item.description}</div>
                            <div className="text-[10px] text-gray-500">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</div>
                          </td>
                          <td className="p-2.5 text-gray-400">{item.type || "CHARGE"}</td>
                          <td className="p-2.5 text-right text-white">₹{(item.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Summary & Close */}
            <div className="border-t border-[#262930] pt-4 space-y-3 bg-[#121316]">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-300">Total Net Balance:</span>
                <span className="text-[#c9a227] font-mono">₹{(folioDrawer.folio?.balance || 0).toLocaleString()}</span>
              </div>
              <button
                onClick={() => setFolioDrawer({ open: false, booking: null, folio: null })}
                className="w-full py-2.5 bg-[#262930] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition"
              >
                Close Folio Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
