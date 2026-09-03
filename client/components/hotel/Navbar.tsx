import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoldButton } from "./HotelButtons";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About Us", href: "#about" },
  { label: "Rooms", href: "#rooms" },
  { label: "Gallery", href: "#gallery" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar({ transparent = true }: { transparent?: boolean } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
        <a
          href="#home"
          className="font-serif text-xl sm:text-2xl font-semibold tracking-[0.08em] text-hotel-white"
        >
          YES <span className="text-hotel-gold">HOTELS</span>
        </a>

        <nav className="hidden items-center gap-9 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="gold-underline text-xs font-medium uppercase tracking-[0.18em] text-hotel-white/85 transition-colors hover:text-hotel-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <GoldButton href="#booking" className="px-6 py-3 text-[11px]">
            Book Your Stay
          </GoldButton>
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
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            onClick={() => setOpen(false)}
            className="border-b border-hotel-white/10 py-4 text-sm font-medium uppercase tracking-[0.18em] text-hotel-white/90"
          >
            {link.label}
          </a>
        ))}
        <GoldButton href="#booking" className="mt-6 w-full py-4">
          Book Your Stay
        </GoldButton>
      </div>
    </header>
  );
}
