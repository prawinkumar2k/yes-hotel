import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ChevronRight, ShieldCheck, Loader2, AlertCircle } from "lucide-react";

// Declare Razorpay global type
declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookingData, setBookingData] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [couponState, setCouponState] = useState<"idle" | "checking" | "applied" | "error">("idle");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  const nights = bookingData && categoryData
    ? Math.ceil((new Date(bookingData.checkOut).getTime() - new Date(bookingData.checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const roomCharges = categoryData ? categoryData.basePrice * nights : 0;
  // This preview mirrors the backend's GST-after-discount calculation; the server
  // recalculates it authoritatively when the booking is created — this is a display hint only.
  const previewDiscount = appliedCoupon?.discount ?? 0;
  const taxableAmount = Math.max(roomCharges - previewDiscount, 0);
  const taxAmount = Math.round(taxableAmount * 0.18);
  const totalAmount = taxableAmount + taxAmount;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !bookingData) return;
    setCouponState("checking");
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponInput.trim(),
          bookingAmount: roomCharges,
          roomCategoryId: bookingData.category,
          guestEmail: bookingData.guestDetails.email,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setAppliedCoupon({ code: json.data.code, discount: json.data.discount });
      setCouponState("applied");
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponState("error");
      setCouponError(err.message || "Invalid coupon");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponState("idle");
    setCouponError(null);
  };

  useEffect(() => {
    const data = sessionStorage.getItem("bookingDetails");
    if (!data) { navigate("/search"); return; }
    const parsed = JSON.parse(data);
    setBookingData(parsed);

    fetch("/api/rooms/categories")
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const cat = res.data.find((c: any) => c._id === parsed.category);
          setCategoryData(cat);
        }
      });
  }, [navigate]);

  // Step 1: Create a booking record on the backend, then open Razorpay
  const handlePayNow = async () => {
    if (!bookingData || !categoryData) return;
    setIsProcessing(true);
    setError(null);

    try {
      const bookingAttemptKey = bookingData.idempotencyKey || sessionStorage.getItem("bookingIdempotencyKey") || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem("bookingIdempotencyKey", bookingAttemptKey);

      // First: create the booking in DB (status: PENDING, paymentStatus: UNPAID)
      let currentBookingId = bookingId;
      let currentBookingRef = bookingRef;

      if (!currentBookingId) {
        const bookingRes = await fetch("/api/bookings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": bookingAttemptKey,
            ...(user && { Authorization: `Bearer ${user.token}` }),
          },
          body: JSON.stringify({
            roomCategoryId: bookingData.category,
            checkInDate: bookingData.checkIn,
            checkOutDate: bookingData.checkOut,
            adults: parseInt(bookingData.adults),
            children: parseInt(bookingData.children),
            guestDetails: bookingData.guestDetails,
            specialRequests: bookingData.specialRequests,
            couponCode: appliedCoupon?.code,
          }),
        });
        const bookingJson = await bookingRes.json();
        if (!bookingJson.success) throw new Error(bookingJson.message);
        currentBookingId = bookingJson.data._id;
        currentBookingRef = bookingJson.data.bookingReference;
        setBookingId(currentBookingId!);
        setBookingRef(currentBookingRef!);
      }

      // Second: create a Razorpay order
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: currentBookingId }),
      });
      const orderJson = await orderRes.json();

      // If Razorpay is not configured, fall back to demo mode
      if (!orderJson.success) {
        const confirmRes = await fetch(`/api/bookings/${currentBookingId}/confirm-demo`, { method: "POST" });
        const confirmJson = await confirmRes.json();
        if (!confirmJson.success) {
          throw new Error(confirmJson.message || "Unable to confirm booking");
        }
        sessionStorage.removeItem("bookingDetails");
        sessionStorage.removeItem("bookingIdempotencyKey");
        navigate(`/booking/confirmation?ref=${confirmJson.data.bookingReference}`);
        return;
      }

      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Razorpay SDK failed to load. Check your internet connection.");

      const options = {
        key: orderJson.data.keyId,
        amount: orderJson.data.amount,
        currency: orderJson.data.currency,
        name: "YES Hotels",
        description: `Booking ${orderJson.data.bookingReference}`,
        order_id: orderJson.data.orderId,
        prefill: {
          name: orderJson.data.guestName,
          email: orderJson.data.guestEmail,
          contact: orderJson.data.guestPhone,
        },
        theme: { color: "#C9A96E" },
        handler: async (response: any) => {
          // Verify payment on backend
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: currentBookingId,
            }),
          });
          const verifyJson = await verifyRes.json();
          if (verifyJson.success) {
            sessionStorage.removeItem("bookingDetails");
            sessionStorage.removeItem("bookingIdempotencyKey");
            navigate(`/booking/confirmation?ref=${verifyJson.data.bookingReference}`);
          } else {
            toast({ title: "Payment verification failed", description: verifyJson.message, variant: "destructive" });
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            toast({ title: "Payment cancelled", description: "Your booking is saved. You can try paying again." });
            setIsProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  if (!bookingData || !categoryData) {
    return (
      <div className="min-h-screen bg-hotel-ivory pt-24 flex items-center justify-center">
        <Loader2 className="animate-spin text-hotel-gold" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center gap-4 text-xs font-medium uppercase tracking-widest mb-12">
          <span className="text-hotel-black/60">1. Select Room</span>
          <ChevronRight size={14} className="text-hotel-black/20" />
          <span className="text-hotel-black/60">2. Guest Details</span>
          <ChevronRight size={14} className="text-hotel-black/20" />
          <span className="text-hotel-gold">3. Payment</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-serif text-2xl text-hotel-black mb-6">Secure Payment</h2>
            <div className="bg-hotel-white border border-hotel-black/10 p-8 shadow-sm">
              <div className="flex items-center gap-3 text-sm text-green-700 bg-green-50 p-4 mb-6 rounded border border-green-200">
                <ShieldCheck size={20} />
                <p>Your payment is secured by Razorpay with 256-bit encryption.</p>
              </div>

              {error && (
                <div className="flex items-start gap-3 text-sm text-red-700 bg-red-50 p-4 mb-6 rounded border border-red-200">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="mb-8 space-y-3 text-sm text-hotel-black/70">
                <p className="font-medium text-hotel-black">Payment via Razorpay</p>
                <p>Accepted: Credit/Debit Card, UPI, Net Banking, Wallets</p>
                <div className="flex gap-3 mt-4">
                  {["VISA", "MC", "UPI", "NB"].map(m => (
                    <span key={m} className="border border-hotel-black/20 px-2 py-1 text-[10px] font-bold tracking-widest text-hotel-black/60 rounded">{m}</span>
                  ))}
                </div>
              </div>

              <GoldButton onClick={handlePayNow} disabled={isProcessing} className="w-full py-4 text-base">
                {isProcessing
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Processing...</span>
                  : `Pay ₹${totalAmount.toLocaleString("en-IN")}`}
              </GoldButton>

              <p className="text-center text-xs text-hotel-black/60 mt-4">
                By completing payment, you agree to our cancellation policy.
              </p>
            </div>
          </div>

          <div>
            <div className="bg-hotel-black text-hotel-white p-8">
              <h3 className="font-serif text-xl text-hotel-gold mb-6">Order Summary</h3>

              <div className="space-y-4 text-sm text-hotel-white/80 border-b border-hotel-white/10 pb-6 mb-6">
                <div>
                  <p className="text-hotel-white/50 text-xs uppercase tracking-widest mb-1">Room</p>
                  <p className="font-serif text-lg text-hotel-white">{categoryData.name}</p>
                </div>
                <div>
                  <p className="text-hotel-white/50 text-xs uppercase tracking-widest mb-1">Dates</p>
                  <p>{format(new Date(bookingData.checkIn), "MMM dd, yyyy")} — {format(new Date(bookingData.checkOut), "MMM dd, yyyy")}</p>
                  <p className="text-hotel-gold mt-1">{nights} Night{nights !== 1 ? "s" : ""}</p>
                </div>
                <div>
                  <p className="text-hotel-white/50 text-xs uppercase tracking-widest mb-1">Guest</p>
                  <p>{bookingData.guestDetails.firstName} {bookingData.guestDetails.lastName}</p>
                  <p className="text-hotel-white/60">{bookingData.adults} Adult(s), {bookingData.children} Child(ren)</p>
                </div>
              </div>

              <div className="mb-6">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-hotel-white/10 px-4 py-3 text-sm">
                    <span className="text-hotel-gold font-medium tracking-wide">{appliedCoupon.code} applied</span>
                    <button onClick={handleRemoveCoupon} className="text-hotel-white/50 hover:text-hotel-white text-xs underline">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Coupon code"
                        className="flex-1 bg-transparent border border-hotel-white/20 px-3 py-2 text-sm text-hotel-white placeholder:text-hotel-white/40 focus:outline-none focus:border-hotel-gold"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={couponState === "checking" || !couponInput.trim()}
                        className="px-4 py-2 text-xs uppercase tracking-widest border border-hotel-gold text-hotel-gold hover:bg-hotel-gold hover:text-hotel-black transition-colors disabled:opacity-40"
                      >
                        {couponState === "checking" ? "..." : "Apply"}
                      </button>
                    </div>
                    {couponState === "error" && couponError && (
                      <p className="text-red-400 text-xs mt-2">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm text-hotel-white/80 mb-6">
                <div className="flex justify-between">
                  <span>Room Charges ({nights} night{nights !== 1 ? "s" : ""})</span>
                  <span>₹{roomCharges.toLocaleString("en-IN")}</span>
                </div>
                {previewDiscount > 0 && (
                  <div className="flex justify-between text-hotel-gold">
                    <span>Coupon Discount</span>
                    <span>-₹{previewDiscount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (18%)</span>
                  <span>₹{taxAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-hotel-white/10 pt-6">
                <span className="text-hotel-white font-medium uppercase tracking-widest text-xs">Total</span>
                <span className="font-serif text-2xl text-hotel-gold">₹{totalAmount.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-hotel-white/30 text-[11px] mt-3">
                Final payable amount is verified by our server before payment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
