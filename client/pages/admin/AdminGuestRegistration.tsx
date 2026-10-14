import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, UserCheck, ShieldCheck, CreditCard,
  Printer, CheckCircle2, BedDouble, Plus, AlertCircle, RefreshCw, ArrowRight,
  FileCheck2, FileText, Calendar, Receipt, MapPin, Mail, Phone, Eye, X, Image as ImageIcon,
  Building2, Briefcase, Clock, Users, User, Car
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";
import { cn } from "@/lib/utils";
import { addDays, todayBusinessDate, toBusinessDate } from "@shared/dates";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Step = "SEARCH" | "ROOM" | "DETAILS" | "CONFIRM" | "DONE";

interface GuestDetails {
  guestFirstName: string;
  guestLastName: string;
  mobile: string;
  email: string;
  address: string;
  nationality: string;
  dateOfBirth: string;
  gender: string;
  organization: string;
  designation: string;
  purposeOfVisit: string;
  gstin: string;
  vehicleNumber: string;
  proceedingTo: string;
  idType: string;
  idNumber: string;
  idProofImages: string[];
}

interface ForeignGuestDetails {
  passportNumber: string;
  passportIssueDate: string;
  passportIssuePlace: string;
  passportExpiryDate: string;
  visaNumber: string;
  visaDate: string;
  visaExpiryDate: string;
  visaIssuePlace: string;
  visaIssuedBy: string;
}

// Number to words helper for invoices
function numberToWords(num: number): string {
  const a = ["", "ONE ", "TWO ", "THREE ", "FOUR ", "FIVE ", "SIX ", "SEVEN ", "EIGHT ", "NINE ", "TEN ", "ELEVEN ", "TWELVE ", "THIRTEEN ", "FOURTEEN ", "FIFTEEN ", "SIXTEEN ", "SEVENTEEN ", "EIGHTEEN ", "NINETEEN "];
  const b = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  
  if ((num = Math.floor(num)) <= 0) return "ZERO RUPEES ONLY";
  const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  
  let str = "";
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "CRORE " : "";
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "LAKH " : "";
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "THOUSAND " : "";
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "HUNDRED " : "";
  str += (Number(n[5]) !== 0) ? ((str !== "") ? "AND " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) : "";
  return str.trim() + " RUPEES ONLY";
}

const STANDARD_ID_TYPES = ["AADHAAR", "PASSPORT", "DRIVING_LICENSE", "VOTER_ID"];
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

