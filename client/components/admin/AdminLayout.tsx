import React, { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard, CalendarDays, BedDouble, Users, CreditCard,
  BarChart3, Settings, Home, Wrench, LogIn, LogOut, MenuIcon, X,
  Image, HelpCircle, MessageSquare, FileText, Star, Ticket, RotateCcw,
  ScrollText, Moon, DollarSign, Tag, Building2, UtensilsCrossed,
  Package, Truck, ShoppingBag, Landmark, AlertCircle, Monitor, Globe,
  PartyPopper, Sparkles, Search, Bell, Plus, ChevronDown, ChevronRight,
  ShieldCheck, CheckCircle2, SlidersHorizontal, Smartphone
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import NotificationCenter from "./NotificationCenter";
import QuickActionModal from "./QuickActionModal";
import { useQuery } from "@tanstack/react-query";
import { getStoredAuthToken } from "@/lib/authStorage";

interface NavItem {
  label: string;
  to: string;
  icon: any;
  roles: string[];
  badge?: string | number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ADMIN_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];
const STAFF_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"];
const FINANCE_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];
const EXEC_ROLES = ["ADMIN", "MANAGER"];

export default function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);

  // Expanded sections state (default all open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "MAIN": true,
    "FRONT OFFICE": true,
    "HOUSEKEEPING": true,
    "RESTAURANT / POS": true,
    "FINANCE": true,
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch live stats for sidebar badges — only for roles the front-desk API actually authorizes
  const { data: frontDeskSummary } = useQuery({
    queryKey: ["sidebarStats"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/front-desk/summary", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: ADMIN_ROLES.includes(user?.role || ""),
    refetchInterval: 45000,
  });

  const arrivalsCount = frontDeskSummary?.counts?.arrivals || 0;
  const departuresCount = frontDeskSummary?.counts?.departures || 0;
  const dirtyCount = frontDeskSummary?.counts?.dirtyRooms || 0;
  const inHouseCount = frontDeskSummary?.counts?.inHouse || 0;

  const NAV_SECTIONS: NavSection[] = [
    {
      title: "MAIN",
      items: [
        { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, roles: ADMIN_ROLES },
        { label: "Executive Command", to: "/admin/executive", icon: Monitor, roles: EXEC_ROLES },
      ],
    },
    {
      title: "FRONT OFFICE",
      items: [
        { label: "Front Desk Hub", to: "/admin/front-desk", icon: Home, roles: ADMIN_ROLES, badge: arrivalsCount > 0 ? arrivalsCount : undefined },
        { label: "Visual Room Rack", to: "/admin/room-rack", icon: BedDouble, roles: ADMIN_ROLES },
        { label: "Reservations", to: "/admin/bookings", icon: CalendarDays, roles: ADMIN_ROLES },
        { label: "Express Check-In", to: "/admin/check-in", icon: LogIn, roles: ADMIN_ROLES },
        { label: "Express Check-Out", to: "/admin/check-out", icon: LogOut, roles: ADMIN_ROLES, badge: departuresCount > 0 ? departuresCount : undefined },
        { label: "In-House Guests", to: "/admin/in-house-list", icon: FileText, roles: ADMIN_ROLES, badge: inHouseCount > 0 ? inHouseCount : undefined },
        { label: "Guest Directory", to: "/admin/guests", icon: Users, roles: ADMIN_ROLES },
        { label: "Stay Calendar", to: "/admin/calendar", icon: CalendarDays, roles: ADMIN_ROLES },
      ],
    },
    {
      title: "HOUSEKEEPING",
      items: [
        { label: "Housekeeping Board", to: "/admin/housekeeping", icon: Sparkles, roles: STAFF_ROLES, badge: dirtyCount > 0 ? `${dirtyCount} Dirty` : undefined },
        { label: "Mobile Staff HK", to: "/staff/mobile-housekeeping", icon: Smartphone, roles: ["ADMIN", "MANAGER", "HOUSEKEEPING"] },
      ],
    },
    {
      title: "MAINTENANCE",
      items: [
        { label: "Maintenance Tickets", to: "/admin/maintenance", icon: Wrench, roles: STAFF_ROLES },
      ],
    },
    {
      title: "RESTAURANT / POS",
      items: [
        { label: "POS Terminal & KDS", to: "/admin/pos", icon: UtensilsCrossed, roles: ADMIN_ROLES },
        { label: "Menu Management", to: "/admin/menu", icon: UtensilsCrossed, roles: EXEC_ROLES },
        { label: "Banquets & Events", to: "/admin/banquets", icon: PartyPopper, roles: ADMIN_ROLES },
      ],
    },
    {
      title: "FINANCE",
      items: [
        { label: "Advance Payments", to: "/admin/advances", icon: CreditCard, roles: FINANCE_ROLES },
        { label: "Cashier Shifts", to: "/admin/cashier-shifts", icon: DollarSign, roles: FINANCE_ROLES },
        { label: "Payments Ledger", to: "/admin/payments", icon: CreditCard, roles: EXEC_ROLES },
        { label: "Refunds", to: "/admin/refunds", icon: RotateCcw, roles: EXEC_ROLES },
        { label: "General Ledger", to: "/admin/accounting", icon: Landmark, roles: EXEC_ROLES },
        { label: "Night Audit", to: "/admin/night-audit", icon: Moon, roles: EXEC_ROLES },
      ],
    },
    {
      title: "INVENTORY",
      items: [
        { label: "Stock & Stores", to: "/admin/inventory", icon: Package, roles: ["ADMIN", "MANAGER", "HOUSEKEEPING"] },
        { label: "Vendors Directory", to: "/admin/vendors", icon: Truck, roles: EXEC_ROLES },
        { label: "Procurement (PO)", to: "/admin/procurement", icon: ShoppingBag, roles: EXEC_ROLES },
      ],
    },
    {
      title: "REVENUE",
      items: [
        { label: "Rate Plans", to: "/admin/rate-plans", icon: Tag, roles: EXEC_ROLES },
        { label: "Dynamic Pricing", to: "/admin/pricing", icon: CreditCard, roles: EXEC_ROLES },
        { label: "Room Categories", to: "/admin/room-categories", icon: BedDouble, roles: EXEC_ROLES },
        { label: "Room Master", to: "/admin/rooms", icon: BedDouble, roles: ADMIN_ROLES },
        { label: "OTA Channel Manager", to: "/admin/multi-property", icon: Globe, roles: ["ADMIN"] },
      ],
    },
    {
      title: "GROUPS & CRM",
      items: [
        { label: "Corporate Accounts", to: "/admin/corporate-accounts", icon: Building2, roles: EXEC_ROLES },
        { label: "Group Bookings (MICE)", to: "/admin/group-bookings", icon: Users, roles: ADMIN_ROLES },
        { label: "Ancillary Services", to: "/admin/ancillary", icon: Sparkles, roles: ADMIN_ROLES },
        { label: "Complaints & Recovery", to: "/admin/complaints", icon: AlertCircle, roles: EXEC_ROLES },
        { label: "Guest Reviews", to: "/admin/reviews", icon: Star, roles: EXEC_ROLES },
        { label: "Coupons & Promos", to: "/admin/coupons", icon: Ticket, roles: EXEC_ROLES },
      ],
    },
    {
      title: "REPORTS",
      items: [
        { label: "Analytics & Reports", to: "/admin/reports", icon: BarChart3, roles: EXEC_ROLES },
      ],
    },
    {
      title: "ADMINISTRATION",
      items: [
        { label: "Staff & RBAC", to: "/admin/staff", icon: Users, roles: EXEC_ROLES },
        { label: "Audit Logs", to: "/admin/audit-logs", icon: ScrollText, roles: EXEC_ROLES },
        { label: "Content CMS", to: "/admin/content", icon: FileText, roles: ["ADMIN"] },
        { label: "Hotel Settings", to: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
      ],
    },
  ];

  const userRole = user?.role || "GUEST";

  // Filter sections and items based on role
  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(userRole)),
  })).filter((section) => section.items.length > 0);

  const totalBadgeCount = (arrivalsCount > 0 ? 1 : 0) + (departuresCount > 0 ? 1 : 0) + (dirtyCount > 0 ? 1 : 0);

  return (
    <div className="h-screen overflow-hidden bg-[#0c0d0e] text-zinc-100 flex selection:bg-hotel-gold selection:text-black">
      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Operational Alerts Drawer */}
      <NotificationCenter open={notificationOpen} onClose={() => setNotificationOpen(false)} />

      {/* Quick Action Modal */}
      <QuickActionModal open={quickActionOpen} onOpenChange={setQuickActionOpen} />

      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#121316] border-r border-white/10 transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static flex flex-col ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hotel-gold to-amber-700 flex items-center justify-center font-serif font-black text-black text-sm shrink-0 shadow-sm">
              Y
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-serif text-sm tracking-widest text-hotel-gold uppercase font-bold">
                  YES HOTELS
                </span>
                <span className="text-[10px] text-zinc-400 tracking-wider uppercase">
                  Hotel Operating System
                </span>
              </div>
            )}
          </Link>
          <div className="flex items-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-white/5 transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Quick Action in Sidebar */}
        {!collapsed && (
          <div className="p-3 border-b border-white/5">
            <button
              onClick={() => setQuickActionOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-hotel-gold/10 hover:bg-hotel-gold/20 text-hotel-gold border border-hotel-gold/30 text-xs font-semibold tracking-wide transition shadow-xs"
            >
              <Plus size={14} /> Quick Operation
            </button>
          </div>
        )}

        {/* Navigation Modules */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
          {filteredSections.map((section) => {
            const isOpen = openSections[section.title] ?? true;

            return (
              <div key={section.title} className="space-y-1">
                {!collapsed && (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition"
                  >
                    <span>{section.title}</span>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                )}

                {(collapsed || isOpen) && (
                  <div className="space-y-0.5">
                    {section.items.map(({ label, to, icon: Icon, badge }) => {
                      const active = location.pathname === to;

                      return (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setSidebarOpen(false)}
                          title={collapsed ? label : undefined}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            active
                              ? "bg-hotel-gold/15 text-hotel-gold border border-hotel-gold/30 shadow-xs font-semibold"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          } ${collapsed ? "justify-center px-2" : ""}`}
                        >
                          <Icon size={16} className={`shrink-0 ${active ? "text-hotel-gold" : "text-zinc-400"}`} />
                          {!collapsed && <span className="truncate flex-1">{label}</span>}
                          {!collapsed && badge && (
                            <span className="text-[10px] bg-hotel-gold/20 text-hotel-gold px-1.5 py-0.5 rounded font-bold">
                              {badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-white/10 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-xs text-hotel-gold shrink-0">
              {user?.firstName?.[0] || "U"}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-[10px] text-hotel-gold font-mono">{userRole}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            title="Sign Out"
            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d0e]">
        {/* Universal Topbar */}
        <header className="sticky top-0 z-30 bg-[#121316]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
          {/* Left: Mobile Toggle, Property & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1 text-zinc-400 hover:text-white"
            >
              <MenuIcon size={20} />
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="font-semibold text-hotel-gold flex items-center gap-1">
                  <Building2 size={12} /> YES HOTELS Hyderabad
                </span>
                <span>/</span>
                <span className="truncate">{title || "Command Center"}</span>
              </div>
              <h1 className="font-serif font-bold text-base sm:text-lg text-white truncate">
                {title || "Hotel Command Center"}
              </h1>
            </div>
          </div>

          {/* Center: Command Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-400 transition"
            >
              <div className="flex items-center gap-2">
                <Search size={14} className="text-zinc-400" />
                <span>Quick search (guest, room, booking, folio)...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300 font-mono">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right: Operational Status, Alerts, Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Business Date Pill */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>BD: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => setQuickActionOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hotel-gold text-black hover:bg-champagne transition text-xs font-bold shadow-sm"
            >
              <Plus size={14} /> Action
            </button>

            {/* Command Search Mobile Icon */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
              title="Search"
            >
              <Search size={18} />
            </button>

            {/* Operational Alerts Bell */}
            <button
              onClick={() => setNotificationOpen(true)}
              className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
              title="Operational Alerts"
            >
              <Bell size={18} />
              {totalBadgeCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#121316]" />
              )}
            </button>

            {/* User Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-hotel-gold/30 to-amber-700/30 border border-hotel-gold/40 flex items-center justify-center font-serif font-bold text-xs text-hotel-gold">
                {user?.firstName?.[0] || "A"}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
