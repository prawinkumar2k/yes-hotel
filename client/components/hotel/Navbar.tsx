import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Sparkles, BedDouble, LogIn, User, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

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
  const { user, logout } = useAuth();
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

  const isHeroTransparent = onHomepage && !scrolled;
  const dashboardRoute = user?.role && ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"].includes(user.role)
    ? "/admin/dashboard"
    : "/customer/dashboard";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out",
        floating
          ? "bg-white/95 py-3 shadow-md backdrop-blur-xl border-b border-slate-100"
          : scrolled
          ? "bg-white/98 py-4 backdrop-blur-md border-b border-slate-200 shadow-sm"
          : onHomepage
          ? "bg-gradient-to-b from-black/60 to-transparent py-6"
          : "bg-white py-4 border-b border-slate-100 shadow-sm"
      )}
    >
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          className={cn(
            "font-serif text-xl md:text-2xl font-bold tracking-[0.1em] flex items-center gap-2 group",
            isHeroTransparent ? "text-white" : "text-slate-800"
          )}
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
              cn(
                "text-xs font-mono font-semibold uppercase tracking-[0.2em] transition-colors hover:text-[#c9a227]",
                isHeroTransparent ? "text-gray-200" : "text-slate-600"
              )
            )
          )}
        </nav>

        {/* Action & Auth Buttons */}
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to={dashboardRoute}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition border",
                  isHeroTransparent
                    ? "bg-white/10 hover:bg-white/20 text-white border-white/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
                )}
              >
                <LayoutDashboard size={14} className="text-[#c9a227]" />
                <span>Dashboard</span>
              </Link>
              <button
                onClick={logout}
                title="Sign Out"
                className={cn(
                  "p-2 rounded-xl text-xs transition border",
                  isHeroTransparent
                    ? "text-gray-300 hover:text-white hover:bg-white/10 border-white/10"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200"
                )}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className={cn(
                "inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition border shadow-xs",
                isHeroTransparent
                  ? "bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-md"
                  : "bg-slate-900 hover:bg-slate-800 text-white border-slate-900"
              )}
            >
              <LogIn size={14} className="text-[#c9a227]" />
              <span>Log In</span>
            </Link>
          )}

          {onHomepage ? (
            <a
              href="#booking"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c9a227] hover:bg-[#b8911f] text-black font-serif font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition"
            >
              <Sparkles size={13} /> Book Your Stay
            </a>
          ) : (
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c9a227] hover:bg-[#b8911f] text-black font-serif font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition"
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
          className={cn(
            "lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border transition",
            isHeroTransparent
              ? "text-white bg-white/10 border-white/20"
              : "text-slate-700 bg-slate-50 border-slate-200"
          )}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-x-0 top-[64px] sm:top-[68px] z-40 bg-white/98 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-6 py-6 space-y-4 lg:hidden text-slate-800 shadow-2xl max-h-[calc(100vh-64px)] overflow-y-auto">
          <div className="flex flex-col gap-3 font-mono text-sm uppercase tracking-widest">
            {NAV_LINKS.map((link) =>
              renderLink(
                link,
                "min-h-[44px] flex items-center py-2 border-b border-slate-100 text-slate-600 hover:text-[#c9a227] transition",
                () => setOpen(false)
              )
            )}
          </div>
          <div className="pt-2 space-y-2">
            {user ? (
              <Link
                to={dashboardRoute}
                onClick={() => setOpen(false)}
                className="w-full min-h-[44px] py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl text-center flex items-center justify-center gap-2 shadow-md"
              >
                <LayoutDashboard size={16} className="text-[#c9a227]" />
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="w-full min-h-[44px] py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl text-center flex items-center justify-center gap-2 shadow-md"
              >
                <LogIn size={16} className="text-[#c9a227]" />
                Log In
              </Link>
            )}
            <Link
              to="/search"
              onClick={() => setOpen(false)}
              className="w-full min-h-[44px] py-3 bg-[#c9a227] text-black font-bold text-xs uppercase tracking-widest rounded-xl text-center flex items-center justify-center shadow-lg"
            >
              Book Your Stay →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
