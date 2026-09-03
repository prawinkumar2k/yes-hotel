import { Link } from "react-router-dom";
import { useHotelSettings } from "@/hooks/usePublicData";

const FALLBACK = {
  hotelName: "YES Hotels",
  description:
    "A signature hospitality brand built around thoughtful rooms, warm service and moments that stay with you long after checkout.",
  email: "hello@yeshotels.com",
  phone: "+1 (800) YES-STAY",
  address: "123 Grand Avenue, Prestige District, NY 10001",
  instagramUrl: undefined as string | undefined,
  facebookUrl: undefined as string | undefined,
  youtubeUrl: undefined as string | undefined,
};

export default function Footer() {
  const { data } = useHotelSettings();
  const settings = data ?? FALLBACK;

  const socials = [
    { label: "Instagram", href: settings.instagramUrl },
    { label: "Facebook", href: settings.facebookUrl },
    { label: "YouTube", href: settings.youtubeUrl },
  ].filter((s) => s.href);

  return (
    <footer className="bg-hotel-black border-t border-hotel-white/10">
      <div className="container py-20">
        <div className="grid grid-cols-1 gap-14 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link
              to="/"
              className="font-serif text-2xl font-semibold tracking-[0.08em] text-hotel-white"
            >
              {settings.hotelName?.split(" ")[0] ?? "YES"}{" "}
              <span className="text-hotel-gold">
                {settings.hotelName?.split(" ").slice(1).join(" ") || "HOTELS"}
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-hotel-white/55">
              {settings.description ?? FALLBACK.description}
            </p>
            {socials.length > 0 && (
              <div className="mt-8 flex gap-5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium uppercase tracking-[0.18em] text-hotel-white/50 hover:text-hotel-gold transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-hotel-gold">
              Explore
            </p>
            <ul className="mt-6 space-y-4">
              {[
                { label: "Home", to: "/" },
                { label: "About Us", to: "/about" },
                { label: "Rooms", to: "/rooms" },
                { label: "Gallery", to: "/gallery" },
                { label: "Book a Stay", to: "/search" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-sm text-hotel-white/60 transition-colors hover:text-hotel-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-hotel-gold">
              Contact
            </p>
            <ul className="mt-6 space-y-4 text-sm text-hotel-white/60">
              <li>{settings.email ?? FALLBACK.email}</li>
              <li>{settings.phone ?? FALLBACK.phone}</li>
              <li className="leading-relaxed">{settings.address ?? FALLBACK.address}</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-hotel-white/10 pt-10 sm:flex-row">
          <p className="text-xs text-hotel-white/50">
            © {new Date().getFullYear()} {settings.hotelName ?? FALLBACK.hotelName}. All rights reserved.
          </p>
          <div className="flex gap-8">
            <Link to="/privacy-policy" className="text-xs text-hotel-white/50 hover:text-hotel-white/80 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms-and-conditions" className="text-xs text-hotel-white/50 hover:text-hotel-white/80 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