export default function AdminGuestRegistration() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("SEARCH");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // STEP 5 IN-PAGE DOCUMENT VIEWER (BOTH, GRC, INVOICE)

  // LIGHTBOX PREVIEW STATE
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // SEARCH STEP
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ guests: any[]; recentBookings: any[] } | null>(null);

  // ROOM SELECTION STEP
  const [roomSearch, setRoomSearch] = useState({
    checkIn: todayBusinessDate(),
    checkOut: addDays(todayBusinessDate(), 1),
    adults: "1",
    children: "0",
    bookingType: "NIGHTLY" as "NIGHTLY" | "HOURLY",
    hours: "4",
  });
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<any[]>([]);

  // GUEST DETAILS STEP
  const [isExistingGuest, setIsExistingGuest] = useState(false);
  const [existingGuestId, setExistingGuestId] = useState("");
  
  const [guestDetails, setGuestDetails] = useState<GuestDetails>({
    guestFirstName: "",
    guestLastName: "",
    mobile: "",
    email: "",
    address: "",
    nationality: "Indian",
    dateOfBirth: "",
    gender: "MALE",
    organization: "",
    designation: "",
    purposeOfVisit: "",
    gstin: "",
    vehicleNumber: "",
    proceedingTo: "",
    idType: "AADHAAR",
    idNumber: "",
    idProofImages: [],
  });

  const [isForeignGuest, setIsForeignGuest] = useState(false);
  const [foreignDetails, setForeignDetails] = useState<ForeignGuestDetails>({
    passportNumber: "",
    passportIssueDate: "",
    passportIssuePlace: "",
    passportExpiryDate: "",
    visaNumber: "",
    visaDate: "",
    visaExpiryDate: "",
    visaIssuePlace: "",
    visaIssuedBy: "",
  });

  const [stayDetails, setStayDetails] = useState({
    arrivalTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    departureTime: "11:00",
    mealPlan: "EP",
    extraPersonsNoBed: 0,
    extraPersonsWithBed: 0,
    extraChildrenNoBed: 0,
    extraChildrenWithBed: 0,
    kidsUnder3: 0,
    otherCharges: 0,
    otherChargesDesc: "",
    rateOverrideAmount: "",
  });

  // Tariff per room (₹/night), keyed by room id; blank = the room's default rate.
  const [roomRates, setRoomRates] = useState<Record<string, string>>({});
  // ₹ per person per night for each extra type; prefilled from Property Settings, editable per booking.
  const [extraRates, setExtraRates] = useState({ extraPersonRate: "", extraBedRate: "", childRateNoBed: "", childRateWithBed: "" });
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((j) => {
        const st = j?.data ?? {};
        setExtraRates((prev) => ({
          extraPersonRate: prev.extraPersonRate || String(st.extraPersonRate ?? 800),
          extraBedRate: prev.extraBedRate || String(st.extraBedRate ?? 1200),
          childRateNoBed: prev.childRateNoBed || String(st.childRateNoBed ?? 400),
          childRateWithBed: prev.childRateWithBed || String(st.childRateWithBed ?? 600),
        }));
      })
      .catch(() => undefined);
  }, []);
  const defaultRoomRate = (r: any) => r?.ratePerNight || r?.category?.basePrice || 0;
  const roomRatesPayload = (rooms: any[]) =>
    Object.fromEntries(rooms.map((r) => [r._id, roomRates[r._id] !== undefined && roomRates[r._id] !== "" ? Number(roomRates[r._id]) : defaultRoomRate(r)]));
  const extraRatesPayload = () => ({
    extraPersonRate: Number(extraRates.extraPersonRate || 0),
    extraBedRate: Number(extraRates.extraBedRate || 0),
    childRateNoBed: Number(extraRates.childRateNoBed || 0),
    childRateWithBed: Number(extraRates.childRateWithBed || 0),
  });

  const [billingDetails, setBillingDetails] = useState({
    billingInstruction: "CASH",
    advanceAmount: "",
    advanceMethod: "CASH",
    advanceReference: "",
  });

  // CONFIRMATION STEP (Calculated by server)
  const [rateBreakdown, setRateBreakdown] = useState<any>(null);

  // DONE STEP
  const [registeredBooking, setRegisteredBooking] = useState<any>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS — API CALLS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGuestDetails(prev => ({
          ...prev,
          idProofImages: [...prev.idProofImages, reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setGuestDetails(prev => ({
      ...prev,
      idProofImages: prev.idProofImages.filter((_, i) => i !== index)
    }));
  };

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/front-desk/registration/guest-search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data);
      } else {
        toast({ title: "Search failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selectExistingGuest = (guest: any) => {
    setIsExistingGuest(true);
    setExistingGuestId(guest._id);
    setGuestDetails({
      ...guestDetails,
      guestFirstName: guest.fullName?.split(" ")[0] || "",
      guestLastName: guest.fullName?.split(" ").slice(1).join(" ") || "",
      mobile: guest.phone || "",
      email: guest.email || "",
      nationality: guest.nationality || "Indian",
      idType: guest.idType || "AADHAAR",
      idNumber: guest.idNumber || "",
      address: guest.address || "",
    });
    setStep("ROOM");
  };

  const selectExistingBooking = (booking: any) => {
    setIsExistingGuest(true);
    setExistingGuestId(booking.guest || "");
    setGuestDetails({
      ...guestDetails,
      guestFirstName: booking.guestDetails?.firstName || "",
      guestLastName: booking.guestDetails?.lastName || "",
      mobile: booking.guestDetails?.phone || booking.guestDetails?.phoneNumber || "",
      email: booking.guestDetails?.email || "",
      nationality: booking.guestDetails?.nationality || "Indian",
      idType: booking.guestDetails?.idType || "AADHAAR",
      idNumber: booking.guestDetails?.idNumber || "",
      address: booking.guestDetails?.address || "",
    });
    setRoomSearch({
      ...roomSearch,
      checkIn: toBusinessDate(booking.checkInDate),
      checkOut: toBusinessDate(booking.checkOutDate),
      adults: String(booking.adults || 1),
      children: String(booking.children || 0),
    });
    if (booking.assignedRoom) {
      setSelectedRoom(booking.assignedRoom);
      const defaultTariff = booking.ratePerNight || booking.assignedRoom?.ratePerNight || booking.assignedRoom?.category?.basePrice || 0;
      if (defaultTariff) {
        setStayDetails((prev) => ({ ...prev, rateOverrideAmount: String(defaultTariff) }));
      }
    }
    setStep(booking.assignedRoom ? "DETAILS" : "ROOM");
  };

  const skipToWalkIn = () => {
    setIsExistingGuest(false);
    setExistingGuestId("");
    setGuestDetails({
      guestFirstName: "", guestLastName: "", mobile: "", email: "", address: "", nationality: "Indian",
      dateOfBirth: "", gender: "MALE", organization: "", designation: "", purposeOfVisit: "", gstin: "", vehicleNumber: "", proceedingTo: "", idType: "AADHAAR", idNumber: "", idProofImages: [],
    });
    setStep("ROOM");
  };

  const searchRooms = async () => {
    setLoading(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/front-desk/registration/available-rooms?checkIn=${roomSearch.checkIn}&checkOut=${roomSearch.checkOut}&adults=${roomSearch.adults}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (json.success) {
        setAvailableRooms(json.data);
      } else {
        toast({ title: "Room search failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoom = (room: any) => {
    setSelectedRoom(room);
    setSelectedRooms([room]);
    const defaultTariff = room.ratePerNight || room.category?.basePrice || 0;
    setStayDetails((prev) => ({
      ...prev,
      rateOverrideAmount: defaultTariff ? String(defaultTariff) : prev.rateOverrideAmount,
    }));
    setStep("DETAILS");
  };

  const toggleSelectRoom = (room: any) => {
    setSelectedRooms(prev => {
      const exists = prev.some(r => r._id === room._id);
      if (exists) {
        const next = prev.filter(r => r._id !== room._id);
        setSelectedRoom(next.length > 0 ? next[0] : null);
        return next;
      } else {
        const next = [...prev, room];
        if (!selectedRoom) setSelectedRoom(room);
        const defaultTariff = room.ratePerNight || room.category?.basePrice || 0;
        setStayDetails((s) => ({
          ...s,
          rateOverrideAmount: defaultTariff && !s.rateOverrideAmount ? String(defaultTariff) : s.rateOverrideAmount,
        }));
        return next;
      }
    });
  };

  const calculateRates = async () => {
    const roomsToBook = selectedRooms.length > 0 ? selectedRooms : (selectedRoom ? [selectedRoom] : []);
    if (roomsToBook.length === 0) {
      toast({ title: "No room selected", description: "Please select at least one room.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/front-desk/registration/calculate-rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          roomId: roomsToBook[0]._id,
          roomIds: roomsToBook.map(r => r._id),
          checkIn: roomSearch.checkIn,
          checkOut: roomSearch.checkOut,
          mealPlan: stayDetails.mealPlan,
          adults: Number(roomSearch.adults),
          children: Number(roomSearch.children),
          bookingType: roomSearch.bookingType,
          hours: Number(roomSearch.hours),
          extraPersonsNoBed: stayDetails.extraPersonsNoBed,
          extraPersonsWithBed: stayDetails.extraPersonsWithBed,
          extraChildrenNoBed: stayDetails.extraChildrenNoBed,
          extraChildrenWithBed: stayDetails.extraChildrenWithBed,
          kidsUnder3: stayDetails.kidsUnder3,
          otherCharges: stayDetails.otherCharges,
          discountAmount: 0,
          roomRates: roomRatesPayload(roomsToBook),
          extraRates: extraRatesPayload(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRateBreakdown(json.data);
        if (roomSearch.bookingType === "HOURLY" && (!billingDetails.advanceAmount || Number(billingDetails.advanceAmount) === 0)) {
          setBillingDetails(prev => ({ ...prev, advanceAmount: String(json.data.totalAmount) }));
        }
        setStep("CONFIRM");
      } else {
        toast({ title: "Calculation failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRegistration = async () => {
    const roomsToBook = selectedRooms.length > 0 ? selectedRooms : (selectedRoom ? [selectedRoom] : []);
    if (roomsToBook.length === 0 || !rateBreakdown) return;
    setSubmitting(true);
    try {
      const token = getStoredAuthToken();
      const payload = {
        isExistingGuest,
        existingGuestId,
        ...guestDetails,
        isForeignGuest,
        foreignGuestDetails: isForeignGuest ? foreignDetails : undefined,
        checkIn: roomSearch.checkIn,
        checkOut: roomSearch.checkOut,
        adults: Number(roomSearch.adults),
        children: Number(roomSearch.children),
        bookingType: roomSearch.bookingType,
        hours: Number(roomSearch.hours),
        ...stayDetails,
        rateOverrideAmount: undefined,
        roomRates: roomRatesPayload(roomsToBook),
        extraRates: extraRatesPayload(),
        roomId: roomsToBook[0]._id,
        roomIds: roomsToBook.map(r => r._id),
        ...billingDetails,
      };

      const res = await fetch(`/api/front-desk/registration/walk-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Registration Successful", description: `${roomsToBook.length} room(s) booked successfully. Ready for Check-in.` });
        setRegisteredBooking(json.data.booking);
        setStep("DONE");
      } else {
        toast({ title: "Registration Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!registeredBooking) return;
    setSubmitting(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/front-desk/registration/${registeredBooking._id}/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ applyAdvanceNow: false }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Check-in Complete", description: "Guest has been checked into the room." });
        navigate("/admin/front-desk");
      } else {
        toast({ title: "Check-in Failed", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // GRC / invoice open in a pop-up on this page (an embedded print page), not a new tab.
  const [docModal, setDocModal] = useState<"grc" | "invoice" | null>(null);
  const docFrameRef = useRef<HTMLIFrameElement>(null);
  const handlePrint = () => { if (registeredBooking) setDocModal("grc"); };
  const handlePrintInvoice = () => { if (registeredBooking) setDocModal("invoice"); };
  const printDocModal = () => docFrameRef.current?.contentWindow?.print();

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (guestDetails.nationality.toLowerCase() !== "indian" && guestDetails.nationality !== "") {
      setIsForeignGuest(true);
    } else {
      setIsForeignGuest(false);
    }
  }, [guestDetails.nationality]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/admin/front-desk")} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold font-serif flex items-center gap-2">
                <UserCheck size={24} className="text-[#c9a227]" />
                Guest Registration Wizard
              </h1>
              <div className="text-xs text-gray-500 font-mono mt-0.5 tracking-wider">
                {step === "SEARCH" && "STEP 1: GUEST IDENTIFICATION"}
                {step === "ROOM" && "STEP 2: ROOM SELECTION"}
                {step === "DETAILS" && "STEP 3: REGISTRATION CARD"}
                {step === "CONFIRM" && "STEP 4: SUMMARY & CONFIRMATION"}
                {step === "DONE" && "COMPLETED"}
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {["SEARCH", "ROOM", "DETAILS", "CONFIRM", "DONE"].map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
                  step === s ? "border-[#c9a227] bg-[#c9a227] text-white" :
                  ["SEARCH", "ROOM", "DETAILS", "CONFIRM", "DONE"].indexOf(step) > i ? "border-[#c9a227] text-[#c9a227]" : "border-gray-200 text-gray-400"
                )}>
                  {i + 1}
                </div>
                {i < 4 && <div className={cn("w-6 h-0.5", ["SEARCH", "ROOM", "DETAILS", "CONFIRM", "DONE"].indexOf(step) > i ? "bg-[#c9a227]" : "bg-gray-200")} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 mt-4">
        {/* =========================================================================
            STEP 1: SEARCH
            ========================================================================= */}
        {step === "SEARCH" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-10 text-center animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-serif mb-2">Who is arriving?</h2>
            <p className="text-gray-500 mb-8">Search for an existing guest or booking, or start a fresh walk-in registration.</p>
            
            <div className="max-w-md mx-auto mb-10">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Phone, email, name, or Booking/OTA ID..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c9a227]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-[#262930] text-[#e5c76b] px-6 rounded-xl hover:bg-black transition flex items-center gap-2"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
            </div>

            {searchResults && (
              <div className="text-left space-y-6 mb-8">
                {searchResults.recentBookings.length > 0 && (
                  <div>
                    <h3 className="font-bold text-sm uppercase text-gray-400 tracking-wider mb-3">Expected Arrivals</h3>
                    <div className="grid gap-3">
                      {searchResults.recentBookings.map((b, i) => (
                        <div key={i} onClick={() => selectExistingBooking(b)} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50 hover:border-[#c9a227] transition cursor-pointer group">
                          <div>
                            <div className="font-bold group-hover:text-[#c9a227] transition">{b.guestDetails.firstName} {b.guestDetails.lastName}</div>
                            <div className="text-xs text-gray-500">Ref: {b.bookingReference} &bull; Check-in: {new Date(b.checkInDate).toLocaleDateString()}</div>
                          </div>
                          <ArrowRight size={18} className="text-gray-300 group-hover:text-[#c9a227]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {searchResults.guests.length > 0 && (
                  <div>
                    <h3 className="font-bold text-sm uppercase text-gray-400 tracking-wider mb-3">CRM Matches</h3>
                    <div className="grid gap-3">
                      {searchResults.guests.map((g, i) => (
                        <div key={i} onClick={() => selectExistingGuest(g)} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-white hover:border-[#c9a227] hover:shadow-md transition cursor-pointer group">
                          <div>
                            <div className="font-bold group-hover:text-[#c9a227] transition flex items-center gap-2">
                              {g.fullName}
                              {g.isVip && <span className="text-[10px] bg-black text-[#e5c76b] px-2 py-0.5 rounded uppercase font-bold">VIP</span>}
                            </div>
                            <div className="text-xs text-gray-500">{g.phone} &bull; {g.email}</div>
                          </div>
                          <ArrowRight size={18} className="text-gray-300 group-hover:text-[#c9a227]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.guests.length === 0 && searchResults.recentBookings.length === 0 && (
                  <div className="text-center text-gray-500 py-6">No matches found in the CRM.</div>
                )}
              </div>
            )}

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center"><span className="bg-white px-4 text-xs text-gray-400 font-bold uppercase tracking-widest">Or</span></div>
            </div>

            <button
              onClick={skipToWalkIn}
              className="mt-4 flex items-center justify-center gap-3 w-full max-w-lg mx-auto py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition transform active:scale-[0.98] font-bold text-base tracking-wide"
            >
              <Plus size={22} className="stroke-[3]" />
              Start New Walk-In Registration
            </button>
          </div>
        )}

        {/* =========================================================================
            STEP 2: ROOM SELECTION
            ========================================================================= */}
        {step === "ROOM" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                  <BedDouble className="text-[#c9a227]" /> Stay Dates & Requirements
                </h2>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setRoomSearch({...roomSearch, bookingType: "NIGHTLY"})} className={cn("px-4 py-1.5 text-sm font-bold rounded-md transition", roomSearch.bookingType === "NIGHTLY" ? "bg-white shadow-sm text-[#c9a227]" : "text-gray-500")}>Nightly</button>
                  <button onClick={() => setRoomSearch({...roomSearch, bookingType: "HOURLY"})} className={cn("px-4 py-1.5 text-sm font-bold rounded-md transition", roomSearch.bookingType === "HOURLY" ? "bg-white shadow-sm text-[#c9a227]" : "text-gray-500")}>Hourly / Day Use</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Check-in</label>
                  <input type="date" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    value={roomSearch.checkIn} onChange={e => setRoomSearch({...roomSearch, checkIn: e.target.value})} />
                </div>
                {roomSearch.bookingType === "NIGHTLY" ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Check-out</label>
                    <input type="date" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      value={roomSearch.checkOut} onChange={e => setRoomSearch({...roomSearch, checkOut: e.target.value})} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Hours</label>
                    <input type="number" min="1" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      value={roomSearch.hours} onChange={e => setRoomSearch({...roomSearch, hours: e.target.value})} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Adults</label>
                  <input type="number" min="1" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    value={roomSearch.adults} onChange={e => setRoomSearch({...roomSearch, adults: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Children</label>
                  <input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    value={roomSearch.children} onChange={e => setRoomSearch({...roomSearch, children: e.target.value})} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={searchRooms} disabled={loading} className="bg-[#262930] text-[#e5c76b] px-6 py-2.5 rounded-xl hover:bg-black transition font-bold flex items-center gap-2">
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} Find Available Rooms
                </button>
              </div>
            </div>

            {availableRooms.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-50/60 border border-amber-200 p-4 rounded-xl">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">
                      Ready for Assignment ({availableRooms.length})
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Select one or multiple rooms to book simultaneously.
                      {selectedRooms.length > 0 && (
                        <span className="font-bold text-[#c9a227] ml-1">
                          ({selectedRooms.length} room{selectedRooms.length > 1 ? "s" : ""} selected: {selectedRooms.map(r => r.roomNumber).join(", ")})
                        </span>
                      )}
                    </p>
                  </div>
                  {selectedRooms.length > 0 && (
                    <button
                      onClick={() => {
                        const targetRoom = selectedRooms[0] || selectedRoom;
                        const defaultTariff = targetRoom?.ratePerNight || targetRoom?.category?.basePrice || 0;
                        setStayDetails(prev => ({
                          ...prev,
                          rateOverrideAmount: prev.rateOverrideAmount || (defaultTariff ? String(defaultTariff) : ""),
                        }));
                        setStep("DETAILS");
                      }}
                      className="px-5 py-2.5 bg-[#c9a227] hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 whitespace-nowrap"
                    >
                      Proceed with {selectedRooms.length} Room{selectedRooms.length > 1 ? "s" : ""} <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                {availableRooms.map(room => {
                  const isSelected = selectedRooms.some(r => r._id === room._id);
                  return (
                    <div
                      key={room._id}
                      onClick={() => toggleSelectRoom(room)}
                      className={cn(
                        "bg-white rounded-2xl shadow-sm border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition",
                        isSelected
                          ? "border-[#c9a227] bg-[#fdfaf2] ring-2 ring-[#c9a227]/40"
                          : "border-gray-200 hover:border-[#c9a227]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="w-5 h-5 rounded text-[#c9a227] accent-[#c9a227] cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-2xl font-bold font-serif">{room.roomNumber}</span>
                            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {room.housekeepingLabel}
                            </span>
                            {isSelected && (
                              <span className="text-xs bg-[#c9a227] text-white font-bold px-2 py-0.5 rounded-md">
                                SELECTED
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{room.category?.name} &bull; Floor {room.floor_number}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Rack Rate</div>
                          <div className="font-bold text-lg text-[#c9a227]">₹{room.ratePerNight?.toLocaleString()}</div>
                        </div>
                        <button
                          onClick={() => handleSelectRoom(room)}
                          className={cn(
                            "px-5 py-2.5 rounded-xl font-bold transition border text-xs flex items-center gap-1.5",
                            isSelected
                              ? "bg-[#c9a227] text-white border-[#c9a227]"
                              : "bg-[#c9a227]/10 text-[#c9a227] hover:bg-[#c9a227] hover:text-white border-[#c9a227]"
                          )}
                        >
                          {isSelected ? (
                            <>Proceed <ArrowRight size={14} /></>
                          ) : (
                            "Select Only This"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 3: REGISTRATION CARD DETAILS
            ========================================================================= */}
        {step === "DETAILS" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
            
            {/* SECTION B: Guest Identity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="font-serif font-bold text-lg text-gray-800">Section B — Guest Identity</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">First Name *</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.guestFirstName} onChange={e => setGuestDetails({...guestDetails, guestFirstName: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Last Name</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.guestLastName} onChange={e => setGuestDetails({...guestDetails, guestLastName: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Mobile *</label><input type="tel" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.mobile} onChange={e => setGuestDetails({...guestDetails, mobile: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Email *</label><input type="email" required className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.email} onChange={e => setGuestDetails({...guestDetails, email: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Gender</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.gender} onChange={e => setGuestDetails({...guestDetails, gender: e.target.value})}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Date of Birth</label><input type="date" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.dateOfBirth} onChange={e => setGuestDetails({...guestDetails, dateOfBirth: e.target.value})} /></div>
                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">Full Address</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.address} onChange={e => setGuestDetails({...guestDetails, address: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Organization</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.organization} onChange={e => setGuestDetails({...guestDetails, organization: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">GSTIN (Optional)</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.gstin} onChange={e => setGuestDetails({...guestDetails, gstin: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Purpose of Visit</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.purposeOfVisit} onChange={e => setGuestDetails({...guestDetails, purposeOfVisit: e.target.value})}><option value="">Select</option><option value="BUSINESS">Business</option><option value="LEISURE">Leisure / Tourist</option><option value="OFFICIAL">Official</option><option value="MEDICAL">Medical</option></select></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Vehicle Reg. No</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase" value={guestDetails.vehicleNumber} onChange={e => setGuestDetails({...guestDetails, vehicleNumber: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Proceeding To</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.proceedingTo} onChange={e => setGuestDetails({...guestDetails, proceedingTo: e.target.value})} /></div>
              </div>
            </div>

            {/* SECTION C: Identification */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-serif font-bold text-lg text-gray-800">Section C — Identification</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Nationality</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.nationality} onChange={e => setGuestDetails({...guestDetails, nationality: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">ID Type *</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={STANDARD_ID_TYPES.includes(guestDetails.idType) ? guestDetails.idType : "OTHER"} onChange={e => setGuestDetails({...guestDetails, idType: e.target.value === "OTHER" ? "" : e.target.value})}><option value="AADHAAR">Aadhaar</option><option value="PASSPORT">Passport</option><option value="DRIVING_LICENSE">Driving License</option><option value="VOTER_ID">Voter ID</option><option value="OTHER">Other</option></select>
                    {!STANDARD_ID_TYPES.includes(guestDetails.idType) && (
                      <input type="text" required placeholder="Which ID? (e.g. PAN Card)" className="mt-2 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.idType} onChange={e => setGuestDetails({...guestDetails, idType: e.target.value.toUpperCase()})} />
                    )}</div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">ID Number *</label><input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono uppercase" value={guestDetails.idNumber} onChange={e => setGuestDetails({...guestDetails, idNumber: e.target.value})} /></div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 mb-2">Upload ID Document (Front & Back)</label>
                  <input type="file" multiple accept="image/*,application/pdf" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#c9a227]/10 file:text-[#c9a227] hover:file:bg-[#c9a227]/20 cursor-pointer" onChange={handleFileUpload} />
                  
                  {guestDetails.idProofImages.length > 0 && (
                    <div className="flex gap-4 mt-4 overflow-x-auto pb-2">
                      {guestDetails.idProofImages.map((src, idx) => (
                        <div key={idx} className="relative w-24 h-24 flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden group">
                          {src.startsWith('data:image') ? (
                            <img src={src} alt="ID Proof" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 text-center p-1 break-all">Document</div>
                          )}
                          <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs font-bold shadow-sm">&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isForeignGuest && (
                  <div className="border border-orange-200 bg-orange-50/30 rounded-xl p-5 mt-4">
                    <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2"><ShieldCheck size={16} /> Form C / Foreign Guest Passport Data Required</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Passport No.</label><input type="text" className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm" value={foreignDetails.passportNumber} onChange={e => setForeignDetails({...foreignDetails, passportNumber: e.target.value})} /></div>
                      <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Issue Date</label><input type="date" className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm" value={foreignDetails.passportIssueDate} onChange={e => setForeignDetails({...foreignDetails, passportIssueDate: e.target.value})} /></div>
                      <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Expiry Date</label><input type="date" className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm" value={foreignDetails.passportExpiryDate} onChange={e => setForeignDetails({...foreignDetails, passportExpiryDate: e.target.value})} /></div>
                      <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Visa No.</label><input type="text" className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm" value={foreignDetails.visaNumber} onChange={e => setForeignDetails({...foreignDetails, visaNumber: e.target.value})} /></div>
                      <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Visa Issued By</label><input type="text" placeholder="Indian Embassy" className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm" value={foreignDetails.visaIssuedBy} onChange={e => setForeignDetails({...foreignDetails, visaIssuedBy: e.target.value})} /></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION D: Stay & Rate */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-serif font-bold text-lg text-gray-800">Section D — Stay & Tariffs</h3>
                <span className="text-xs font-mono bg-black text-[#e5c76b] px-2 py-0.5 rounded">ROOM {selectedRoom?.roomNumber}</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-5">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Arrival Time</label><input type="time" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.arrivalTime} onChange={e => setStayDetails({...stayDetails, arrivalTime: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Departure Time</label><input type="time" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.departureTime} onChange={e => setStayDetails({...stayDetails, departureTime: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Meal Plan</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.mealPlan} onChange={e => setStayDetails({...stayDetails, mealPlan: e.target.value})}><option value="EP">EP (Room Only)</option><option value="CP">CP (Breakfast)</option><option value="MAP">MAP (Half Board)</option><option value="AP">AP (Full Board)</option></select></div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-[#c9a227] mb-1">Room Tariff (₹/Night)</label>
                  <div className="space-y-2">
                    {(selectedRooms.length > 0 ? selectedRooms : selectedRoom ? [selectedRoom] : []).map((r: any) => (
                      <div key={r._id} className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold bg-black text-[#e5c76b] px-1.5 py-0.5 rounded shrink-0">{r.roomNumber}</span>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Tariff for room ${r.roomNumber}`}
                          className="w-full px-3 py-2 bg-[#fdfaf2] border border-[#e5c76b] rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#c9a227] outline-none"
                          value={roomRates[r._id] ?? String(defaultRoomRate(r) || "")}
                          onChange={(e) => setRoomRates({ ...roomRates, [r._id]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Each room starts at its category tariff. Type any amount to change it.</p>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Kids &lt; 3 (Free)</label><input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.kidsUnder3} onChange={e => setStayDetails({...stayDetails, kidsUnder3: parseInt(e.target.value)||0})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Adult Extra Pax (No Bed)</label><div className="flex gap-2"><input type="number" min="0" aria-label="Adult Extra Pax (No Bed) count" title="Persons" className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraPersonsNoBed} onChange={e => setStayDetails({...stayDetails, extraPersonsNoBed: parseInt(e.target.value)||0})} /><div className="relative flex-1"><span className="absolute left-2 top-2 text-xs text-gray-400">₹</span><input type="number" min="0" aria-label="Adult Extra Pax (No Bed) rate per person per night" className="w-full pl-5 pr-2 py-2 bg-[#fdfaf2] border border-[#e5c76b] rounded-lg text-sm" value={extraRates.extraPersonRate} onChange={e => setExtraRates({...extraRates, extraPersonRate: e.target.value})} /></div></div><p className="text-[10px] text-gray-500 mt-0.5">persons · ₹ per person / night</p></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Adult Extra Pax (With Bed)</label><div className="flex gap-2"><input type="number" min="0" aria-label="Adult Extra Pax (With Bed) count" title="Persons" className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraPersonsWithBed} onChange={e => setStayDetails({...stayDetails, extraPersonsWithBed: parseInt(e.target.value)||0})} /><div className="relative flex-1"><span className="absolute left-2 top-2 text-xs text-gray-400">₹</span><input type="number" min="0" aria-label="Adult Extra Pax (With Bed) rate per person per night" className="w-full pl-5 pr-2 py-2 bg-[#fdfaf2] border border-[#e5c76b] rounded-lg text-sm" value={extraRates.extraBedRate} onChange={e => setExtraRates({...extraRates, extraBedRate: e.target.value})} /></div></div><p className="text-[10px] text-gray-500 mt-0.5">persons · ₹ per person / night</p></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Child 3-12 (No Bed)</label><div className="flex gap-2"><input type="number" min="0" aria-label="Child 3-12 (No Bed) count" title="Persons" className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraChildrenNoBed} onChange={e => setStayDetails({...stayDetails, extraChildrenNoBed: parseInt(e.target.value)||0})} /><div className="relative flex-1"><span className="absolute left-2 top-2 text-xs text-gray-400">₹</span><input type="number" min="0" aria-label="Child 3-12 (No Bed) rate per person per night" className="w-full pl-5 pr-2 py-2 bg-[#fdfaf2] border border-[#e5c76b] rounded-lg text-sm" value={extraRates.childRateNoBed} onChange={e => setExtraRates({...extraRates, childRateNoBed: e.target.value})} /></div></div><p className="text-[10px] text-gray-500 mt-0.5">persons · ₹ per person / night</p></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Child 3-12 (With Bed)</label><div className="flex gap-2"><input type="number" min="0" aria-label="Child 3-12 (With Bed) count" title="Persons" className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraChildrenWithBed} onChange={e => setStayDetails({...stayDetails, extraChildrenWithBed: parseInt(e.target.value)||0})} /><div className="relative flex-1"><span className="absolute left-2 top-2 text-xs text-gray-400">₹</span><input type="number" min="0" aria-label="Child 3-12 (With Bed) rate per person per night" className="w-full pl-5 pr-2 py-2 bg-[#fdfaf2] border border-[#e5c76b] rounded-lg text-sm" value={extraRates.childRateWithBed} onChange={e => setExtraRates({...extraRates, childRateWithBed: e.target.value})} /></div></div><p className="text-[10px] text-gray-500 mt-0.5">persons · ₹ per person / night</p></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Other Charges (₹)</label><input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.otherCharges} onChange={e => setStayDetails({...stayDetails, otherCharges: parseInt(e.target.value)||0})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Other Charges Desc</label><input type="text" placeholder="e.g. Early Check-in" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.otherChargesDesc} onChange={e => setStayDetails({...stayDetails, otherChargesDesc: e.target.value})} /></div>
              </div>
            </div>

            {/* SECTION E & F: Billing & Advance */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="font-serif font-bold text-lg text-gray-800">Section E & F — Billing & Advance</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Billing Instruction</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={billingDetails.billingInstruction} onChange={e => setBillingDetails({...billingDetails, billingInstruction: e.target.value})}><option value="CASH">Direct Settlement (Guest)</option><option value="COMPANY">Bill to Company (BTC)</option><option value="OTA">OTA Prepaid (VCC)</option></select></div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Advance Received (₹)</label>
                  <input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#c9a227]" placeholder="0" value={billingDetails.advanceAmount} onChange={e => setBillingDetails({...billingDetails, advanceAmount: e.target.value})} />
                  {roomSearch.bookingType === "HOURLY" && <p className="text-[10px] text-[#c9a227] mt-1 font-bold">Auto-fills full amount if left at 0.</p>}
                </div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Payment Method</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={billingDetails.advanceMethod} onChange={e => setBillingDetails({...billingDetails, advanceMethod: e.target.value})}><option value="CASH">Cash</option><option value="CARD">Credit/Debit Card</option><option value="UPI">UPI</option></select></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setStep("ROOM")} className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-bold">Back</button>
              <button onClick={calculateRates} disabled={submitting || !guestDetails.guestFirstName || !guestDetails.mobile || !isValidEmail(guestDetails.email) || !guestDetails.idType.trim() || !guestDetails.idNumber} className="bg-[#c9a227] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-black transition flex items-center gap-2">
                {submitting ? <RefreshCw size={16} className="animate-spin" /> : "Calculate Rates & Proceed"}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 4: CONFIRMATION & DAY-BY-DAY CHARGES BREAKDOWN
            ========================================================================= */}
        {step === "CONFIRM" && rateBreakdown && (() => {
          const checkInDate = new Date(roomSearch.checkIn);
          const nights = Math.max(1, rateBreakdown.nights || 1);
          const dailyTariff = Math.round(rateBreakdown.roomCharges / nights);
          const dailyExtraBed = Math.round((rateBreakdown.extraBedTotal || 0) / nights);
          const dailyTaxable = dailyTariff + dailyExtraBed;
          // Per-night GST comes from the server quote (taxService), never a client-side rate.
          const nightTax = (i: number) => rateBreakdown.dailyTax?.[i] ?? { cgst: 0, sgst: 0 };

          const advanceAmountNum = Number(billingDetails.advanceAmount) || 0;
          const netPayable = Math.max(0, rateBreakdown.totalAmount - advanceAmountNum);

          const daysSchedule = [];
          for (let i = 0; i < nights; i++) {
            const d = new Date(checkInDate);
            d.setDate(d.getDate() + i);
            daysSchedule.push({
              night: i + 1,
              dateStr: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
              tariff: dailyTariff,
              extraBed: dailyExtraBed,
              taxable: dailyTaxable,
              cgst: nightTax(i).cgst,
              sgst: nightTax(i).sgst,
              total: dailyTaxable + nightTax(i).cgst + nightTax(i).sgst,
            });
          }

          return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                {/* Header banner */}
                <div className="bg-[#1f2937] text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start text-[#c9a227] font-bold text-xs uppercase tracking-widest mb-1">
                      <Receipt size={16} /> Guest Registration Summary
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-serif font-black">Day-by-Day Stay &amp; Tax Invoice</h2>
                    <p className="text-gray-400 text-xs mt-1">Review the itemized schedule and payment breakdown before generating the official bill.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep("DETAILS")}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-bold transition text-gray-200"
                    >
                      Edit Details
                    </button>
                  </div>
                </div>

                {/* 2-COLUMN MAIN CONTENT (SIDE SUMMARY PANEL AS REQUESTED) */}
                <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* LEFT: GUEST INFO & DAY-BY-DAY TABLE (8 COLS) */}
                  <div className="lg:col-span-8 space-y-6">
                    
                    {/* 1. COMPREHENSIVE GUEST INFORMATION & DEMOGRAPHICS */}
                    <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                      {/* Top Header Row with Name, ID Badge, Contacts */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#c9a227]/15 border border-[#c9a227]/30 flex items-center justify-center text-[#c9a227] font-black text-xl font-serif shadow-sm">
                            {guestDetails.guestFirstName ? guestDetails.guestFirstName[0].toUpperCase() : "G"}
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <User size={12} className="text-[#c9a227]" />
                              Primary Guest Information
                            </div>
                            <h3 className="text-lg font-black text-gray-900 leading-tight">
                              {guestDetails.guestFirstName} {guestDetails.guestLastName || ""}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-0.5">
                              <span className="flex items-center gap-1 font-mono font-medium">
                                <Phone size={12} className="text-gray-400" />
                                {guestDetails.mobile || "—"}
                              </span>
                              {guestDetails.email && (
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Mail size={12} className="text-gray-400" />
                                  {guestDetails.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ID Document Badge */}
                        <div className="flex flex-col sm:items-end">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Verified ID Document</span>
                          <span className="inline-flex items-center gap-1.5 bg-white border-2 border-gray-300 px-3 py-1 rounded-lg font-mono font-black text-xs text-gray-800 shadow-sm mt-0.5">
                            <ShieldCheck size={14} className="text-green-600" />
                            {guestDetails.idType}: {guestDetails.idNumber || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Address Row */}
                      {guestDetails.address && (
                        <div className="flex items-start gap-2 text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-200">
                          <MapPin size={14} className="text-[#c9a227] flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-gray-400 text-[10px] uppercase block">Residential / Billing Address</span>
                            <span>{guestDetails.address}</span>
                          </div>
                        </div>
                      )}

                      {/* Demographics & Travel Data Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Nationality</span>
                          <span className="font-semibold text-gray-800">{guestDetails.nationality || "Indian"}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Gender & DOB</span>
                          <span className="font-semibold text-gray-800">
                            {guestDetails.gender || "—"}{guestDetails.dateOfBirth ? ` • ${new Date(guestDetails.dateOfBirth).toLocaleDateString("en-IN")}` : ""}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Purpose of Visit</span>
                          <span className="font-semibold text-gray-800">{guestDetails.purposeOfVisit || "Personal / Leisure"}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Proceeding To</span>
                          <span className="font-semibold text-gray-800">{guestDetails.proceedingTo || "—"}</span>
                        </div>

                        {guestDetails.organization && (
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase block flex items-center gap-1">
                              <Building2 size={10} /> Organization
                            </span>
                            <span className="font-semibold text-gray-800">
                              {guestDetails.organization} {guestDetails.designation ? `(${guestDetails.designation})` : ""}
                            </span>
                          </div>
                        )}

                        {guestDetails.vehicleNumber && (
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase block flex items-center gap-1">
                              <Car size={10} /> Vehicle No
                            </span>
                            <span className="font-mono font-bold text-gray-800">{guestDetails.vehicleNumber}</span>
                          </div>
                        )}

                        {guestDetails.gstin && (
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Company GSTIN</span>
                            <span className="font-mono font-bold text-gray-800">{guestDetails.gstin}</span>
                          </div>
                        )}
                      </div>

                      {/* Foreign Guest Details (if applicable) */}
                      {isForeignGuest && foreignDetails.passportNumber && (
                        <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 text-xs">
                          <span className="text-[10px] font-bold text-amber-800 uppercase block mb-1">
                            Foreign National Passport & Visa Registration (Form-C)
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-amber-900 font-mono">
                            <div><strong>Passport:</strong> {foreignDetails.passportNumber}</div>
                            <div><strong>Exp:</strong> {foreignDetails.passportExpiryDate || "—"}</div>
                            <div><strong>Visa:</strong> {foreignDetails.visaNumber || "—"}</div>
                            <div><strong>Visa Exp:</strong> {foreignDetails.visaExpiryDate || "—"}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. COLLECTED ID PROOFS & KYC IMAGES GALLERY */}
                    <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon size={16} className="text-[#c9a227]" />
                          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                            Collected ID Proof Documents & Photos ({guestDetails.idProofImages?.length || 0})
                          </h4>
                        </div>
                        {guestDetails.idProofImages && guestDetails.idProofImages.length > 0 && (
                          <span className="text-[10px] text-gray-500 font-medium">Click any document to inspect full preview</span>
                        )}
                      </div>

                      {guestDetails.idProofImages && guestDetails.idProofImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-1">
                          {guestDetails.idProofImages.map((src, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(src)}
                              className="group relative bg-white rounded-xl border-2 border-gray-200 hover:border-[#c9a227] p-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
                            >
                              <div className="relative aspect-video sm:aspect-square w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                {src.startsWith("data:image") || src.startsWith("http") ? (
                                  <img
                                    src={src}
                                    alt={`ID Document ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="p-2 text-center text-gray-500 flex flex-col items-center">
                                    <FileText size={24} className="text-[#c9a227] mb-1" />
                                    <span className="text-[10px] font-bold">Document {idx + 1}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye size={20} className="drop-shadow" />
                                </div>
                              </div>
                              <div className="mt-1.5 px-1 flex items-center justify-between text-[10px]">
                                <span className="font-bold text-gray-700">
                                  {idx === 0 ? "ID Front" : idx === 1 ? "ID Back" : `Doc #${idx + 1}`}
                                </span>
                                <span className="text-[9px] text-[#c9a227] font-semibold group-hover:underline">View</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white p-4 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-1.5">
                          <ShieldCheck size={20} className="text-gray-400" />
                          <span>No physical image documents attached during registration.</span>
                          <span className="text-[10px] text-gray-400">
                            (Verification recorded with ID Number: {guestDetails.idNumber || "Provided at check-in"})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 3. ASSIGNED ACCOMMODATION & STAY CONFIGURATION */}
                    <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <BedDouble size={14} className="text-[#c9a227]" />
                          Assigned Accommodation {selectedRooms.length > 1 ? `(${selectedRooms.length} Rooms)` : ""}
                        </div>
                        <span className="text-xs text-gray-600 font-semibold">
                          <strong>{nights} Night{nights > 1 ? "s" : ""}</strong> &bull; {new Date(roomSearch.checkIn).toLocaleDateString("en-IN")} &rarr; {new Date(roomSearch.checkOut).toLocaleDateString("en-IN")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {selectedRooms.length > 1 ? (
                          selectedRooms.map(rm => (
                            <span key={rm._id} className="text-sm font-black font-serif text-[#c9a227] bg-[#c9a227]/10 px-3 py-1.5 rounded-xl border border-[#c9a227]/30 shadow-sm flex items-center gap-1.5">
                              <BedDouble size={14} /> Room {rm.roomNumber} ({rm.category?.name || "Suite"})
                            </span>
                          ))
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black font-serif text-[#c9a227]">
                              Room {selectedRoom?.roomNumber}
                            </span>
                            <span className="text-xs font-bold bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                              {selectedRoom?.category?.name || "Deluxe"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Stay parameters chips */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Arrival & Departure</span>
                          <span className="font-semibold text-gray-800">
                            In: {stayDetails.arrivalTime || "12:00"} &bull; Out: {stayDetails.departureTime || "11:00"}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Meal Plan</span>
                          <span className="font-semibold text-gray-800">
                            {stayDetails.mealPlan === "EP" ? "EP — Room Only" :
                             stayDetails.mealPlan === "CP" ? "CP — Continental / Breakfast" :
                             stayDetails.mealPlan === "MAP" ? "MAP — Half Board" :
                             stayDetails.mealPlan === "AP" ? "AP — American / All Meals" : stayDetails.mealPlan}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Occupancy</span>
                          <span className="font-semibold text-gray-800">
                            {roomSearch.adults} Adult(s){Number(roomSearch.children) > 0 ? `, ${roomSearch.children} Child(ren)` : ""}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Payment & Advance</span>
                          <span className="font-semibold text-gray-800">
                            {billingDetails.advanceAmount && Number(billingDetails.advanceAmount) > 0 ? (
                              <span className="text-green-700 font-bold">
                                ₹{Number(billingDetails.advanceAmount).toLocaleString("en-IN")} ({billingDetails.advanceMethod})
                              </span>
                            ) : (
                              <span className="text-gray-500">Pay on Checkout</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* DAY-BY-DAY CHARGES BREAKDOWN TABLE (IMAGE 1 BILL STYLE) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar size={14} className="text-[#c9a227]" />
                          Day-by-Day Itemized Charges Schedule (Check-in &rarr; Checkout)
                        </h4>
                        <span className="text-[10px] text-gray-500 font-mono">SAC: 996311</span>
                      </div>

                      <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5 border-r border-gray-200">Date / Night</th>
                              <th className="p-2.5 text-right border-r border-gray-200">Tariff</th>
                              <th className="p-2.5 text-right border-r border-gray-200">Extra Bed</th>
                              <th className="p-2.5 text-right border-r border-gray-200">Taxable</th>
                              <th className="p-2.5 text-right border-r border-gray-200">CGST (6%)</th>
                              <th className="p-2.5 text-right border-r border-gray-200">SGST (6%)</th>
                              <th className="p-2.5 text-right">Day Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 font-mono">
                            {daysSchedule.map((day) => (
                              <tr key={day.night} className="hover:bg-gray-50/80 transition">
                                <td className="p-2.5 border-r border-gray-200 font-sans font-semibold text-gray-900">
                                  Night #{day.night} &bull; <span className="font-mono text-gray-600">{day.dateStr}</span>
                                </td>
                                <td className="p-2.5 text-right border-r border-gray-200">₹{day.tariff.toLocaleString("en-IN")}</td>
                                <td className="p-2.5 text-right border-r border-gray-200">{day.extraBed > 0 ? `₹${day.extraBed.toLocaleString("en-IN")}` : "—"}</td>
                                <td className="p-2.5 text-right border-r border-gray-200 font-semibold">₹{day.taxable.toLocaleString("en-IN")}</td>
                                <td className="p-2.5 text-right border-r border-gray-200 text-gray-600">₹{day.cgst.toLocaleString("en-IN")}</td>
                                <td className="p-2.5 text-right border-r border-gray-200 text-gray-600">₹{day.sgst.toLocaleString("en-IN")}</td>
                                <td className="p-2.5 text-right font-bold text-gray-900">₹{day.total.toLocaleString("en-IN")}</td>
                              </tr>
                            ))}

                            {/* Additional Service or Meal Plan Charges if any */}
                            {rateBreakdown.mealPlanTotal > 0 && (
                              <tr className="bg-amber-50/50 text-amber-900">
                                <td className="p-2.5 border-r border-gray-200 font-sans font-semibold">Meal Plan ({stayDetails.mealPlan})</td>
                                <td colSpan={5} className="p-2.5 text-right border-r border-gray-200">Applicable food package</td>
                                <td className="p-2.5 text-right font-bold">₹{rateBreakdown.mealPlanTotal.toLocaleString("en-IN")}</td>
                              </tr>
                            )}
                            {rateBreakdown.otherCharges > 0 && (
                              <tr className="bg-amber-50/50 text-amber-900">
                                <td className="p-2.5 border-r border-gray-200 font-sans font-semibold">Other Charges / Incidentals</td>
                                <td colSpan={5} className="p-2.5 text-right border-r border-gray-200">Services</td>
                                <td className="p-2.5 text-right font-bold">₹{rateBreakdown.otherCharges.toLocaleString("en-IN")}</td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 text-xs font-mono">
                            <tr>
                              <td className="p-2.5 border-r border-gray-200 uppercase font-sans">Sub Total</td>
                              <td className="p-2.5 text-right border-r border-gray-200">₹{rateBreakdown.roomCharges.toLocaleString("en-IN")}</td>
                              <td className="p-2.5 text-right border-r border-gray-200">{rateBreakdown.extraBedTotal > 0 ? `₹${rateBreakdown.extraBedTotal.toLocaleString("en-IN")}` : "—"}</td>
                              <td className="p-2.5 text-right border-r border-gray-200">₹{(rateBreakdown.roomCharges + (rateBreakdown.extraBedTotal || 0)).toLocaleString("en-IN")}</td>
                              <td className="p-2.5 text-right border-r border-gray-200">₹{rateBreakdown.tax.cgst.toLocaleString("en-IN")}</td>
                              <td className="p-2.5 text-right border-r border-gray-200">₹{rateBreakdown.tax.sgst.toLocaleString("en-IN")}</td>
                              <td className="p-2.5 text-right font-black text-sm text-[#c9a227]">₹{rateBreakdown.totalAmount.toLocaleString("en-IN")}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Statutory GST Note */}
                    <div className="text-[10px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200 leading-relaxed">
                      *GST calculated at 12% standard hospitality rate (6% CGST + 6% SGST) under SAC Code 996311. All disputes subject to Bengaluru jurisdiction.
                    </div>

                  </div>

                  {/* RIGHT COLUMN: STICKY NET VALUE & SETTLEMENT SIDE PANEL (AS REQUESTED) */}
                  <div className="lg:col-span-4">
                    <div className="sticky top-24 bg-gradient-to-b from-gray-50 to-white rounded-2xl border-2 border-gray-300 p-6 shadow-md space-y-5">
                      
                      <div className="border-b border-gray-200 pb-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] flex items-center gap-1">
                          <CreditCard size={14} /> Settlement Breakdown
                        </div>
                        <h3 className="text-lg font-serif font-black text-gray-900 mt-0.5">Billing &amp; Net Value</h3>
                      </div>

                      {/* Line Items */}
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between text-gray-600">
                          <span>Room Tariff ({nights}N)</span>
                          <span className="font-mono font-semibold">₹{rateBreakdown.roomCharges.toLocaleString("en-IN")}</span>
                        </div>
                        {rateBreakdown.extraBedTotal > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>Extra Bed Charges</span>
                            <span className="font-mono font-semibold">₹{rateBreakdown.extraBedTotal.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-600">
                          <span>Taxes (CGST + SGST)</span>
                          <span className="font-mono font-semibold">₹{(rateBreakdown.tax.cgst + rateBreakdown.tax.sgst).toLocaleString("en-IN")}</span>
                        </div>
                        
                        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-sm text-gray-900">
                          <span>Total Invoice Value:</span>
                          <span className="font-mono">₹{rateBreakdown.totalAmount.toLocaleString("en-IN")}</span>
                        </div>

                        {/* Advance Paid Section */}
                        {advanceAmountNum > 0 ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 space-y-1">
                            <div className="flex justify-between font-bold text-xs">
                              <span>Advance Received:</span>
                              <span className="font-mono text-emerald-700">- ₹{advanceAmountNum.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-emerald-700">
                              <span>Mode:</span>
                              <span className="font-bold uppercase tracking-wider">{billingDetails.advanceMethod}</span>
                            </div>
                            {billingDetails.advanceReference && (
                              <div className="text-[10px] text-emerald-600 font-mono truncate">
                                Ref: {billingDetails.advanceReference}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-100 rounded-lg p-2 text-center text-[10px] text-gray-500">
                            No advance deposit recorded (Full settlement at checkout)
                          </div>
                        )}

                        {/* NET VALUE DUE AT CHECKOUT (HIGHLIGHTED) */}
                        <div className="border-t-2 border-dashed border-gray-300 pt-3">
                          <div className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Net Balance Due on Checkout:</div>
                          <div className="text-3xl font-black font-mono text-[#c9a227] tracking-tight mt-0.5">
                            ₹{netPayable.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">
                            Payable upon departure settlement
                          </div>
                        </div>

                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 space-y-2">
                        <button
                          onClick={confirmRegistration}
                          disabled={submitting}
                          className="w-full bg-[#c9a227] hover:bg-black text-white py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw size={18} className="animate-spin" /> Saving Registration...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} /> Complete Registration
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setStep("DETAILS")}
                          disabled={submitting}
                          className="w-full bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 py-2.5 px-4 rounded-xl font-bold text-xs transition"
                        >
                          Back to Edit Details
                        </button>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            </div>
          );
        })()}

        {/* =========================================================================
            STEP 5: DONE — BOTH GRC (CONSENT FORM) & GST INVOICE RENDERED VISIBLE ON PAGE
            ========================================================================= */}
        {step === "DONE" && registeredBooking && (() => {
          const billNo = registeredBooking.billNumber || registeredBooking.bookingReference || "—";
          const allRoomNumbers = selectedRooms.length > 0
            ? selectedRooms.map(r => r.roomNumber).join(", ")
            : (selectedRoom?.roomNumber || "—");

          return (
            <div className="animate-in fade-in duration-300 space-y-6 max-w-5xl mx-auto">
              
              {/* TOP STICKY COMMAND BAR */}
              <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Registration Complete</span>
                      <span className="bg-red-50 text-red-700 border border-red-200 font-mono font-black text-xs px-2 py-0.5 rounded">
                        Bill No: {billNo}
                      </span>
                    </div>
                    <div className="text-sm font-black text-gray-900 mt-0.5">
                      {guestDetails.guestFirstName} {guestDetails.guestLastName} &bull; Room(s) {allRoomNumbers}
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-bold text-xs text-gray-800 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <FileCheck2 size={15} className="text-[#c9a227]" /> View / Print GRC
                  </button>
                  <button
                    onClick={handlePrintInvoice}
                    className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-bold text-xs text-gray-800 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer size={15} className="text-[#c9a227]" /> View / Print Invoice
                  </button>
                  <button
                    onClick={() => navigate("/admin/front-desk")}
                    className="px-5 py-2 bg-[#c9a227] hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md"
                  >
                    <ArrowRight size={15} /> Go to In-House Stays
                  </button>
                </div>
              </div>

              {docModal && (
                <div role="dialog" aria-modal="true" aria-label={docModal === "grc" ? "Guest Registration Card" : "GST Invoice"} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDocModal(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                      <span className="font-bold text-sm text-gray-800">{docModal === "grc" ? "Guest Registration Card (GRC)" : "GST Invoice"}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={printDocModal} className="px-3.5 py-2 bg-black text-[#e5c76b] rounded-xl font-bold text-xs flex items-center gap-1.5"><Printer size={14} /> Print</button>
                        <button type="button" onClick={() => setDocModal(null)} className="px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-bold text-xs">Close</button>
                      </div>
                    </div>
                    <iframe
                      ref={docFrameRef}
                      title={docModal === "grc" ? "Guest Registration Card" : "GST Invoice"}
                      src={`/admin/bookings/${registeredBooking._id}/${docModal === "grc" ? "grc-print" : "folio-print"}`}
                      className="flex-1 w-full border-0"
                    />
                  </div>
                </div>
              )}


            </div>
          );
        })()}

        {/* LIGHTBOX MODAL FOR PREVIEWING ATTACHED DOCUMENTS & IMAGES */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-3.5 bg-gray-900 text-white flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-[#c9a227]">
                  <ImageIcon size={16} /> Attached KYC Document Preview
                </span>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 bg-gray-100 flex items-center justify-center overflow-auto max-h-[80vh]">
                <img
                  src={previewImage}
                  alt="Document Preview"
                  className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-md"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
