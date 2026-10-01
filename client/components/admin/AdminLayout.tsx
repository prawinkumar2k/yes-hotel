import React, { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
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
  pageKey: string;
  badge?: string | number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}



export default function AdminLayout({ children, title, hidePadding }: { children: ReactNode; title?: string; hidePadding?: boolean }) {
  const { user, logout } = useAuth();
  const { hasPageAccess } = usePermissions();
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
    "FRONT DESK & GUESTS": true,
    "CLEANING & ROOMS": true,
    "MAINTENANCE & REPAIRS": true,
    "RESTAURANT & FOOD BILLING": true,
    "ACCOUNTS & MONEY": true,
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
    enabled: hasPageAccess("FRONT_DESK"),
    refetchInterval: 45000,
  });

  const arrivalsCount = frontDeskSummary?.counts?.arrivals || 0;
  const departuresCount = frontDeskSummary?.counts?.departures || 0;
  const dirtyCount = frontDeskSummary?.counts?.dirtyRooms || 0;
  const inHouseCount = frontDeskSummary?.counts?.inHouse || 0;

  // New chatbot-collected enquiries awaiting front-desk follow-up
  const { data: newEnquiriesData } = useQuery({
    queryKey: ["sidebarNewEnquiries"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/admin/booking-enquiries?status=NEW&limit=1", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: hasPageAccess("FRONT_DESK"),
    refetchInterval: 45000,
  });
  const newEnquiriesCount = newEnquiriesData?.total || 0;

  const NAV_SECTIONS: NavSection[] = [
    {
      title: "MAIN",
      items: [
        { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, pageKey: "DASHBOARD.ADMIN" },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        { label: "Front Desk", to: "/admin/front-desk", icon: Home, pageKey: "FRONT_DESK", badge: arrivalsCount > 0 ? arrivalsCount : undefined },
        { label: "Rooms", to: "/admin/rooms", icon: BedDouble, pageKey: "ROOMS" },
        { label: "Reservations", to: "/admin/bookings", icon: CalendarDays, pageKey: "BOOKINGS" },
        { label: "Guests", to: "/admin/guests", icon: Users, pageKey: "GUESTS" },
        { label: "Housekeeping", to: "/admin/housekeeping", icon: Sparkles, pageKey: "HOUSEKEEPING", badge: dirtyCount > 0 ? dirtyCount : undefined },
        { label: "Maintenance", to: "/admin/maintenance", icon: Wrench, pageKey: "MAINTENANCE" },
      ],
    },
    {
      title: "MONEY",
      items: [
        { label: "Guest Bills", to: "/admin/accounting", icon: FileText, pageKey: "ACCOUNTING" },
        { label: "Payments", to: "/admin/payments", icon: CreditCard, pageKey: "PAYMENTS" },
        { label: "Advance Payments", to: "/admin/advances", icon: CreditCard, pageKey: "ADVANCES" },
        { label: "Cashier", to: "/admin/cashier-shifts", icon: DollarSign, pageKey: "CASHIER_SHIFTS" },
        { label: "Reports", to: "/admin/reports", icon: BarChart3, pageKey: "REPORTS_LAYOUT" },
      ],
    },
    {
      title: "STOCK",
      items: [
        { label: "Inventory", to: "/admin/inventory", icon: Package, pageKey: "INVENTORY" },
        { label: "Purchasing", to: "/admin/procurement", icon: ShoppingBag, pageKey: "PROCUREMENT" },
        { label: "Suppliers", to: "/admin/vendors", icon: Truck, pageKey: "VENDORS" },
      ],
    },
    {
      title: "BUSINESS",
      items: [
        { label: "Corporate Accounts", to: "/admin/corporate-accounts", icon: Building2, pageKey: "CORPORATE_ACCOUNTS" },
        { label: "Groups & Events", to: "/admin/group-bookings", icon: Users, pageKey: "GROUP_BOOKINGS" },
        { label: "Coupons", to: "/admin/coupons", icon: Tag, pageKey: "COUPONS" },
      ],
    },
    {
      title: "CONTROL",
      items: [
        { label: "Approvals", to: "/admin/task-approvals", icon: ShieldCheck, pageKey: "TASK_APPROVALS", badge: "Pending" },
        { label: "Staff & Permissions", to: "/admin/staff", icon: Users, pageKey: "STAFF" },
        { label: "Audit History", to: "/admin/audit-logs", icon: ScrollText, pageKey: "AUDIT_LOGS" },
        { label: "Hotel Settings", to: "/admin/settings", icon: Settings, pageKey: "SETTINGS" },
      ],
    },
  ];

  // Filter sections and items based on effective permissions
  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPageAccess(item.pageKey)),
  })).filter((section) => section.items.length > 0);

  const totalBadgeCount = (arrivalsCount > 0 ? 1 : 0) + (departuresCount > 0 ? 1 : 0) + (dirtyCount > 0 ? 1 : 0);

  return (
    <div className="admin-panel h-screen overflow-hidden bg-slate-50 text-slate-800 flex selection:bg-hotel-gold selection:text-black">
      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Operational Alerts Drawer */}
      <NotificationCenter open={notificationOpen} onClose={() => setNotificationOpen(false)} />

      {/* Quick Action Modal */}
      <QuickActionModal open={quickActionOpen} onOpenChange={setQuickActionOpen} />

      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 shadow-sm transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static flex flex-col ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hotel-gold to-amber-700 flex items-center justify-center font-serif font-black text-black text-sm shrink-0 shadow-sm">
              Y
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-serif text-sm tracking-widest text-black uppercase font-bold">
                  YES HOTELS
                </span>
                <span className="text-[10px] text-slate-700 tracking-wider uppercase font-semibold">
                  Hotel Operating System
                </span>
              </div>
            )}
          </Link>
          <div className="flex items-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 text-slate-700 hover:text-black rounded-md hover:bg-slate-200 transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-700 hover:text-black"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Quick Action in Sidebar */}
        {!collapsed && (
          <div className="p-3 border-b border-slate-200">
            <button
              onClick={() => setQuickActionOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-100 hover:bg-amber-200 text-black border border-amber-300 text-xs font-bold tracking-wide transition shadow-xs"
            >
              <Plus size={14} className="text-black" /> Quick Operation
            </button>
          </div>
        )}

        {/* Navigation Modules */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-4">
          {filteredSections.map((section) => {
            const isOpen = openSections[section.title] ?? true;

            return (
              <div key={section.title} className="space-y-1">
                {!collapsed && (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-900 hover:text-black transition"
                  >
                    <span>{section.title}</span>
                    {isOpen ? <ChevronDown size={12} className="text-slate-900" /> : <ChevronRight size={12} className="text-slate-900" />}
                  </button>
                )}

                {(collapsed || isOpen) && (
                  <div className="space-y-0.5">
                    {section.items.map(({ label, to, icon: Icon, badge }) => {
                      const active = location.pathname === to;

                      return (
                        <Link
                          key={label}
                          to={to}
                          onClick={() => setSidebarOpen(false)}
                          title={collapsed ? label : undefined}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                            active
                              ? "bg-amber-100 text-black border border-amber-300 shadow-xs font-bold"
                              : "text-slate-900 hover:text-black hover:bg-slate-100 font-semibold"
                          } ${collapsed ? "justify-center px-2" : ""}`}
                        >
                          <Icon size={16} className={`shrink-0 ${active ? "text-amber-800" : "text-slate-700"}`} />
                          {!collapsed && <span className="truncate flex-1">{label}</span>}
                          {!collapsed && badge && (
                            <span className="text-[10px] bg-amber-200 text-black px-1.5 py-0.5 rounded font-bold border border-amber-300">
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
        <div className="p-3 border-t border-slate-200 bg-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-amber-200 border border-amber-300 flex items-center justify-center font-bold text-xs text-black shrink-0">
              {user?.firstName?.[0] || "U"}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-[10px] text-black font-bold font-mono uppercase">{user?.role || "GUEST"}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Universal Topbar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
          {/* Left: Mobile Toggle, Property & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-700"
            >
              <MenuIcon size={20} />
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="font-semibold text-hotel-gold-text flex items-center gap-1">
                  <Building2 size={12} /> YES HOTELS Hyderabad
                </span>
                <span>/</span>
                <span className="truncate text-slate-500">{title || "Command Center"}</span>
              </div>
              <h1 className="font-serif font-bold text-base sm:text-lg text-slate-800 truncate">
                {title || "Hotel Command Center"}
              </h1>
            </div>
          </div>

          {/* Center: Command Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs text-slate-400 transition"
            >
              <div className="flex items-center gap-2">
                <Search size={14} className="text-slate-400" />
                <span>Quick search (guest, room, booking, folio)...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-200 text-[10px] text-slate-500 font-mono">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right: Operational Status, Alerts, Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Business Date Pill */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Search"
            >
              <Search size={18} />
            </button>

            {/* Operational Alerts Bell */}
            <button
              onClick={() => setNotificationOpen(true)}
              className="relative p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Operational Alerts"
            >
              <Bell size={18} />
              {totalBadgeCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white" />
              )}
            </button>

            {/* User Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center font-serif font-bold text-xs text-hotel-gold-text">
                {user?.firstName?.[0] || "A"}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className={`flex-1 overflow-auto ${hidePadding ? "" : "p-4 sm:p-6 lg:p-8"}`}>
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (phones & tablets only) ── */}
      <nav className="mobile-bottom-nav items-center justify-around px-2 py-1 safe-area-pb">
        <Link
          to="/admin/dashboard"
          onClick={() => setSidebarOpen(false)}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-bold transition ${location.pathname === "/admin/dashboard" ? "text-amber-700 bg-amber-50" : "text-slate-600"}`}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/admin/front-desk"
          onClick={() => setSidebarOpen(false)}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-bold transition ${location.pathname === "/admin/front-desk" ? "text-amber-700 bg-amber-50" : "text-slate-600"}`}
        >
          <Home size={20} />
          <span>Front Desk</span>
        </Link>
        <Link
          to="/admin/room-rack"
          onClick={() => setSidebarOpen(false)}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-bold transition ${location.pathname === "/admin/room-rack" ? "text-amber-700 bg-amber-50" : "text-slate-600"}`}
        >
          <BedDouble size={20} />
          <span>Rooms</span>
        </Link>
        <Link
          to="/admin/housekeeping"
          onClick={() => setSidebarOpen(false)}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-bold transition ${location.pathname === "/admin/housekeeping" ? "text-amber-700 bg-amber-50" : "text-slate-600"}`}
        >
          <Sparkles size={20} />
          <span>Cleaning</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-bold text-slate-600 transition"
        >
          <MenuIcon size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
