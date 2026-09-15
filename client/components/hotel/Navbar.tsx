import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Sparkles, BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS: { label: string; hash?: string; route: string }[] = [
  { label: "Home", hash: "home", route: "/" },
  { label: "About Us", hash: "about", route: "/about" },
  { label: "Rooms", hash: "rooms", route: "/rooms" },
  { label: "Gallery", hash: "gallery", route: "/gallery" },
  { label: "FAQ", route: "/faq" },
  { label: "Contact", route: "/contact" },
];

export default function Navbar({ transparent = true }: { transparent?: boolean } = {}) {
  const [scrollY, setScrollY] = useState(0);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onHomepage = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const scrolled = scrollY > 30;
  const floating = scrollY > 200;

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

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out",
        floating
          ? "bg-[#121316]/90 py-3 shadow-[0_15px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl border-b border-[#c9a227]/30"
          : scrolled
          ? "bg-[#0b0b0b]/95 py-4 backdrop-blur-md border-b border-[#262930]"
          : "bg-gradient-to-b from-[#0b0b0b]/80 to-transparent py-6"
      )}
    >
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          className="font-serif text-xl md:text-2xl font-bold tracking-[0.1em] text-white flex items-center gap-2 group"
        >
          <span className="p-1.5 bg-[#c9a227]/10 rounded-lg border border-[#c9a227]/30 text-[#c9a227] group-hover:bg-[#c9a227] group-hover:text-black transition">
            <BedDouble size={18} />
          </span>
          <span>YES <span className="text-[#c9a227] font-normal italic">HOTELS</span></span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) =>
            renderLink(
              link,
              "text-xs font-mono font-semibold uppercase tracking-[0.2em] text-gray-300 transition-colors hover:text-[#c9a227]"
            )
          )}
        </nav>

        {/* Action Button */}
        <div className="hidden lg:block">
          {onHomepage ? (
            <a
              href="#booking"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c9a227] hover:bg-[#e5c76b] text-black font-serif font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition"
            >
              <Sparkles size={13} /> Book Your Stay
            </a>
          ) : (
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c9a227] hover:bg-[#e5c76b] text-black font-serif font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition"
            >
              <Sparkles size={13} /> Book Your Stay
            </Link>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="text-white lg:hidden p-2 rounded-lg bg-[#1a1d24] border border-[#262930]"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-x-0 top-[68px] z-40 bg-[#121316]/98 backdrop-blur-xl border-b border-[#262930] px-6 py-6 space-y-4 lg:hidden text-white shadow-2xl">
          <div className="flex flex-col gap-3 font-mono text-sm uppercase tracking-widest">
            {NAV_LINKS.map((link) =>
              renderLink(link, "py-2 border-b border-[#262930] hover:text-[#c9a227]", () => setOpen(false))
            )}
          </div>
          <Link
            to="/search"
            onClick={() => setOpen(false)}
            className="w-full mt-4 py-3 bg-[#c9a227] text-black font-bold text-xs uppercase tracking-widest rounded-xl text-center block shadow-lg"
          >
            Book Your Stay →
          </Link>
        </div>
      )}
    </header>
  );
}
