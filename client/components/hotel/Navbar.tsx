import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoldButton } from "./HotelButtons";

// `hash` sections only exist on the homepage (see client/pages/Index.tsx —
// Hero=#home, About=#about, Rooms=#rooms, Gallery=#gallery). FAQ and
// Contact have NEVER had homepage sections at all; they only exist as their
// own standalone pages. Previously every link here was a bare `href="#x"`
// regardless of which page you were on — that only ever worked by accident
// on the homepage for the 4 links that happen to have a matching id, and
// did nothing on every other page (clicking "Gallery" from /rooms just
// appended "#gallery" to the URL with nothing to scroll to). Fixed by
// making every link location-aware: an in-page hash scroll on the homepage
// where the section actually exists, a real route navigation everywhere
// else (and for FAQ/Contact, always a route navigation, homepage included).
const NAV_LINKS: { label: string; hash?: string; route: string }[] = [
  { label: "Home", hash: "home", route: "/" },
  { label: "About Us", hash: "about", route: "/about" },
  { label: "Rooms", hash: "rooms", route: "/rooms" },
  { label: "Gallery", hash: "gallery", route: "/gallery" },
  { label: "FAQ", route: "/faq" },
  { label: "Contact", route: "/contact" },
];

export default function Navbar({ transparent = true }: { transparent?: boolean } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onHomepage = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // `transparent` (default true) is only correct on pages that render a
  // dark, full-bleed hero image directly under the nav (currently just the
  // homepage) — the unscrolled bg-transparent + white-text look depends on
  // that dark backdrop for contrast. Every interior page (Rooms, Gallery,
  // FAQ, Contact, Search, booking flow, etc.) has a light page background
  // instead, so white nav text at scrollY=0 was real, measured, failing
  // WCAG contrast (as low as 1.07:1) — not a hero-image edge case, the
  // default state on every one of those pages. `transparent={false}` opts
  // into the always-solid dark bar those pages actually need.
  const solid = !transparent || scrolled;

  const navClasses =
    "gold-underline text-xs font-medium uppercase tracking-[0.18em] text-hotel-white/85 transition-colors hover:text-hotel-white";
  const mobileNavClasses =
    "border-b border-hotel-white/10 py-4 text-sm font-medium uppercase tracking-[0.18em] text-hotel-white/90";

  function renderLink(link: (typeof NAV_LINKS)[number], className: string, onClick?: () => void) {
    if (onHomepage && link.hash) {
      return (
        <a key={link.label} href={`#${link.hash}`} className={className} onClick={onClick}>
          {link.label}
        </a>
      );
    }
    return (
      <Link key={link.label} to={link.route} className={className} onClick={onClick}>
        {link.label}
      </Link>
    );
  }

  const bookButtonClasses = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap bg-hotel-gold px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-hotel-black transition-all duration-300 hover:bg-hotel-champagne active:scale-[0.98]",
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        solid
          ? "bg-hotel-black/95 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-sm"
          : "bg-transparent py-6",
      )}
    >
      <div className="container flex items-center justify-between">
        {onHomepage ? (
          <a
            href="#home"
            className="font-serif text-xl sm:text-2xl font-semibold tracking-[0.08em] text-hotel-white"
          >
            YES <span className="text-hotel-gold">HOTELS</span>
          </a>
        ) : (
          <Link
            to="/"
            className="font-serif text-xl sm:text-2xl font-semibold tracking-[0.08em] text-hotel-white"
          >
            YES <span className="text-hotel-gold">HOTELS</span>
          </Link>
        )}

        <nav className="hidden items-center gap-9 lg:flex">
          {NAV_LINKS.map((link) => renderLink(link, navClasses))}
        </nav>

        <div className="hidden lg:block">
          {onHomepage ? (
            <GoldButton href="#booking" className="px-6 py-3 text-[11px]">
              Book Your Stay
            </GoldButton>
          ) : (
            <Link to="/search" className={bookButtonClasses}>
              Book Your Stay
            </Link>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="text-hotel-white lg:hidden"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 top-[64px] z-40 flex flex-col gap-1 bg-hotel-black/98 px-6 pb-8 pt-4 backdrop-blur-sm transition-all duration-300 lg:hidden",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-4 opacity-0",
        )}
      >
        {NAV_LINKS.map((link) => renderLink(link, mobileNavClasses, () => setOpen(false)))}
        {onHomepage ? (
          <GoldButton href="#booking" className="mt-6 w-full py-4">
            Book Your Stay
          </GoldButton>
        ) : (
          <Link to="/search" className={cn(bookButtonClasses, "mt-6 w-full py-4")} onClick={() => setOpen(false)}>
            Book Your Stay
          </Link>
        )}
      </div>
    </header>
  );
}
