import React, { useState, useEffect } from "react";
import { useHotelSettings } from "@/hooks/usePublicData";
import { Link, useNavigate } from "react-router-dom";
import {
  LogIn, LogOut, Users, BedDouble, AlertCircle, RefreshCw,
  CheckCircle2, Clock, Calendar, ArrowRight, ShieldCheck, FileText, ChevronRight,
  Search, Filter, Plus, X, DollarSign, ArrowLeftRight, UserCheck, CreditCard,
  Sparkles, Eye, AlertTriangle, ChevronDown, Printer, Edit2, Trash2, Save, PlusCircle, Receipt
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { nights as countNights, addDays, toBusinessDate } from "@shared/dates";

interface FrontDeskSummary {
  todaysArrivals: any[];
  todaysDepartures: any[];
  inHouse: any[];
  dirtyRooms: any[];
  availableRooms?: any[];
  occupiedRooms?: any[];
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
  const queryClient = useQueryClient();
  const { data: hotelSettings } = useHotelSettings();
  const [activeTab, setActiveTab] = useState<"ARRIVALS" | "DEPARTURES" | "IN_HOUSE" | "UNASSIGNED" | "DIRTY" | "AVAILABLE" | "OCCUPIED">("IN_HOUSE");
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [vipOnlyFilter, setVipOnlyFilter] = useState(false);
  const [unpaidOnlyFilter, setUnpaidOnlyFilter] = useState(false);

  // Expanded multi-room groups state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroupExpand = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };


  // Modals state
  const [checkInModal, setCheckInModal] = useState<{ open: boolean; booking: any | null }>({ open: false, booking: null });
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [idType, setIdType] = useState("Passport / Govt ID");
  const [idNumber, setIdNumber] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [checkOutModal, setCheckOutModal] = useState<{ open: boolean; booking: any | null; preview: any | null }>({ open: false, booking: null, preview: null });
  const [paymentMode, setPaymentMode] = useState("CARD");
  const [settlementAmount, setSettlementAmount] = useState<number | string>("");
  // Tariff typed at checkout (express / early check-out), for the nights actually stayed.
  const [checkoutRate, setCheckoutRate] = useState("");
  const [applyingRate, setApplyingRate] = useState(false);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  
  const [roomMoveModal, setRoomMoveModal] = useState<{ open: boolean; booking: any | null }>({ open: false, booking: null });
  const [moveReason, setMoveReason] = useState("");
  // Room move: keep the agreed rate, or switch to the new room's rate (bill adjusted for nights already charged)
  const [moveRateMode, setMoveRateMode] = useState<"KEEP" | "NEW">("KEEP");
  const [moveNewRate, setMoveNewRate] = useState("");
  
  const [extendModal, setExtendModal] = useState<{ open: boolean; booking: any | null }>({ open: false, booking: null });
  const [newCheckOutDate, setNewCheckOutDate] = useState("");
  const [extensionConflict, setExtensionConflict] = useState<string | null>(null);
  const [extensionCost, setExtensionCost] = useState<number>(0);
  // Group stays: extend every room together (default) or only the chosen room. Per-room quote from the server.
  // Rooms (booking ids) of the stay chosen for extension — any subset of a group booking.
  const [extendSelected, setExtendSelected] = useState<string[]>([]);
  const [extensionQuotes, setExtensionQuotes] = useState<Array<{ booking: any; room: string; cost: number; error?: string; skip?: boolean }>>([]);

  const [folioDrawer, setFolioDrawer] = useState<{ 
    open: boolean; 
    booking: any | null; 
    folio: any | null;
    isGroupFolio?: boolean;
    allGroupBookings?: any[];
  }>({ open: false, booking: null, folio: null, isGroupFolio: false, allGroupBookings: [] });
  const [newChargeDesc, setNewChargeDesc] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState("");
  const [newChargeType, setNewChargeType] = useState("ADDON");
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [isEditingBill, setIsEditingBill] = useState(false);
  const [editBillForm, setEditBillForm] = useState({
    ratePerNight: 0,
    extraBedAmount: 0,
    otherCharges: 0,
    otherChargesDesc: "",
    discountAmount: 0,
    paidAmount: 0,
    applyTax: true,
    pricesIncludeTax: false,
  });

  const { data: summary, isLoading: loading } = useQuery({
    queryKey: ["front-desk-summary"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/front-desk/summary", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data as FrontDeskSummary;
    }
  });

  // Rooms free for the stay being checked in / moved (Reception's own registration endpoint —
  // /api/rooms is not readable by Reception). Clean and sellable rooms only.
  const roomPickBooking = (checkInModal.open && checkInModal.booking) || (roomMoveModal.open && roomMoveModal.booking) || null;
  const { data: availableRooms = [] } = useQuery({
    queryKey: ["available-rooms", roomPickBooking?._id],
    enabled: Boolean(roomPickBooking?.checkInDate && roomPickBooking?.checkOutDate),
    queryFn: async () => {
      const token = getStoredAuthToken();
      const today = toBusinessDate(new Date());
      const from = toBusinessDate(roomPickBooking.checkInDate) < today ? today : toBusinessDate(roomPickBooking.checkInDate);
      const to = toBusinessDate(roomPickBooking.checkOutDate) > from ? toBusinessDate(roomPickBooking.checkOutDate) : addDays(from, 1);
      const res = await fetch(`/api/front-desk/registration/available-rooms?checkIn=${from}&checkOut=${to}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return (json.data || []).filter((r: any) => r.housekeepingStatus === "CLEAN" && r.sellStatus !== "OUT_OF_ORDER");
    }
  });
  // Removed fetchSummary, fetchAvailableRooms, and useEffect

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
      
      const res = await fetch(`/api/bookings/${checkInModal.booking._id}/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          roomId: selectedRoomId || checkInModal.booking.assignedRoom?._id || checkInModal.booking.assignedRoom,
          idType,
          idNumber,
          notes: "In-line Front Desk Check-In",
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({ title: "Check-In Complete", description: `Guest ${checkInModal.booking.guestDetails?.firstName} is now Checked In!` });
        setCheckInModal({ open: false, booking: null });
        
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
    
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/bookings/${booking._id}/checkout-preview`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        const bal = json.data?.summary?.balanceDue ?? 0;
        setSettlementAmount(bal);
        setIsManualOverride(false);
        setCheckoutNotes("Front Desk Express Checkout");
        setCheckoutRate(String(json.data?.booking?.ratePerNight ?? booking.ratePerNight ?? ""));
        setCheckOutModal({ open: true, booking, preview: json.data });
      } else {
        toast({ title: "Failed to generate checkout preview", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      
    }
  };

  // Checkout handoff: the Front Desk reviews the charges and sends the stay to Cashier & Billing,
  // which takes the payment, applies advances and completes the checkout at a ₹0 balance.
  const handleProcessCheckOut = async () => {
    if (!checkOutModal.booking) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/reception/bookings/${checkOutModal.booking._id}/checkout/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ note: checkoutNotes || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Sent to Cashier & Billing", description: json.message });
        setCheckOutModal({ open: false, booking: null, preview: null });
        queryClient.invalidateQueries();
        navigate("/admin/billing");
      } else {
        toast({ title: "Could not send to billing", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };


  // Cancel a stay after check-in: the bill is reversed, the room goes to housekeeping.
  const [cancelStay, setCancelStay] = useState<{ booking: any; reason: string; charge: string } | null>(null);
  const handleCancelStay = async () => {
    if (!cancelStay || cancelStay.reason.trim().length < 3) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/bookings/${cancelStay.booking._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reason: cancelStay.reason.trim(), cancellationCharge: Number(cancelStay.charge) || 0 }),
      });
      const json = await res.json().catch(() => ({ success: false, message: `Server error (${res.status})` }));
      if (json.success) {
        toast({ title: "Stay Cancelled", description: json.message });
        setCancelStay(null);
        queryClient.invalidateQueries();
      } else {
        toast({ title: "Could not cancel the stay", description: json.message, variant: "destructive" });
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
      const res = await fetch(`/api/front-desk/bookings/${roomMoveModal.booking._id}/move-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          roomId: selectedRoomId,
          rateMode: moveRateMode,
          newRatePerNight: moveRateMode === "NEW" && moveNewRate ? Number(moveNewRate) : undefined,
          reason: moveReason || "Guest Request / Room Upgrade",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Room Move Complete", description: json.message });
        setMoveRateMode("KEEP");
        setMoveNewRate("");
        setRoomMoveModal({ open: false, booking: null });
        queryClient.invalidateQueries();
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
  /** In-house rooms of the same stay (group registration), or just this booking. */
  const extensionGroupOf = (booking: any, groupList?: any[]) => {
    const list = (groupList && groupList.length ? groupList : booking?.groupBookings) || [];
    const live = list.filter((g: any) => g && !["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(g.status));
    return live.length > 1 ? live : [booking];
  };
  const roomOf = (b: any) => b?.assignedRoom?.roomNumber || b?.roomNumber || b?.bookingReference || "Room";

  // Extend by hours: late check-out, or early check-in (charged per hour, with GST).
  type TimeMode = "NIGHTS" | "LATE_CHECK_OUT" | "EARLY_CHECK_IN";
  const [extendMode, setExtendMode] = useState<TimeMode>("NIGHTS");
  const [extendHours, setExtendHours] = useState("2");
  const [hourQuotes, setHourQuotes] = useState<Record<string, { quote?: any; error?: string; amount: string }>>({});
  const [hourForce, setHourForce] = useState(false);

  const loadHourQuotes = async (kind: TimeMode, hoursStr: string, group: any[]) => {
    if (kind === "NIGHTS") return;
    const hours = Number(hoursStr);
    const token = getStoredAuthToken();
    const next: Record<string, { quote?: any; error?: string; amount: string }> = {};
    for (const g of group) {
      const id = String(g._id);
      if (!(hours >= 1)) { next[id] = { error: "Enter the hours", amount: "" }; continue; }
      try {
        const res = await fetch(`/api/front-desk/bookings/${id}/time-charge?kind=${kind}&hours=${hours}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        const json = await res.json().catch(() => ({ success: false, message: `Server error (${res.status})` }));
        next[id] = json.success ? { quote: json.data, amount: String(json.data.amount) } : { error: json.message, amount: "" };
      } catch (err: any) {
        next[id] = { error: err.message, amount: "" };
      }
    }
    setHourQuotes(next);
  };

  const switchExtendMode = (mode: TimeMode) => {
    setExtendMode(mode);
    setHourForce(false);
    if (mode !== "NIGHTS" && extendModal.booking) loadHourQuotes(mode, extendHours, extendModal.booking.groupBookings || [extendModal.booking]);
  };

  /** What a room's hours cost with GST, from the amount typed (GST inside or on top, as the hotel prices). */
  const hourTotal = (q: any, amountStr: string) => {
    const amount = Number(amountStr) || 0;
    if (!q) return 0;
    return q.pricesIncludeTax ? amount : Math.round(amount * (1 + (q.gstRate || 0) / 100) * 100) / 100;
  };

  const handleProcessHours = async () => {
    if (!extendModal.booking || extendMode === "NIGHTS") return;
    setSubmittingAction(true);
    const token = getStoredAuthToken();
    const done: string[] = [];
    const failed: string[] = [];
    try {
      const group = extendModal.booking.groupBookings || [extendModal.booking];
      for (const g of group.filter((x: any) => extendSelected.includes(String(x._id)))) {
        const hq = hourQuotes[String(g._id)];
        if (!hq?.quote) { failed.push(`Room ${roomOf(g)}: ${hq?.error || "no price"}`); continue; }
        const res = await fetch(`/api/front-desk/bookings/${g._id}/time-charge`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ kind: extendMode, hours: Number(extendHours), amount: Number(hq.amount) || 0, force: hourForce }),
        });
        const json = await res.json().catch(() => ({ success: false, message: `Server error (${res.status})` }));
        if (json.success) done.push(`Room ${roomOf(g)}: ${json.message}`);
        else failed.push(`Room ${roomOf(g)}: ${json.message}`);
      }
      if (done.length) toast({ title: extendMode === "LATE_CHECK_OUT" ? "Late Check-out Added" : "Early Check-in Added", description: done.join(" · ") });
      if (failed.length) toast({ title: "Not added for some rooms", description: failed.join(" · "), variant: "destructive" });
      if (!failed.length) setExtendModal({ open: false, booking: null });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  const openExtendStay = (booking: any, groupList?: any[], mode: TimeMode = "NIGHTS") => {
    const group = extensionGroupOf(booking, groupList);
    setExtendMode(mode);
    setHourForce(false);
    setHourQuotes({});
    if (mode !== "NIGHTS") loadHourQuotes(mode, extendHours, group);
    const selected = group.map((g: any) => String(g._id));
    // Default new date: one night after the latest check-out in the stay.
    const latest = group.map((g: any) => (g.checkOutDate ? toBusinessDate(g.checkOutDate) : "")).sort().pop() || "";
    const nextDateStr = latest ? addDays(latest, 1) : "";
    setExtendSelected(selected);
    setNewCheckOutDate(nextDateStr);
    setExtensionConflict(null);
    setExtensionCost(0);
    setExtensionQuotes([]);
    setExtendModal({ open: true, booking: { ...booking, groupBookings: group } });
    if (nextDateStr) handleCheckExtension(nextDateStr, { ...booking, groupBookings: group }, selected);
  };

  /** Total and conflicts for the ticked rooms only. */
  const applyExtensionSelection = (quotes: any[], selected: string[]) => {
    const chosen = quotes.filter((q) => selected.includes(String(q.booking._id)));
    setExtensionCost(chosen.reduce((t, q) => t + (q.error || q.skip ? 0 : q.cost), 0));
    const errs = chosen.filter((q) => q.error);
    const todo = chosen.filter((q) => !q.skip && !q.error);
    setExtensionConflict(
      chosen.length === 0 ? "Tick at least one room to extend"
        : errs.length ? errs.map((q) => `Room ${q.room}: ${q.error}`).join(" · ")
        : todo.length === 0 ? "Already staying until this date — pick a later check-out" : null,
    );
  };

  const toggleExtendRoom = (id: string) => {
    const next = extendSelected.includes(id) ? extendSelected.filter((x) => x !== id) : [...extendSelected, id];
    setExtendSelected(next);
    applyExtensionSelection(extensionQuotes, next);
  };

  const handleCheckExtension = async (dateVal: string, targetBooking?: any, selectedArg?: string[]) => {
    setNewCheckOutDate(dateVal);
    const b = targetBooking || extendModal.booking;
    const selected = selectedArg || extendSelected;
    if (!b || !dateVal) return;
    const token = getStoredAuthToken();
    // Price every room of the stay so the list shows them all; only ticked rooms are extended.
    const quotes = await Promise.all(
      (b?.groupBookings || [b]).map(async (t: any) => {
        const room = roomOf(t);
        // A room already staying until (or past) the new date needs no extension.
        if (t.checkOutDate && toBusinessDate(t.checkOutDate) >= dateVal) return { booking: t, room, cost: 0, skip: true };
        try {
          const res = await fetch(`/api/bookings/${t._id}/extension-check`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ newCheckOutDate: dateVal }),
          });
          const json = await res.json();
          if (json.success && json.data) return { booking: t, room, cost: Number(json.data.additionalTotal || json.data.additionalAmount || json.data.additionalTariff || 0) };
          return { booking: t, room, cost: 0, error: json.message || "Room unavailable for the selected dates" };
        } catch (err: any) {
          return { booking: t, room, cost: 0, error: err.message };
        }
      }),
    );
    setExtensionQuotes(quotes);
    applyExtensionSelection(quotes, selected);
  };

  const handleProcessExtend = async () => {
    if (!extendModal.booking || !newCheckOutDate || extensionConflict) return;
    setSubmittingAction(true);
    const token = getStoredAuthToken();
    const done: string[] = [];
    const failed: string[] = [];
    try {
      for (const q of extensionQuotes.filter((x) => extendSelected.includes(String(x.booking._id)) && !x.skip && !x.error)) {
        const res = await fetch(`/api/bookings/${q.booking._id}/extend`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ newCheckOutDate }),
        });
        const json = await res.json().catch(() => ({ success: false, message: `Server error (${res.status})` }));
        if (json.success) done.push(q.room);
        else failed.push(`Room ${q.room}: ${json.message}`);
      }
      if (done.length) toast({ title: "Stay Extended", description: `Room ${done.join(", ")} extended to ${new Date(newCheckOutDate).toLocaleDateString("en-IN")}. Bills updated.` });
      if (failed.length) toast({ title: "Some rooms were not extended", description: failed.join(" · "), variant: "destructive" });
      if (!failed.length) setExtendModal({ open: false, booking: null });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handlers for Folio Drawer & Bill Command Center
  const openFolioDrawer = async (booking: any, isGroup: boolean = false, allBookings?: any[]) => {
    try {
      const token = getStoredAuthToken();
      const url = `/api/folios/booking/${booking._id}${isGroup ? "?group=true" : ""}`;
      const res = await fetch(url, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        const fetchedFolio = json.data.folio;
        const fetchedLines = json.data.lines || [];
        const groupList = allBookings || booking.groupBookings || (booking.groupId ? [booking] : []);

        setFolioDrawer({ 
          open: true, 
          booking, 
          folio: { ...fetchedFolio, charges: fetchedLines },
          isGroupFolio: isGroup,
          allGroupBookings: groupList
        });

        // Initialize edit bill form with current particulars
        const nights = Math.max(1, countNights(new Date(booking.checkInDate), new Date(booking.checkOutDate)));
        // The booking's own rate; no invented default — staff enter it if the booking has none.
        const currentRate = booking.ratePerNight || Math.round((booking.totalAmount - (booking.taxAmount || 0)) / nights) || 0;
        setEditBillForm({
          ratePerNight: currentRate,
          extraBedAmount: (booking.extraPersonsWithBed || 0) * (Number(hotelSettings?.extraBedRate) || 0),
          otherCharges: 0,
          otherChargesDesc: "",
          discountAmount: booking.discountAmount || 0,
          paidAmount: booking.paidAmount || 0,
          applyTax: Boolean(booking.taxAmount && booking.taxAmount > 0) || true,
          pricesIncludeTax: booking.pricesIncludeTax === true,
        });
        setIsEditingBill(false);
        setShowAddCharge(false);
      } else {
        toast({ title: "Failed to load guest folio", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveBillEdit = async () => {
    if (!folioDrawer.booking) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/folios/booking/${folioDrawer.booking._id}/bill-edit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(editBillForm),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Bill Updated & Recalculated", description: "Rates, GST breakdown and balance updated successfully." });
        setIsEditingBill(false);
        await openFolioDrawer(json.data.booking, folioDrawer.isGroupFolio, folioDrawer.allGroupBookings);
        queryClient.invalidateQueries({ queryKey: ["front-desk-summary"] });
      } else {
        toast({ title: "Failed to update bill", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!folioDrawer.folio) return;
    const reason = window.prompt("Reason for voiding this line (a reversal entry will be posted):")?.trim();
    if (!reason || reason.length < 3) return;
    setSubmittingAction(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/folios/${folioDrawer.folio._id}/lines/${lineId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Line Voided", description: "A reversal entry was posted and the balance recalculated." });
        await openFolioDrawer(folioDrawer.booking, folioDrawer.isGroupFolio, folioDrawer.allGroupBookings);
        queryClient.invalidateQueries({ queryKey: ["front-desk-summary"] });
      } else {
        toast({ title: "Failed to delete line", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
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
          lineType: newChargeType || "ADDON",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Charge Posted", description: `Added ₹${newChargeAmount} to folio.` });
        setNewChargeDesc("");
        setNewChargeAmount("");
        setShowAddCharge(false);
        await openFolioDrawer(folioDrawer.booking, folioDrawer.isGroupFolio, folioDrawer.allGroupBookings);
        queryClient.invalidateQueries({ queryKey: ["front-desk-summary"] });
      } else {
        toast({ title: "Failed to post charge", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Helper to group bookings by groupId or shared guest identity & stay dates
  const groupBookingsList = (rawList: any[]) => {
    if (!rawList || !Array.isArray(rawList)) return [];

    const groupMap = new Map<string, any[]>();
    for (const b of rawList) {
      if (!b) continue;
      let groupKey: string;
      const phone = (b.guestDetails?.phone || b.guestDetails?.phoneNumber || "").trim();
      const cin = b.checkInDate ? toBusinessDate(b.checkInDate) : "";
      const cout = b.checkOutDate ? toBusinessDate(b.checkOutDate) : "";
      const gId = b.groupId ? String(b.groupId) : "";

      if (gId) {
        groupKey = `grp_${gId}`;
      } else if (phone && cin) {
        groupKey = `guest_${phone}_${cin}_${cout}`;
      } else {
        groupKey = `b_${b._id}`;
      }

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(b);
    }

    const consolidated: any[] = [];
    groupMap.forEach((bookings, groupKey) => {
      const primary = bookings[0];
      const combinedTotal = bookings.reduce(
        (sum, item) => sum + (item.totalAmount || item.totalPrice || 0),
        0
      );
      const combinedPaid = bookings.reduce(
        (sum, item) => sum + (item.paidAmount || 0),
        0
      );
      const combinedBalance = combinedTotal - combinedPaid;

      consolidated.push({
        ...primary,
        _groupKey: groupKey,
        isGroup: bookings.length > 1,
        roomCount: bookings.length,
        groupBookings: bookings,
        totalPriceCombined: combinedTotal,
        paidAmountCombined: combinedPaid,
        balanceCombined: combinedBalance,
      });
    });
    return consolidated;
  };

  const arrivalsGrouped = groupBookingsList(summary?.todaysArrivals || []);
  const departuresGrouped = groupBookingsList(summary?.todaysDepartures || []);
  const inHouseGrouped = groupBookingsList(summary?.inHouse || []);
  const unassignedGrouped = groupBookingsList(summary?.unassignedBookings || []);

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
    if (activeTab === "AVAILABLE") rawList = summary?.availableRooms || [];
    if (activeTab === "OCCUPIED") rawList = summary?.occupiedRooms || [];

    if (activeTab === "DIRTY" || activeTab === "AVAILABLE" || activeTab === "OCCUPIED") {
      return rawList.filter((item: any) => {
        const q = searchQuery.toLowerCase().trim();
        const hay = `${item.roomNumber || ""} ${item.categoryName || ""} ${item.guestName || ""} ${item.bookingReference || ""}`.toLowerCase();
        return !q || hay.includes(q);
      });
    }

    // Group multi-room bookings together
    const grouped = groupBookingsList(rawList);

    return grouped.filter((item: any) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.groupBookings.some((b: any) => {
          const guestName = `${b.guestDetails?.firstName || ''} ${b.guestDetails?.lastName || ''}`.toLowerCase();
          const ref = (b.bookingReference || '').toLowerCase();
          const phone = (b.guestDetails?.phoneNumber || b.guestDetails?.phone || '').toLowerCase();
          const roomNum = (b.assignedRoom?.roomNumber || b.roomNumber || '').toString().toLowerCase();
          return guestName.includes(q) || ref.includes(q) || phone.includes(q) || roomNum.includes(q);
        });

      // VIP filter matches if any booking in group is VIP
      const matchesVip = !vipOnlyFilter || item.groupBookings.some((b: any) => Boolean(b.isVipGuest));

      // Unpaid filter matches on combined group balance
      const matchesUnpaid = !unpaidOnlyFilter || item.balanceCombined > 0;

      return matchesQuery && matchesVip && matchesUnpaid;
    });
  };

  const filteredItems = getTabItems();

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-800 p-12 text-center flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-[#c9a227] text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-500 mt-3 font-mono">Connecting to Front Desk Command Center...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Operational Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
              <LogIn size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-gray-800 flex items-center gap-2">
                Front Desk Operations Engine
                <span className="text-xs bg-[#c9a227]/20 text-[#e5c76b] px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30">LIVE RUNTIME</span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time check-ins, express check-outs, live room allocation & guest folio manager
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/guest-registration"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a227] text-white hover:bg-black rounded-xl transition text-xs font-bold shadow-md animate-pulse border border-[#c9a227]/50"
          >
            <UserCheck size={16} /> NEW GUEST ARRIVAL
          </Link>
          <Link
            to="/admin/room-rack"
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-[#e5c76b] hover:bg-[#262930] rounded-xl transition text-xs font-semibold border border-[#c9a227]/30 shadow-md"
          >
            <BedDouble size={16} /> Interactive Room Rack 2.0
          </Link>
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a227] text-black hover:bg-[#e5c76b] rounded-xl transition text-xs font-bold shadow-md"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Sync Summary
          </button>
        </div>
      </div>

      {/* Top KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* In House Card */}
        <div
          onClick={() => setActiveTab("IN_HOUSE")}
          className={`cursor-pointer bg-white p-5 rounded-xl border-2 transition-all ${
            activeTab === "IN_HOUSE"
              ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-sm"
              : "border-gray-200 hover:border-purple-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <Users size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">In-House</span>
          </div>
          <p className="text-4xl font-serif font-bold text-gray-900">{counts.inHouse}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">Active Stays</p>
        </div>

        {/* Occupied Rooms Card */}
        <div
          onClick={() => setActiveTab("OCCUPIED")}
          className={`cursor-pointer bg-white p-5 rounded-xl border-2 transition-all ${
            activeTab === "OCCUPIED"
              ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-sm"
              : "border-gray-200 hover:border-indigo-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-indigo-500 mb-2">
            <BedDouble size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-indigo-500/20 text-indigo-700 px-2 py-0.5 rounded border border-indigo-500/30">Occupied</span>
          </div>
          <p className="text-4xl font-serif font-bold text-gray-900">{summary?.occupiedRooms?.length ?? 0}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">Rooms In Use</p>
        </div>

        {/* Available Rooms Card */}
        <div
          onClick={() => setActiveTab("AVAILABLE")}
          className={`cursor-pointer bg-white p-5 rounded-xl border-2 transition-all ${
            activeTab === "AVAILABLE"
              ? "border-teal-500 bg-teal-500/10 shadow-lg shadow-sm"
              : "border-gray-200 hover:border-teal-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-teal-500 mb-2">
            <CheckCircle2 size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-teal-500/20 text-teal-700 px-2 py-0.5 rounded border border-teal-500/30">Available</span>
          </div>
          <p className="text-4xl font-serif font-bold text-gray-900">{summary?.availableRooms?.length ?? 0}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">Clean &amp; Ready</p>
        </div>

        {/* Dirty Rooms Card */}
        <div
          onClick={() => setActiveTab("DIRTY")}
          className={`cursor-pointer bg-white p-5 rounded-xl border-2 transition-all ${
            activeTab === "DIRTY"
              ? "border-red-500 bg-red-500/10 shadow-lg shadow-sm"
              : "border-gray-200 hover:border-red-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-red-400 mb-2">
            <BedDouble size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">Dirty Rooms</span>
          </div>
          <p className="text-4xl font-serif font-bold text-gray-900">{counts.dirtyRooms}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">Pending Cleaning</p>
        </div>

        {/* Unassigned Card */}
        <div
          onClick={() => setActiveTab("UNASSIGNED")}
          className={`cursor-pointer bg-white p-5 rounded-xl border-2 transition-all ${
            activeTab === "UNASSIGNED"
              ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-sm"
              : "border-gray-200 hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <AlertCircle size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">Unassigned</span>
          </div>
          <p className="text-4xl font-serif font-bold text-gray-900">{counts.unassignedBookings}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">To Allocate</p>
        </div>

        {/* Departures Card */}
        <div
          onClick={() => setActiveTab("DEPARTURES")}
          className={`cursor-pointer bg-white p-5 rounded-xl border-2 transition-all ${
            activeTab === "DEPARTURES"
              ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-sm"
              : "border-gray-200 hover:border-blue-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <LogOut size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">Departures</span>
          </div>
          <p className="text-4xl font-serif font-bold text-gray-900">{counts.departures}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">Checking Out</p>
        </div>

        {/* Arrivals Card */}
        <div
          onClick={() => setActiveTab("ARRIVALS")}
          className={`cursor-pointer bg-white p-5 rounded-xl border-2 transition-all ${
            activeTab === "ARRIVALS"
              ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-sm"
              : "border-gray-200 hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <LogIn size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">Arrivals</span>
          </div>
          <p className="text-4xl font-serif font-bold text-gray-900">{counts.arrivals}</p>
          <p className="text-sm font-medium text-gray-600 mt-1">Expected Today</p>
        </div>

        {/* VIP Guests Card */}
        <div className="bg-white p-4 rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/5">
          <div className="flex items-center justify-between text-[#c9a227] mb-2">
            <Sparkles size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-[#c9a227]/20 text-[#e5c76b] px-2 py-0.5 rounded border border-[#c9a227]/30">VIP Guests</span>
          </div>
          <p className="text-2xl font-serif font-bold text-gray-800">{vipsCount}</p>
          <p className="text-[11px] text-gray-500 mt-1">High Priority</p>
        </div>
      </div>

      {/* Live Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search guest name, booking ref #, phone, room #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 placeholder-gray-500 pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-[#c9a227] transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-800">
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
                : "bg-gray-100 text-gray-600 border-gray-200 hover:border-[#c9a227]/40"
            }`}
          >
            <Sparkles size={14} /> VIP Only
          </button>
          <button
            onClick={() => setUnpaidOnlyFilter(!unpaidOnlyFilter)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 ${
              unpaidOnlyFilter
                ? "bg-red-500 text-gray-800 border-red-500"
                : "bg-gray-100 text-gray-600 border-gray-200 hover:border-red-500/40"
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
              className="px-3 py-1.5 text-xs font-mono text-gray-500 hover:text-gray-800 underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-4 md:gap-8 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("IN_HOUSE")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "IN_HOUSE" ? "border-purple-500 text-purple-400" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Users size={15} /> In-House Stays ({inHouseGrouped.length}{summary?.inHouse?.length && summary.inHouse.length !== inHouseGrouped.length ? ` · ${summary.inHouse.length} Rms` : ""})
          </button>
          <button
            onClick={() => setActiveTab("OCCUPIED")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "OCCUPIED" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <BedDouble size={15} /> Occupied Rooms ({summary?.occupiedRooms?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("AVAILABLE")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "AVAILABLE" ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <CheckCircle2 size={15} /> Available Rooms ({summary?.availableRooms?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("DIRTY")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "DIRTY" ? "border-red-500 text-red-400" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <BedDouble size={15} /> Dirty / Turnover Rooms ({summary?.dirtyRooms?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("UNASSIGNED")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "UNASSIGNED" ? "border-amber-500 text-amber-400" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <AlertCircle size={15} /> Unassigned Bookings ({unassignedGrouped.length}{summary?.unassignedBookings?.length && summary.unassignedBookings.length !== unassignedGrouped.length ? ` · ${summary.unassignedBookings.length} Rms` : ""})
          </button>
          <button
            onClick={() => setActiveTab("DEPARTURES")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "DEPARTURES" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <LogOut size={15} /> Scheduled Departures ({departuresGrouped.length}{summary?.todaysDepartures?.length && summary.todaysDepartures.length !== departuresGrouped.length ? ` · ${summary.todaysDepartures.length} Rms` : ""})
          </button>
          <button
            onClick={() => setActiveTab("ARRIVALS")}
            className={`pb-3 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "ARRIVALS" ? "border-emerald-500 text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <LogIn size={15} /> Expected Arrivals ({arrivalsGrouped.length}{summary?.todaysArrivals?.length && summary.todaysArrivals.length !== arrivalsGrouped.length ? ` · ${summary.todaysArrivals.length} Rms` : ""})
          </button>
        </div>

        {/* Render Tab Data */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <CheckCircle2 size={36} className="mx-auto text-gray-600 mb-2 opacity-50" />
            <p className="text-sm font-medium">No records found matching your filters.</p>
          </div>
        ) : (
          <div className="table-scroll">
            {activeTab === "AVAILABLE" || activeTab === "OCCUPIED" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((room: any) => (
                  <div key={room._id} className={`p-4 bg-gray-50 border rounded-xl space-y-2 ${activeTab === "AVAILABLE" ? "border-teal-500/40" : room.overdue ? "border-red-500/50" : "border-indigo-500/40"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-lg font-bold text-gray-800">Room {room.roomNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${activeTab === "AVAILABLE" ? "bg-teal-500/15 text-teal-700 border-teal-500/40" : room.overdue ? "bg-red-500/15 text-red-700 border-red-500/40" : "bg-indigo-500/15 text-indigo-700 border-indigo-500/40"}`}>
                        {activeTab === "AVAILABLE" ? "READY" : room.overdue ? "OVERDUE" : "OCCUPIED"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{room.categoryName || "—"}{room.floor ? ` · Floor ${room.floor}` : ""}</p>
                    {activeTab === "OCCUPIED" && (
                      <p className="text-xs text-gray-800 font-semibold">
                        {room.guestName || "Guest"}{room.bookingReference ? <span className="font-mono font-normal text-gray-500"> · #{room.bookingReference}</span> : null}
                      </p>
                    )}
                    <div className="pt-1">
                      {activeTab === "AVAILABLE" ? (
                        <Link to="/admin/guest-registration" className="w-full text-center block text-xs font-semibold text-teal-700 bg-teal-500/10 hover:bg-teal-500/20 py-2 rounded-lg border border-teal-500/30 transition">
                          New Walk-In →
                        </Link>
                      ) : room.bookingId ? (
                        <Link to={`/admin/bookings/${room.bookingId}`} className="w-full text-center block text-xs font-semibold text-indigo-700 bg-indigo-500/10 hover:bg-indigo-500/20 py-2 rounded-lg border border-indigo-500/30 transition">
                          Open Booking →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === "DIRTY" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((room: any) => (
                  <div key={room._id} className="p-4 bg-gray-100 border border-red-500/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-lg font-bold text-gray-800">Room {room.roomNumber}</span>
                      <span className="text-[10px] bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded border border-red-500/40">
                        {room.housekeepingStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">Category: {room.roomCategory?.name || room.categoryName || "—"}</p>
                    <p className="text-xs text-gray-500">Floor: {room.floor || "—"}</p>
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
                <thead className="bg-gray-100 text-gray-500 text-xs uppercase font-mono border-b border-gray-200">
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
                    const guestName = `${b.guestDetails?.firstName || "Guest"} ${b.guestDetails?.lastName || ""}`.trim();
                    const roomNum = b.assignedRoom?.roomNumber || b.roomNumber;
                    const paid = b.paidAmountCombined !== undefined ? b.paidAmountCombined : (b.paidAmount || 0);
                    const total = b.totalPriceCombined !== undefined ? b.totalPriceCombined : (b.totalAmount || b.totalPrice || 0);
                    const balance = total - paid;
                    const isGroup = Boolean(b.isGroup);
                    const roomCount = b.roomCount || 1;
                    const isExpanded = Boolean(expandedGroups[b._groupKey]);

                    return (
                      <React.Fragment key={b._id}>
                        <tr className="hover:bg-gray-100/80 transition">
                          {/* Guest & Ref */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#262930] flex items-center justify-center font-bold text-xs text-[#c9a227] border border-[#c9a227]/30 flex-shrink-0">
                                {guestName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-800 flex items-center gap-1.5 flex-wrap">
                                  <span>{guestName}</span>
                                  {isGroup && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-500/40 flex items-center gap-1 shadow-sm">
                                      <Users size={11} className="text-amber-700" /> Group ({roomCount} Rooms)
                                    </span>
                                  )}
                                  {b.isVipGuest && (
                                    <span className="text-[10px] bg-[#c9a227]/20 text-[#e5c76b] px-1.5 py-0.5 rounded font-bold border border-[#c9a227]/40 flex items-center gap-0.5">
                                      <Sparkles size={10} /> VIP
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-mono text-gray-500 flex items-center gap-2 mt-0.5">
                                  <span>#{b.bookingReference}{isGroup ? ` (+${roomCount - 1} more)` : ""}</span>
                                  <span>·</span>
                                  <span>{b.guestDetails?.phoneNumber || b.guestDetails?.phone || "No phone"}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Room & Category */}
                          <td className="p-3.5">
                            {isGroup ? (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {b.groupBookings.map((gb: any) => {
                                    const rm = gb.assignedRoom?.roomNumber || gb.roomNumber;
                                    return (
                                      <span
                                        key={gb._id}
                                        className="font-serif font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 text-xs flex items-center gap-1 shadow-sm"
                                      >
                                        <BedDouble size={12} className="text-emerald-600" />
                                        Room {rm || "Unassigned"}
                                        <span className="text-[10px] text-gray-500 font-normal font-sans ml-0.5">
                                          ({gb.roomCategory?.name || "Suite"})
                                        </span>
                                      </span>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleGroupExpand(b._groupKey)}
                                  className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition"
                                >
                                  <span>{isExpanded ? "Hide room controls" : `Manage all ${roomCount} rooms`}</span>
                                  <ChevronDown size={13} className={cn("transition-transform", isExpanded && "rotate-180")} />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="text-xs font-medium text-gray-600">{b.roomCategory?.name || "Uncategorised"}</div>
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
                              </div>
                            )}
                          </td>

                          {/* Stay Dates */}
                          <td className="p-3.5 text-xs text-gray-600">
                            <div className="flex items-center gap-1 text-gray-500 font-mono">
                              <Calendar size={13} className="text-[#c9a227]" />
                              {new Date(b.checkInDate).toLocaleDateString()} → {new Date(b.checkOutDate).toLocaleDateString()}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">{Math.max(1, countNights(b.checkInDate, b.checkOutDate))} Night(s)</div>
                          </td>

                          {/* Financial Status */}
                          <td className="p-3.5 text-xs">
                            <div className="font-mono text-gray-800 font-semibold">
                              Total: ₹{total.toLocaleString()}
                              {isGroup && (
                                <span className="text-[10px] text-gray-500 block font-normal">
                                  ({roomCount} rooms combined)
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5">
                              {balance <= 0 ? (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">
                                  PAID IN FULL
                                </span>
                              ) : (
                                <span className="text-[10px] bg-red-500/20 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-500/30">
                                  BAL DUE: ₹{balance.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right space-x-1.5">
                            {/* Print GRC Card */}
                            <Link
                              to={`/admin/bookings/${b._id}/grc-print`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-700 hover:text-black px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-[#c9a227] transition"
                              title="Print GRC Card & Consent Form (All Rooms)"
                            >
                              <Printer size={13} className="text-[#c9a227]" /> GRC
                            </Link>

                            {/* Print GST Invoice */}
                            <Link
                              to={`/admin/bookings/${b._id}/folio-print`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-700 hover:text-black px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-[#c9a227] transition"
                              title="Print GST Invoice (Day-by-Day Folio)"
                            >
                              <Printer size={13} className="text-emerald-600" /> Invoice
                            </Link>

                            {/* Folio Drawer Button */}
                            <button
                              onClick={() => openFolioDrawer(b)}
                              className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-600 hover:text-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-[#c9a227]/40 transition"
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
                                <LogIn size={13} /> {isGroup ? "Check In Group" : "Check In"}
                              </button>
                            )}

                            {activeTab === "DEPARTURES" && (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => openExtendStay(b)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 px-2.5 py-1.5 rounded-lg border border-purple-200 transition shadow-xs"
                                  title="Extend Stay / Postpone Departure"
                                >
                                  <Clock size={13} className="text-purple-600" /> Extend Stay
                                </button>
                                <button
                                  onClick={() => openCheckOut(b)}
                                  className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-md transition"
                                >
                                  <LogOut size={13} /> Check Out
                                </button>
                              </div>
                            )}

                            {activeTab === "IN_HOUSE" && (
                              <>
                                {isGroup ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => toggleGroupExpand(b._groupKey)}
                                      className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-300 transition"
                                    >
                                      <BedDouble size={13} /> {isExpanded ? "Close Rooms" : "Manage Rooms"}
                                    </button>
                                    <button
                                      onClick={() => openExtendStay(b)}
                                      className="inline-flex items-center gap-1 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 px-2.5 py-1.5 rounded-lg border border-purple-200 transition shadow-xs"
                                      title="Extend Stay for All Rooms"
                                    >
                                      <Clock size={13} className="text-purple-600" /> Extend Stay
                                    </button>
                                    <button
                                      onClick={() => openCheckOut(b)}
                                      className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-md transition"
                                    >
                                      Express Checkout
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => openRoomMove(b)}
                                      className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-amber-600 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/30 transition"
                                    >
                                      <ArrowLeftRight size={13} /> Move
                                    </button>
                                    <button
                                      onClick={() => openExtendStay(b)}
                                      className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-purple-600 hover:bg-purple-500/20 px-2.5 py-1.5 rounded-lg border border-purple-500/30 transition"
                                    >
                                      <Clock size={13} /> Extend
                                    </button>
                                    <button
                                      onClick={() => openExtendStay(b, undefined, "EARLY_CHECK_IN")}
                                      className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-teal-700 hover:bg-teal-500/10 px-2.5 py-1.5 rounded-lg border border-teal-500/30 transition"
                                      title="Charge early check-in by the hour"
                                    >
                                      <LogIn size={13} /> Early C/I
                                    </button>
                                    <button
                                      onClick={() => setCancelStay({ booking: b, reason: "", charge: "" })}
                                      className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-red-600 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/30 transition"
                                      title="Cancel this stay (checked in by mistake / guest left)"
                                    >
                                      <X size={13} /> Cancel Stay
                                    </button>
                                    <button
                                      onClick={() => openCheckOut(b)}
                                      className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-md transition"
                                    >
                                      Express Checkout
                                    </button>
                                  </>
                                )}
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

                        {/* ACCORDION: Multi-Room Group Breakdown Sub-Row */}
                        {isGroup && isExpanded && (
                          <tr className="bg-amber-50/40 border-b border-amber-200/60">
                            <td colSpan={5} className="p-4 pl-12">
                              <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                                    <BedDouble size={14} className="text-amber-700" />
                                    Group Room Breakdown ({roomCount} Rooms booked by {guestName})
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono">
                                    Primary Ref: #{b.bookingReference}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {b.groupBookings.map((gb: any) => {
                                    const rNum = gb.assignedRoom?.roomNumber || gb.roomNumber || "Unassigned";
                                    const rCat = gb.roomCategory?.name || "Standard";
                                    const rTotal = gb.totalAmount || gb.totalPrice || 0;
                                    const rPaid = gb.paidAmount || 0;
                                    const rBal = rTotal - rPaid;

                                    return (
                                      <div key={gb._id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col justify-between gap-3 shadow-xs">
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-serif font-bold text-gray-900 text-sm">Room {rNum}</span>
                                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium border border-indigo-200">{rCat}</span>
                                            </div>
                                            <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                                              Ref: #{gb.bookingReference}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-xs font-bold text-gray-800">₹{rTotal.toLocaleString()}</div>
                                            <div className="text-[10px] font-medium text-gray-500">
                                              {rBal <= 0 ? (
                                                <span className="text-emerald-700 font-bold">Paid</span>
                                              ) : (
                                                <span className="text-red-600 font-bold">Bal: ₹{rBal.toLocaleString()}</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Room Specific Actions */}
                                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-gray-200">
                                          <button
                                            type="button"
                                            onClick={() => openFolioDrawer(gb)}
                                            className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-300 transition"
                                          >
                                            Room Folio
                                          </button>
                                          {(activeTab === "IN_HOUSE" || activeTab === "DEPARTURES") && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => openRoomMove(gb)}
                                                className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-amber-50 text-amber-700 rounded border border-amber-300 transition"
                                              >
                                                Move
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => openExtendStay(gb)}
                                                className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-purple-50 text-purple-700 rounded border border-purple-300 transition"
                                              >
                                                Extend
                                              </button>
                                              {gb.status === "CHECKED_IN" && (
                                                <button
                                                  type="button"
                                                  onClick={() => openExtendStay(gb, [gb], "EARLY_CHECK_IN")}
                                                  className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-teal-50 text-teal-700 rounded border border-teal-300 transition"
                                                >
                                                  Early C/I
                                                </button>
                                              )}
                                              {gb.status === "CHECKED_IN" && (
                                                <button
                                                  type="button"
                                                  onClick={() => setCancelStay({ booking: gb, reason: "", charge: "" })}
                                                  className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-red-50 text-red-700 rounded border border-red-300 transition"
                                                >
                                                  Cancel Stay
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => openCheckOut(gb)}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded transition shadow-sm"
                                              >
                                                Checkout
                                              </button>
                                            </>
                                          )}
                                          {activeTab === "ARRIVALS" && (
                                            <button
                                              type="button"
                                              onClick={() => openCheckIn(gb)}
                                              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition shadow-sm"
                                            >
                                              Check In
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 text-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2">
                <LogIn className="text-emerald-400" size={20} />
                <h3 className="font-serif text-lg font-bold">Process Guest Check-In</h3>
              </div>
              <button onClick={() => setCheckInModal({ open: false, booking: null })} className="text-gray-500 hover:text-gray-800">
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Guest Name:</span>
                <span className="font-bold text-gray-800">{checkInModal.booking.guestDetails?.firstName} {checkInModal.booking.guestDetails?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Booking Ref:</span>
                <span className="font-mono text-[#c9a227]">#{checkInModal.booking.bookingReference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category Reserved:</span>
                <span className="text-gray-800">{checkInModal.booking.roomCategory?.name || "Standard Suite"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 text-[11px]">
                <div>
                  <span className="text-gray-500 block">Check-In Arrival:</span>
                  <span className="font-semibold text-gray-800">{new Date(checkInModal.booking.checkInDate).toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Scheduled Check-Out:</span>
                  <span className="font-semibold text-gray-800">{new Date(checkInModal.booking.checkOutDate).toLocaleDateString()} (11:00 AM)</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-gray-200 text-gray-700 font-semibold">
                <span>Booked Tariff: ₹{(checkInModal.booking.totalPrice || checkInModal.booking.totalAmount || 0).toLocaleString()}</span>
                <span className="text-emerald-600">Advance Paid: ₹{(checkInModal.booking.paidAmount || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Assign Clean Room</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
                >
                  <option value="">-- Select Available Room --</option>
                  {availableRooms.map((rm) => (
                    <option key={rm._id} value={rm._id}>
                      Room {rm.roomNumber} ({rm.category?.name || "Suite"}) — {rm.housekeepingStatus}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ID Type / Document</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
                  >
                    <option>Passport / Govt ID</option>
                    <option>Aadhaar Card</option>
                    <option>Driver's License</option>
                    <option>Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ID Number / Reg Ref</label>
                  <input
                    type="text"
                    placeholder="Enter ID number"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                onClick={() => setCheckInModal({ open: false, booking: null })}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-[#262930]"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction || !selectedRoomId}
                onClick={handleProcessCheckIn}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-gray-800 rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
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
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 text-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2">
                <LogOut className="text-blue-400" size={20} />
                <h3 className="font-serif text-lg font-bold">Express Guest Checkout & Folio Settlement</h3>
              </div>
              <button onClick={() => setCheckOutModal({ open: false, booking: null, preview: null })} className="text-gray-500 hover:text-gray-800">
                <X size={20} />
              </button>
            </div>

            {/* Stay Timing & Duration Information */}
            {checkOutModal.booking && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between items-center text-blue-900 font-bold">
                  <span>Guest: {checkOutModal.booking.guestDetails?.firstName} {checkOutModal.booking.guestDetails?.lastName}</span>
                  <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px]">
                    Room {checkOutModal.booking.assignedRoom?.roomNumber || checkOutModal.booking.assignedRoomNumber || "Assigned"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-200/60 text-gray-700 text-[11px]">
                  <div>
                    <span className="text-gray-500 block">Check-In Time:</span>
                    <span className="font-semibold">{new Date(checkOutModal.booking.checkInDate).toLocaleDateString()} {checkOutModal.booking.checkedInAt ? new Date(checkOutModal.booking.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Standard (12:00 PM)"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Check-Out Time:</span>
                    <span className="font-semibold">{new Date(checkOutModal.booking.checkOutDate).toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Now)</span>
                  </div>
                </div>
                <div className="text-[11px] text-blue-800 font-medium">
                  Stay Duration: {Math.max(1, countNights(new Date(checkOutModal.booking.checkInDate), new Date(checkOutModal.booking.checkOutDate)))} night(s) booked
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 p-3 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="font-semibold text-gray-700">Room tariff per night (₹)</label>
                <span className="text-[11px] text-gray-500">{checkOutModal.booking?.pricesIncludeTax || checkOutModal.preview?.booking?.pricesIncludeTax ? "GST included" : "GST added on top"}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={checkoutRate}
                  onChange={(e) => setCheckoutRate(e.target.value)}
                  className="flex-1 bg-gray-100 border border-gray-200 rounded-lg p-2 font-mono"
                />
                <button
                  type="button"
                  disabled={applyingRate || checkoutRate === "" || Number(checkoutRate) === Number(checkOutModal.preview?.booking?.ratePerNight ?? checkOutModal.booking?.ratePerNight) && !checkOutModal.preview?.earlyDeparture}
                  onClick={async () => {
                    setApplyingRate(true);
                    try {
                      const token = getStoredAuthToken();
                      const res = await fetch(`/api/front-desk/bookings/${checkOutModal.booking._id}/checkout-tariff`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ ratePerNight: Number(checkoutRate), reason: "Tariff set at checkout" }),
                      });
                      const json = await res.json().catch(() => ({ success: false, message: `Server error (${res.status})` }));
                      if (json.success) {
                        toast({ title: "Tariff Updated", description: json.message });
                        queryClient.invalidateQueries();
                        await openCheckOut(checkOutModal.booking);
                      } else {
                        toast({ title: "Tariff not changed", description: json.message, variant: "destructive" });
                      }
                    } finally {
                      setApplyingRate(false);
                    }
                  }}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {applyingRate ? "Applying..." : "Apply Tariff"}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Charged for the nights actually stayed{checkOutModal.preview?.earlyDeparture ? " (early check-out: unused nights are credited first)" : ""}, with CGST + SGST. A rate below the room type's rate goes to Reception for verification.
              </p>
            </div>

            {checkOutModal.preview?.earlyDeparture && (
              <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs text-amber-900">
                <b>Early check-out:</b> booked until {checkOutModal.preview.earlyDeparture.bookedCheckOut}, leaving {checkOutModal.preview.earlyDeparture.newCheckOut}.{" "}
                {checkOutModal.preview.earlyDeparture.unusedNights.length} unused night{checkOutModal.preview.earlyDeparture.unusedNights.length === 1 ? "" : "s"} ({checkOutModal.preview.earlyDeparture.unusedNights.join(", ")}) and their GST
                will be credited to the bill automatically when you send it to billing, and the nights become free to sell.
              </div>
            )}

            <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 space-y-3 font-mono text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Total Charges (Room & Ancillary):</span>
                <span>₹{(checkOutModal.preview?.summary?.totalCharges || checkOutModal.booking.totalPrice || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Taxes & GST:</span>
                <span>₹{(checkOutModal.preview?.summary?.totalTax || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Total Discounts:</span>
                <span>- ₹{(checkOutModal.preview?.summary?.totalDiscounts || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Total Paid / Advance Adjusted:</span>
                <span>- ₹{((checkOutModal.preview?.summary?.totalPaid || 0) + (checkOutModal.preview?.summary?.totalAdvanceAdjusted || 0)).toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-sm text-gray-800">
                <span>Computed Balance Due:</span>
                <span className="text-amber-500 font-black">₹{(checkOutModal.preview?.summary?.balanceDue || 0).toLocaleString()}</span>
              </div>
              {(checkOutModal.preview?.summary?.refundDue || 0) > 0 && (
                <div className="flex justify-between items-center font-bold text-xs text-blue-700 bg-blue-50 border border-blue-200 p-2.5 rounded-lg">
                  <span>Surplus Credit / Refund to Guest:</span>
                  <span className="font-mono text-sm">₹{checkOutModal.preview?.summary?.refundDue.toLocaleString()} (Auto-settled)</span>
                </div>
              )}
            </div>

            {/* Payment & Amount Entry: Auto vs Manual */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700">Settlement Amount to Collect (₹)</label>
                <button
                  type="button"
                  onClick={() => {
                    const newMode = !isManualOverride;
                    setIsManualOverride(newMode);
                    if (!newMode) {
                      setSettlementAmount(checkOutModal.preview?.summary?.balanceDue || 0);
                    }
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline"
                >
                  {isManualOverride ? "Reset to Auto Computed" : "✏️ Enter Manual Amount"}
                </button>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => {
                    setIsManualOverride(true);
                    setSettlementAmount(e.target.value);
                  }}
                  className={cn(
                    "w-full text-sm font-bold rounded-xl p-2.5 border transition",
                    isManualOverride
                      ? "bg-amber-50 border-amber-400 text-amber-950 focus:border-amber-600"
                      : "bg-gray-100 border-gray-300 text-gray-800 focus:border-[#c9a227]"
                  )}
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-gray-500">
                  {isManualOverride ? "MANUAL ENTRY" : "AUTO COMPUTED"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
                  >
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="Unified Payments Interface">UPI / GPay / QR Scan</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="CITY_LEDGER">Direct Bill / Corporate City Ledger</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Checkout Reference / Notes</label>
                  <input
                    type="text"
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    placeholder="e.g. Transaction Ref, Split Bill"
                    className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const b = checkOutModal.booking;
                    setCheckOutModal({ open: false, booking: null, preview: null });
                    openFolioDrawer(b);
                  }}
                  className="px-3.5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-100"
                >
                  + Add Additional Charge
                </button>
                <button
                  onClick={() => {
                    const b = checkOutModal.booking;
                    setCheckOutModal({ open: false, booking: null, preview: null });
                    openExtendStay(b);
                  }}
                  className="px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-purple-200"
                >
                  <Clock size={13} className="text-purple-600" /> Extend Stay Instead
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCheckOutModal({ open: false, booking: null, preview: null })}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-[#262930] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={submittingAction}
                  onClick={handleProcessCheckOut}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
                >
                  {submittingAction ? "Sending..." : "Send to Cashier & Billing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL A CHECKED-IN STAY */}
      {cancelStay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                <h3 className="font-serif text-lg font-bold">Cancel Stay — Room {roomOf(cancelStay.booking)}</h3>
              </div>
              <button onClick={() => setCancelStay(null)} className="text-gray-500 hover:text-gray-800">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              {cancelStay.booking.guestDetails?.firstName} {cancelStay.booking.guestDetails?.lastName} ({cancelStay.booking.bookingReference}) is checked in.
              Cancelling reverses every room charge and its GST, sends the room to housekeeping and frees its nights.
              What the guest paid is shown as due back so you can refund it.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (required)</label>
              <input
                type="text"
                placeholder="e.g. Checked in by mistake, guest left due to emergency"
                value={cancelStay.reason}
                onChange={(e) => setCancelStay({ ...cancelStay, reason: e.target.value })}
                className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cancellation charge ₹ (optional)</label>
              <input
                type="number"
                min="0"
                placeholder="0 — e.g. for hours the room was used"
                value={cancelStay.charge}
                onChange={(e) => setCancelStay({ ...cancelStay, charge: e.target.value })}
                className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5"
              />
              <p className="mt-1 text-[11px] text-gray-500">Billed as accommodation with GST and taken from what the guest already paid.</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button onClick={() => setCancelStay(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold">
                Keep Stay
              </button>
              <button
                disabled={submittingAction || cancelStay.reason.trim().length < 3}
                onClick={handleCancelStay}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submittingAction ? "Cancelling..." : "Confirm Cancel Stay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ROOM MOVE */}
      {roomMoveModal.open && roomMoveModal.booking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="text-amber-400" size={20} />
                <h3 className="font-serif text-lg font-bold">Quick In-House Room Move</h3>
              </div>
              <button onClick={() => setRoomMoveModal({ open: false, booking: null })} className="text-gray-500 hover:text-gray-800">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Select New Clean Room</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
              >
                <option value="">-- Select Destination Room --</option>
                {availableRooms.map((rm) => (
                  <option key={rm._id} value={rm._id}>
                    Room {rm.roomNumber} ({rm.category?.name || "Suite"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Room Rate</label>
              <div className="grid grid-cols-2 gap-2">
                {([["KEEP", `Keep ₹${Number(roomMoveModal.booking.ratePerNight || 0).toLocaleString("en-IN")}/night`], ["NEW", "Use new room's rate"]] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setMoveRateMode(v)} className={`min-h-[40px] rounded-xl border text-xs font-bold ${moveRateMode === v ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-white border-gray-200 text-gray-600"}`}>{label}</button>
                ))}
              </div>
              {moveRateMode === "NEW" && (
                <input type="number" min="1" placeholder={`New rate per night (default ₹${Number(availableRooms.find((r: any) => r._id === selectedRoomId)?.category?.basePrice || 0).toLocaleString("en-IN")})`} value={moveNewRate} onChange={(e) => setMoveNewRate(e.target.value)} className="mt-2 w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5" />
              )}
              <p className="mt-1 text-[11px] text-gray-500">The old room goes to housekeeping. With a new rate, nights already charged are adjusted on the bill (with GST); later nights are charged at the new rate.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reason for Move</label>
              <input
                type="text"
                placeholder="e.g. AC issue, Guest requested high floor"
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button onClick={() => setRoomMoveModal({ open: false, booking: null })} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold">
                Cancel
              </button>
              <button
                disabled={submittingAction || !selectedRoomId}
                onClick={handleProcessRoomMove}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-gray-800 rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
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
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="text-purple-400" size={20} />
                <h3 className="font-serif text-lg font-bold">{extendMode === "EARLY_CHECK_IN" ? "Early Check-in" : "Extend Guest Stay"}</h3>
              </div>
              <button onClick={() => setExtendModal({ open: false, booking: null })} className="text-gray-500 hover:text-gray-800">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {([["NIGHTS", "Extra nights"], ["LATE_CHECK_OUT", "Late check-out (hours)"], ["EARLY_CHECK_IN", "Early check-in (hours)"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchExtendMode(m)}
                  className={`min-h-[40px] rounded-xl border px-2 text-[11px] font-bold leading-tight ${extendMode === m ? "bg-purple-100 border-purple-400 text-purple-900" : "bg-white border-gray-200 text-gray-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {extendMode !== "NIGHTS" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{extendMode === "LATE_CHECK_OUT" ? "Extra hours after check-out time" : "Hours before check-in time"}</label>
                  <input
                    type="number"
                    min={1}
                    max={23}
                    value={extendHours}
                    onChange={(e) => { setExtendHours(e.target.value); loadHourQuotes(extendMode, e.target.value, extendModal.booking.groupBookings || [extendModal.booking]); }}
                    className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
                  />
                </div>
                <ul className="text-xs divide-y divide-gray-100 border border-gray-200 rounded-xl">
                  {(extendModal.booking.groupBookings || [extendModal.booking]).map((g: any) => {
                    const id = String(g._id);
                    const on = extendSelected.includes(id);
                    const hq = hourQuotes[id];
                    const many = (extendModal.booking.groupBookings || []).length > 1;
                    return (
                      <li key={id} className={`px-3 py-2 space-y-1.5 ${on ? "bg-purple-50/60" : ""}`}>
                        <label className="flex min-h-[32px] cursor-pointer items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-semibold">
                            {many && <input type="checkbox" checked={on} onChange={() => setExtendSelected(on ? extendSelected.filter((x) => x !== id) : [...extendSelected, id])} className="h-4 w-4 accent-purple-600" />}
                            Room {roomOf(g)}
                          </span>
                          {hq?.quote && (
                            <span className="text-gray-600">
                              {extendMode === "LATE_CHECK_OUT" ? `Departure ${hq.quote.fromTime} → ${hq.quote.toTime}` : `Arrival ${hq.quote.toTime} (not ${hq.quote.fromTime})`}
                            </span>
                          )}
                        </label>
                        {hq?.error && <div className="text-red-600">{hq.error}</div>}
                        {hq?.quote && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 shrink-0">₹</span>
                            <input
                              type="number"
                              min={0}
                              value={hq.amount}
                              onChange={(e) => setHourQuotes({ ...hourQuotes, [id]: { ...hq, amount: e.target.value } })}
                              className="w-28 bg-white border border-gray-200 rounded-lg p-1.5 font-mono"
                            />
                            <span className="text-[11px] text-gray-500">
                              {hq.quote.hourlyPrice > 0 ? `₹${hq.quote.hourlyPrice.toLocaleString("en-IN")}/hour × ${hq.quote.hours}` : hq.quote.flatFee > 0 ? "fee from Settings" : "set the amount"}
                              {" · "}{hq.quote.pricesIncludeTax ? "GST included" : `+ GST ${hq.quote.gstRate}%`} = <b className="font-mono">₹{hourTotal(hq.quote, hq.amount).toLocaleString("en-IN")}</b>
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <label className="flex items-center gap-2 text-[11px] text-gray-600">
                  <input type="checkbox" checked={hourForce} onChange={(e) => setHourForce(e.target.checked)} className="h-4 w-4 accent-purple-600" />
                  Add even if already charged / the next guest arrives in this room today
                </label>
                <p className="text-[11px] text-purple-700">
                  Posted to the bill as {extendMode === "LATE_CHECK_OUT" ? "Late check-out" : "Early check-in"} with CGST + SGST; the registration card and invoice show the new {extendMode === "LATE_CHECK_OUT" ? "departure" : "arrival"} time.
                </p>
              </div>
            )}

            {extendMode === "NIGHTS" && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">New Check-Out Date</label>
              <input
                type="date"
                value={newCheckOutDate}
                onChange={(e) => handleCheckExtension(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]"
              />
            </div>

            {extensionConflict && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-700 font-medium">
                ⚠️ {extensionConflict}
              </div>
            )}

            {newCheckOutDate && extensionQuotes.length > 0 && (
              <div className="space-y-1.5">
                {extensionQuotes.length > 1 && (
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Tick the rooms to extend</span>
                    <span className="flex gap-3">
                      <button type="button" className="font-semibold text-purple-700 hover:underline" onClick={() => { const all = extensionQuotes.map((q) => String(q.booking._id)); setExtendSelected(all); applyExtensionSelection(extensionQuotes, all); }}>All</button>
                      <button type="button" className="font-semibold text-purple-700 hover:underline" onClick={() => { setExtendSelected([]); applyExtensionSelection(extensionQuotes, []); }}>None</button>
                    </span>
                  </div>
                )}
                <ul className="text-xs divide-y divide-gray-100 border border-gray-200 rounded-xl">
                  {extensionQuotes.map((q) => {
                    const id = String(q.booking._id);
                    const on = extendSelected.includes(id);
                    return (
                      <li key={id}>
                        <label className={`flex min-h-[40px] cursor-pointer items-center justify-between gap-3 px-3 py-2 ${on ? "bg-purple-50/60" : ""}`}>
                          <span className="flex items-center gap-2 font-semibold">
                            {extensionQuotes.length > 1 && <input type="checkbox" checked={on} onChange={() => toggleExtendRoom(id)} className="h-4 w-4 accent-purple-600" />}
                            Room {q.room}
                          </span>
                          <span className={q.error ? "text-red-600" : q.skip ? "text-gray-400" : on ? "font-mono font-bold" : "font-mono text-gray-400 line-through"}>
                            {q.error ? "Unavailable" : q.skip ? "Already until this date" : `₹${q.cost.toLocaleString("en-IN")}`}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {newCheckOutDate && !extensionConflict && (
              <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl text-xs text-purple-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-purple-800">Additional Room Tariff + Tax:</span>
                  <span className="font-mono font-black text-sm text-purple-950">₹{extensionCost.toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-purple-700">
                  Posted to each ticked room's bill at the agreed room rate, with GST (CGST + SGST). The registration card, folio and invoice show the extension: original and new check-out.
                </p>
              </div>
            )}
            </>)}

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button onClick={() => setExtendModal({ open: false, booking: null })} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition">
                Cancel
              </button>
              {extendMode === "NIGHTS" ? (
                <button
                  disabled={submittingAction || !newCheckOutDate || Boolean(extensionConflict)}
                  onClick={handleProcessExtend}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition"
                >
                  {submittingAction ? "Extending..." : "Confirm Extension"}
                </button>
              ) : (
                <button
                  disabled={submittingAction || !extendSelected.some((id) => hourQuotes[id]?.quote)}
                  onClick={handleProcessHours}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition"
                >
                  {submittingAction ? "Adding..." : extendMode === "LATE_CHECK_OUT" ? "Add Late Check-out" : "Add Early Check-in"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FOLIO & BILLING COMMAND CENTER */}
      {folioDrawer.open && folioDrawer.booking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            {/* 1. TOP HEADER */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#c9a227]/10 text-[#c9a227] flex items-center justify-center border border-[#c9a227]/30 shadow-sm">
                  <Receipt size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-[#c9a227]/15 text-[#9e7b16] font-bold text-[10px] rounded-full border border-[#c9a227]/30 font-mono tracking-wider">
                      YES HOTELS BILLING
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      Folio #{folioDrawer.folio?._id ? folioDrawer.folio._id.toString().slice(-8) : "N/A"}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-700 bg-gray-200 px-2 py-0.5 rounded">
                      Ref #{folioDrawer.booking.billNumber || folioDrawer.booking.bookingReference}
                    </span>
                  </div>
                  <h3 className="font-serif text-lg md:text-xl font-black text-gray-900 mt-0.5">
                    Guest Folio & Itemized Billing Statement
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/admin/bookings/${folioDrawer.booking._id}/folio-print`}
                  target="_blank"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a227] hover:bg-[#b08d20] text-black text-xs font-bold rounded-xl transition shadow-sm"
                  title="Print GST Invoice"
                >
                  <Printer size={14} /> Print GST Invoice
                </Link>
                <button
                  onClick={() => setFolioDrawer({ open: false, booking: null, folio: null, isGroupFolio: false, allGroupBookings: [] })}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 2. MULTI-ROOM / GROUP SELECTOR BAR (IF MULTI-ROOM) */}
            {folioDrawer.allGroupBookings && folioDrawer.allGroupBookings.length > 1 && (
              <div className="px-5 py-2.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center gap-2 overflow-x-auto text-xs">
                <span className="font-bold text-amber-900 text-xs flex items-center gap-1 whitespace-nowrap">
                  <Users size={13} className="text-amber-700" /> Multi-Room Group:
                </span>
                <button
                  type="button"
                  onClick={() => openFolioDrawer(folioDrawer.booking, true, folioDrawer.allGroupBookings)}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition whitespace-nowrap flex items-center gap-1",
                    folioDrawer.isGroupFolio
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-white text-gray-700 hover:bg-amber-100 border border-gray-300"
                  )}
                >
                  <Sparkles size={12} /> Combined Group Bill ({folioDrawer.allGroupBookings.length} Rooms)
                </button>
                {folioDrawer.allGroupBookings.map((gb: any) => {
                  const rm = gb.assignedRoom?.roomNumber || gb.roomNumber || "Unassigned";
                  const isSelected = !folioDrawer.isGroupFolio && folioDrawer.booking._id === gb._id;
                  return (
                    <button
                      key={gb._id}
                      type="button"
                      onClick={() => openFolioDrawer(gb, false, folioDrawer.allGroupBookings)}
                      className={cn(
                        "px-3 py-1 rounded-lg font-bold transition whitespace-nowrap flex items-center gap-1",
                        isSelected
                          ? "bg-gray-900 text-white shadow-sm"
                          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                      )}
                    >
                      <BedDouble size={12} /> Room {rm}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3. GUEST & STAY PROFILE CARD */}
            <div className="px-5 py-4 bg-white border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                  {(folioDrawer.booking.guestDetails?.firstName || "G").charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <span>{folioDrawer.booking.guestDetails?.firstName} {folioDrawer.booking.guestDetails?.lastName}</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold border border-emerald-300">
                      {folioDrawer.isGroupFolio
                        ? `Group (${folioDrawer.allGroupBookings?.length} Rooms)`
                        : `Room ${folioDrawer.booking.assignedRoom?.roomNumber || folioDrawer.booking.roomNumber || "N/A"}`}
                    </span>
                  </div>
                  <div className="text-gray-500 font-mono mt-0.5">
                    Phone: {folioDrawer.booking.guestDetails?.phoneNumber || folioDrawer.booking.guestDetails?.phone || "No phone"} &bull; {folioDrawer.booking.guestDetails?.email || "No email"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-gray-600 font-mono">
                <div>
                  <span className="text-[10px] uppercase text-gray-400 block font-sans">Check-In &rarr; Check-Out</span>
                  <span className="font-bold text-gray-800">
                    {new Date(folioDrawer.booking.checkInDate).toLocaleDateString()} &rarr; {new Date(folioDrawer.booking.checkOutDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <span className="text-[10px] uppercase text-gray-400 block font-sans">Duration</span>
                  <span className="font-bold text-gray-800">
                    {Math.max(1, countNights(new Date(folioDrawer.booking.checkInDate), new Date(folioDrawer.booking.checkOutDate)))} Night(s)
                  </span>
                </div>
              </div>
            </div>

            {/* 4. ACTIONS COMMAND STRIP */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBill(!isEditingBill)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm",
                    isEditingBill
                      ? "bg-amber-600 text-white"
                      : "bg-[#c9a227] hover:bg-[#b08d20] text-black"
                  )}
                >
                  <Edit2 size={13} /> {isEditingBill ? "Hide Bill Editor" : "✏️ Edit Bill & Tariff Anytime"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCharge(!showAddCharge)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 border",
                    showAddCharge
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
                  )}
                >
                  <PlusCircle size={13} /> + Post Ancillary Charge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bookingToExtend = folioDrawer.booking;
                    setFolioDrawer({ open: false, booking: null, folio: null, isGroupFolio: false, allGroupBookings: [] });
                    openExtendStay(bookingToExtend, folioDrawer.allGroupBookings);
                  }}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold border border-purple-200 transition flex items-center gap-1.5 shadow-xs"
                  title="Extend Guest Stay / Room Duration"
                >
                  <Clock size={13} className="text-purple-600" /> Extend Stay
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/admin/bookings/${folioDrawer.booking._id}/grc-print`}
                  target="_blank"
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-xl border border-gray-300 transition flex items-center gap-1"
                >
                  <Printer size={13} className="text-[#c9a227]" /> Print GRC
                </Link>
                <Link
                  to={`/admin/bookings/${folioDrawer.booking._id}/folio-print`}
                  target="_blank"
                  className="px-3 py-1.5 bg-[#c9a227] hover:bg-[#b08d20] text-black font-bold rounded-xl transition flex items-center gap-1"
                >
                  <Printer size={13} /> Print GST Invoice
                </Link>
              </div>
            </div>

            {/* SCROLLABLE BODY AREA */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* 5. LIVE BILL EDITOR PANEL (WHEN ACTIVATED) */}
              {isEditingBill && (
                <div className="p-4 bg-amber-50/70 border-2 border-amber-300 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                    <div>
                      <h4 className="font-serif text-sm font-black text-amber-950 flex items-center gap-1.5">
                        <Edit2 size={15} className="text-amber-700" /> Live Bill & Tariff Modifier
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Change base tariff, extra bed, ancillary charges, discounts or advances. All ledger entries and GST (CGST 2.5% + SGST 2.5%) recalculate automatically.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      EDITABLE ANYTIME
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Room Tariff Rate / Night (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editBillForm.ratePerNight}
                        onChange={(e) => setEditBillForm({ ...editBillForm, ratePerNight: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-gray-300 text-sm text-gray-900 font-bold p-2.5 rounded-xl focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Extra Bed / Person Total (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editBillForm.extraBedAmount}
                        onChange={(e) => setEditBillForm({ ...editBillForm, extraBedAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-gray-300 text-sm text-gray-900 font-bold p-2.5 rounded-xl focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Discount / Concession (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editBillForm.discountAmount}
                        onChange={(e) => setEditBillForm({ ...editBillForm, discountAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-gray-300 text-sm text-gray-900 font-bold p-2.5 rounded-xl focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Other / Ancillary Charges (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editBillForm.otherCharges}
                        onChange={(e) => setEditBillForm({ ...editBillForm, otherCharges: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-gray-300 text-sm text-gray-900 font-bold p-2.5 rounded-xl focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Other Charges Description
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Laundry, Airport Pickup, F&B"
                        value={editBillForm.otherChargesDesc}
                        onChange={(e) => setEditBillForm({ ...editBillForm, otherChargesDesc: e.target.value })}
                        className="w-full bg-white border border-gray-300 text-sm text-gray-900 p-2.5 rounded-xl focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="text-xs text-gray-600 self-end">
                      Payments and advances are recorded in <b>Cashier &amp; Billing</b>; editing the tariff never changes them.
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-amber-200">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editBillForm.applyTax}
                        onChange={(e) => setEditBillForm({ ...editBillForm, applyTax: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>Apply GST (CGST 2.5% + SGST 2.5%, SAC 996311)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editBillForm.pricesIncludeTax}
                        onChange={(e) => setEditBillForm({ ...editBillForm, pricesIncludeTax: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>Rate includes GST (the guest pays the rate; GST is inside it)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingBill(false)}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-xs transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={submittingAction}
                        onClick={handleSaveBillEdit}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save size={14} /> {submittingAction ? "Saving & Recalculating..." : "Save & Recalculate Bill"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. QUICK POST CHARGE PANEL (WHEN OPEN) */}
              {showAddCharge && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <PlusCircle size={14} className="text-indigo-600" /> Post One-Off Ancillary Charge / Service
                    </h4>
                    <button onClick={() => setShowAddCharge(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Item description (e.g. Minibar, Laundry, Food)"
                      value={newChargeDesc}
                      onChange={(e) => setNewChargeDesc(e.target.value)}
                      className="sm:col-span-2 bg-white border border-gray-300 text-xs text-gray-900 rounded-xl p-2.5 focus:border-indigo-500"
                    />
                    <select
                      value={newChargeType}
                      onChange={(e) => setNewChargeType(e.target.value)}
                      className="bg-white border border-gray-300 text-xs text-gray-900 rounded-xl p-2.5"
                    >
                      <option value="ADDON">Other / Add-on</option>
                      <option value="EARLY_CHECK_IN">Early Check-in</option>
                      <option value="LATE_CHECK_OUT">Late Check-out</option>
                      <option value="EXTRA_BED">Extra Bed</option>
                      <option value="EXTRA_PERSON">Extra Person</option>
                      <option value="LAUNDRY">Laundry</option>
                      <option value="RESTAURANT">Food / Breakfast</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Amount (₹)"
                      value={newChargeAmount}
                      onChange={(e) => setNewChargeAmount(e.target.value)}
                      className="bg-white border border-gray-300 text-xs text-gray-900 font-bold rounded-xl p-2.5 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={submittingAction || !newChargeDesc || !newChargeAmount}
                      onClick={handleAddFolioCharge}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                    >
                      {submittingAction ? "Posting..." : "Post Charge to Ledger"}
                    </button>
                  </div>
                </div>
              )}

              {/* 7. ITEMIZED BILLING LEDGER TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5 font-mono">
                    <FileText size={14} className="text-[#c9a227]" />
                    Itemized Billing Ledger & Statement ({folioDrawer.folio?.charges?.length || 0} items)
                  </h4>
                  <span className="text-[11px] font-mono text-gray-500">
                    SAC Code: 996311 (Hotel Accommodation Services)
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-2xl bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-600 font-mono text-[11px] uppercase border-b border-gray-200">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Particulars / Description</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Debit (Charge ₹)</th>
                        <th className="p-3 text-right">Credit (Paid ₹)</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {(folioDrawer.folio?.charges || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400">
                            No ledger lines found. Click "Edit Bill & Tariff Anytime" above to generate charges.
                          </td>
                        </tr>
                      ) : (
                        (folioDrawer.folio?.charges || []).map((item: any, idx: number) => {
                          const isCredit = item.direction === "CREDIT" || item.lineType === "ADVANCE_ADJUSTMENT" || item.lineType === "PAYMENT" || item.lineType === "DISCOUNT";
                          return (
                            <tr key={item._id || idx} className="hover:bg-gray-50/80 transition">
                              <td className="p-3 text-gray-500 whitespace-nowrap">
                                {new Date(item.date || item.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </td>
                              <td className="p-3 font-sans font-medium text-gray-900">
                                <div className="flex items-center gap-1.5">
                                  <span>{item.description}</span>
                                  {item.lineType === "ROOM_CHARGE" && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">SAC 996311</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-gray-500 text-[10px]">
                                <span className={cn(
                                  "px-2 py-0.5 rounded font-bold",
                                  isCredit ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-gray-100 text-gray-700"
                                )}>
                                  {item.lineType}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold text-gray-900">
                                {!isCredit ? `₹${(item.amount || 0).toLocaleString()}` : "—"}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-700">
                                {isCredit ? `₹${(item.amount || 0).toLocaleString()}` : "—"}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  disabled={submittingAction}
                                  onClick={() => handleDeleteLine(item._id)}
                                  className="text-red-400 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                                  title="Delete line item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 8. FINANCIAL SUMMARY & BOTTOM ACTIONS */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 block uppercase font-sans">Gross Charges</span>
                  <span className="text-sm font-bold text-gray-900">
                    ₹{(folioDrawer.folio?.totalCharges || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 block uppercase font-sans">GST (CGST 2.5% + SGST 2.5%)</span>
                  <span className="text-sm font-bold text-gray-900">
                    ₹{(folioDrawer.folio?.totalTax || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 block uppercase font-sans">Total Bill</span>
                  <span className="text-sm font-black text-gray-900">
                    ₹{((folioDrawer.folio?.totalCharges || 0) + (folioDrawer.folio?.totalTax || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-emerald-700 block uppercase font-sans font-bold">Advance / Paid</span>
                  <span className="text-sm font-black text-emerald-700">
                    - ₹{((folioDrawer.folio?.totalPaid || 0) + (folioDrawer.folio?.totalAdvanceAdjusted || 0)).toLocaleString()}
                  </span>
                </div>
                <div className={cn(
                  "p-3 rounded-xl border shadow-2xs col-span-2 sm:col-span-1",
                  (folioDrawer.folio?.balance || 0) <= 0
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-red-50 border-red-300 text-red-900"
                )}>
                  <span className="text-[10px] block uppercase font-sans font-bold">Net Balance Due</span>
                  <span className="text-base font-black">
                    ₹{(folioDrawer.folio?.balance || 0).toLocaleString()}
                  </span>
                  <span className="text-[9px] font-sans font-black block mt-0.5">
                    {(folioDrawer.folio?.balance || 0) <= 0 ? "PAID IN FULL" : "SETTLEMENT REQUIRED"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    to={`/admin/bookings/${folioDrawer.booking._id}/grc-print`}
                    target="_blank"
                    className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold border border-gray-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer size={14} className="text-[#c9a227]" /> Print GRC Card
                  </Link>
                  <Link
                    to={`/admin/bookings/${folioDrawer.booking._id}/folio-print`}
                    target="_blank"
                    className="flex-1 sm:flex-initial px-5 py-2 bg-[#c9a227] hover:bg-[#b08d20] text-black rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Printer size={14} /> Print GST Tax Invoice
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setFolioDrawer({ open: false, booking: null, folio: null, isGroupFolio: false, allGroupBookings: [] })}
                  className="w-full sm:w-auto px-6 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  Close Folio Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
