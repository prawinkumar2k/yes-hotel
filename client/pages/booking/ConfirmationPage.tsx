import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { CheckCircle2 } from "lucide-react";

export default function ConfirmationPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("ref");

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <CheckCircle2 size={64} className="text-hotel-gold mx-auto mb-6" />
        <h1 className="font-serif text-4xl text-hotel-black mb-4">Booking Confirmed</h1>
        <p className="text-hotel-black/60 mb-8">
          Thank you for choosing YES Hotels. We have sent the confirmation details to your email address.
        </p>

        {reference && (
          <div className="bg-hotel-white border border-hotel-black/10 p-8 mb-10 shadow-sm inline-block min-w-80">
            <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-2">Booking Reference</p>
            <p className="font-mono text-2xl font-bold text-hotel-black">{reference}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/customer/bookings">
            <GoldButton className="w-full sm:w-auto px-8 py-3">View My Bookings</GoldButton>
          </Link>
          <Link to="/">
            <button className="text-sm font-medium uppercase tracking-widest text-hotel-black hover:text-hotel-gold transition-colors">
              Return to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
