import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, UserCheck, ShieldCheck, CreditCard,
  Printer, CheckCircle2, BedDouble, Plus, AlertCircle, RefreshCw, ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";
import { cn } from "@/lib/utils";

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

export default function AdminGuestRegistration() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("SEARCH");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // SEARCH STEP
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ guests: any[]; recentBookings: any[] } | null>(null);

  // ROOM SELECTION STEP
  const [roomSearch, setRoomSearch] = useState({
    checkIn: new Date().toISOString().split("T")[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    adults: "1",
    children: "0",
    bookingType: "NIGHTLY" as "NIGHTLY" | "HOURLY",
    hours: "4",
  });
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);

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
      checkIn: new Date(booking.checkInDate).toISOString().split("T")[0],
      checkOut: new Date(booking.checkOutDate).toISOString().split("T")[0],
      adults: String(booking.adults || 1),
      children: String(booking.children || 0),
    });
    if (booking.assignedRoom) {
      setSelectedRoom(booking.assignedRoom);
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
    setStep("DETAILS");
  };

  const calculateRates = async () => {
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
          roomId: selectedRoom._id,
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
    if (!selectedRoom || !rateBreakdown) return;
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
        roomId: selectedRoom._id,
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
        toast({ title: "Registration Successful", description: "Booking has been generated. Ready for Check-in." });
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

  const handlePrint = () => {
    if (!registeredBooking) return;
    const token = getStoredAuthToken();
    const url = `/api/front-desk/registration/${registeredBooking._id}/print`;
    
    // Open in new tab and auto-print via small script
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        .then(res => res.text())
        .then(html => {
          printWindow.document.write(html);
          printWindow.document.close();
          // Let it load images/fonts before printing
          setTimeout(() => {
            printWindow.print();
          }, 500);
        });
    }
  };

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

            <button onClick={skipToWalkIn} className="mt-4 flex items-center justify-center gap-2 w-full max-w-md mx-auto py-3 bg-[#c9a227]/10 text-black border border-[#c9a227] rounded-xl hover:bg-[#c9a227] transition font-bold">
              <Plus size={18} /> New Walk-In Guest
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
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2">Ready for Assignment ({availableRooms.length})</h3>
                {availableRooms.map(room => (
                  <div key={room._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#c9a227] transition">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-2xl font-bold font-serif">{room.roomNumber}</span>
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {room.housekeepingLabel}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">{room.category?.name} &bull; Floor {room.floor_number}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Rack Rate</div>
                        <div className="font-bold text-lg text-[#c9a227]">₹{room.ratePerNight?.toLocaleString()}</div>
                      </div>
                      <button onClick={() => handleSelectRoom(room)} className="bg-[#c9a227]/10 text-[#c9a227] hover:bg-[#c9a227] hover:text-white px-6 py-2.5 rounded-xl font-bold transition border border-[#c9a227]">
                        Assign Room
                      </button>
                    </div>
                  </div>
                ))}
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
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Email</label><input type="email" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.email} onChange={e => setGuestDetails({...guestDetails, email: e.target.value})} /></div>
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
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">ID Type *</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={guestDetails.idType} onChange={e => setGuestDetails({...guestDetails, idType: e.target.value})}><option value="AADHAAR">Aadhaar</option><option value="PASSPORT">Passport</option><option value="DRIVING_LICENSE">Driving License</option><option value="VOTER_ID">Voter ID</option></select></div>
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
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Meal Plan</label><select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.mealPlan} onChange={e => setStayDetails({...stayDetails, mealPlan: e.target.value})}><option value="EP">EP (Room Only)</option><option value="CP">CP (Breakfast)</option><option value="MAP">MAP (Half Board)</option><option value="AP">AP (Full Board)</option><option value="RO">RO (Room Only)</option><option value="BB">BB (Bed & Breakfast)</option></select></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Kids &lt; 3 (Free)</label><input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.kidsUnder3} onChange={e => setStayDetails({...stayDetails, kidsUnder3: parseInt(e.target.value)||0})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Adult Extra Pax (No Bed)</label><input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraPersonsNoBed} onChange={e => setStayDetails({...stayDetails, extraPersonsNoBed: parseInt(e.target.value)||0})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Adult Extra Pax (With Bed)</label><input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraPersonsWithBed} onChange={e => setStayDetails({...stayDetails, extraPersonsWithBed: parseInt(e.target.value)||0})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Child 3-12 (No Bed)</label><input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraChildrenNoBed} onChange={e => setStayDetails({...stayDetails, extraChildrenNoBed: parseInt(e.target.value)||0})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Child 3-12 (With Bed)</label><input type="number" min="0" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" value={stayDetails.extraChildrenWithBed} onChange={e => setStayDetails({...stayDetails, extraChildrenWithBed: parseInt(e.target.value)||0})} /></div>
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
              <button onClick={calculateRates} disabled={submitting || !guestDetails.guestFirstName || !guestDetails.mobile || !guestDetails.idNumber} className="bg-[#c9a227] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-black transition flex items-center gap-2">
                {submitting ? <RefreshCw size={16} className="animate-spin" /> : "Calculate Rates & Proceed"}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 4: CONFIRMATION
            ========================================================================= */}
        {step === "CONFIRM" && rateBreakdown && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-[#262930] text-[#e5c76b] p-8 text-center">
                <CheckCircle2 size={48} className="mx-auto mb-4" />
                <h2 className="text-3xl font-serif mb-1">Registration Summary</h2>
                <p className="text-gray-400">Please verify details with the guest before generating the registration card.</p>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">Guest Info</h4>
                  <div className="text-lg font-bold">{guestDetails.guestFirstName} {guestDetails.guestLastName}</div>
                  <div className="text-sm text-gray-500 mb-4">{guestDetails.mobile} &bull; {guestDetails.idType} {guestDetails.idNumber}</div>

                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 mt-8">Stay Info</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Room</div>
                      <div className="font-bold text-xl">{selectedRoom?.roomNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Dates</div>
                      <div className="font-bold">{rateBreakdown.nights} Nights</div>
                      <div className="text-xs text-gray-500">{new Date(roomSearch.checkIn).toLocaleDateString()} &rarr; {new Date(roomSearch.checkOut).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">Tariff & Taxes</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Room Charges</span>
                      <span className="font-mono">₹{rateBreakdown.roomCharges.toLocaleString()}</span>
                    </div>
                    {rateBreakdown.extraBedTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Extra Bed(s)</span>
                        <span className="font-mono">₹{rateBreakdown.extraBedTotal.toLocaleString()}</span>
                      </div>
                    )}
                    {rateBreakdown.mealPlanTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Meal Plan ({stayDetails.mealPlan})</span>
                        <span className="font-mono">₹{rateBreakdown.mealPlanTotal.toLocaleString()}</span>
                      </div>
                    )}
                    {rateBreakdown.otherCharges > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Other Charges</span>
                        <span className="font-mono">₹{rateBreakdown.otherCharges.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-500">
                      <span>CGST (9%)</span>
                      <span className="font-mono">₹{rateBreakdown.tax.cgst.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 border-b border-gray-200 pb-3">
                      <span>SGST (9%)</span>
                      <span className="font-mono">₹{rateBreakdown.tax.sgst.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-1">
                      <span>Total Invoice Value</span>
                      <span className="font-mono text-[#c9a227]">₹{rateBreakdown.totalAmount.toLocaleString()}</span>
                    </div>
                    {Number(billingDetails.advanceAmount) > 0 && (
                      <div className="flex justify-between font-bold text-green-700 bg-green-50 p-2 rounded-lg mt-2 border border-green-100">
                        <span>Advance Paid ({billingDetails.advanceMethod})</span>
                        <span className="font-mono">- ₹{Number(billingDetails.advanceAmount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button onClick={() => setStep("DETAILS")} disabled={submitting} className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold">Edit Details</button>
                <button onClick={confirmRegistration} disabled={submitting} className="bg-[#c9a227] text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition flex items-center gap-2">
                  {submitting ? <RefreshCw size={18} className="animate-spin" /> : "Complete Registration"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 5: DONE
            ========================================================================= */}
        {step === "DONE" && registeredBooking && (
          <div className="animate-in zoom-in-95 duration-300 max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 text-center p-12">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-3xl font-serif font-bold mb-2">Registration Saved</h2>
              <p className="text-gray-500 mb-8">Bill No: <span className="font-mono font-bold text-black">{registeredBooking.billNumber}</span></p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={handlePrint} className="flex-1 py-4 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2 border border-gray-300">
                  <Printer size={20} /> Print Card
                </button>
                <button onClick={handleCheckIn} disabled={submitting} className="flex-1 py-4 bg-[#c9a227] text-white rounded-xl font-bold hover:bg-black transition flex items-center justify-center gap-2 shadow-lg">
                  {submitting ? <RefreshCw size={20} className="animate-spin" /> : "Check-in Now"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-6"><AlertCircle size={12} className="inline mr-1"/> "Check-in" will formally assign the room, create the folio, and post the tariff to the ledger.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
