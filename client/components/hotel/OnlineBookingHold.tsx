import type { ReactNode } from "react";
import { PhoneCall } from "lucide-react";
import Navbar from "@/components/hotel/Navbar";
import { hotelContactFrom, useHotelSettings } from "@/hooks/usePublicData";

/** True while online booking is on hold (Admin → Settings). Unknown until the settings load. */
export function useOnlineBookingOnHold() {
  const { data } = useHotelSettings();
  return { onHold: !!data && data.onlineBookingOpen !== true, loading: !data };
}

/** Shown on the website's booking pages while online booking is on hold. */
export default function OnlineBookingHold() {
  const { data } = useHotelSettings();
  const c = hotelContactFrom(data);
  return (
    <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-hotel-gold/40 bg-white p-8 text-center shadow-sm">
      <PhoneCall className="mx-auto mb-3 text-hotel-gold" size={32} />
      <h2 className="font-serif text-2xl text-hotel-black">Online booking is temporarily on hold</h2>
      <p className="mt-2 text-gray-700">Please call or WhatsApp us and we will book your stay right away.</p>
      <a href={c.phoneHref} className="mt-4 inline-block rounded-xl bg-hotel-gold px-6 py-3 text-lg font-bold text-black">{c.phone}</a>
    </div>
  );
}

/** Wraps a booking step: while online booking is on hold the guest sees the notice instead of the step. */
export function OnlineBookingGate({ children }: { children: ReactNode }) {
  const { onHold } = useOnlineBookingOnHold();
  if (!onHold) return <>{children}</>;
  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <OnlineBookingHold />
    </div>
  );
}
