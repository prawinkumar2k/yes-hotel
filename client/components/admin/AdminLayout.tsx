import React, { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { useStaffRealtime } from "@/hooks/useStaffRealtime";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, CalendarDays, CalendarClock, MessagesSquare, KeyRound, BedDouble, Users, CreditCard,
  BarChart3, Settings, Home, Wrench, LogIn, LogOut, MenuIcon, X,
  Image, HelpCircle, MessageSquare, FileText, Star, Ticket, RotateCcw,
  ScrollText, Moon, DollarSign, Tag, Building2, UtensilsCrossed,
  Package, Truck, ShoppingBag, Landmark, AlertCircle, Monitor, Globe,
  PartyPopper, Sparkles, Search, Bell, Plus, ChevronDown, ChevronRight,
  ShieldCheck, CheckCircle2, SlidersHorizontal, Smartphone, ClipboardCheck, Receipt
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
  /** Manager screens a role should not be sent to from the menu (its own screen covers the job). */
  hideForRoles?: string[];
  /** Hidden when the user can open this page instead (e.g. the executive dashboard). */
  hideIfPage?: string;
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
  const mainRef = useRef<HTMLElement>(null);
  // Every page opens at its top (the content area keeps its own scroll position otherwise).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Expanded sections state (default all open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "FRONT OFFICE": true,
    "RESERVATIONS": true,
    "HOUSEKEEPING & MAINTENANCE": true,
    "CASHIERING": true,
    "MANAGEMENT": true,
    "SYSTEM SETUP": true,
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

  // Verification Queue: tasks waiting to be verified (completed work)
  const { data: verificationCounts } = useQuery({
    queryKey: ["verification-counts"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/verifications/counts", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: hasPageAccess("VERIFICATIONS"),
    refetchInterval: 30000,
  });
  const pendingVerifications = verificationCounts?.pending || 0;

  // Guest change requests (dates / guests) waiting for Reception
  const { data: changeRequestCounts } = useQuery({
    queryKey: ["change-request-counts"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/change-requests/counts", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: hasPageAccess("BOOKINGS"),
    refetchInterval: 60000,
  });
  const pendingChangeRequests = changeRequestCounts?.pending || 0;

  // Live chat: unread / waiting counts, refreshed instantly by real-time events on every staff page
  const canChat = hasPageAccess("ENQUIRIES");
  const { data: chatCounts } = useQuery({
    queryKey: ["live-chat-counts"],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch("/api/chat/staff/counts", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: canChat,
    refetchInterval: 120000,
  });
  const { toast } = useToast();
  // This tab was switched because someone signed in with another account in another tab.
  useEffect(() => {
    let who: string | null = null;
    try { who = sessionStorage.getItem("yes_hotels_switched_to"); sessionStorage.removeItem("yes_hotels_switched_to"); } catch { /* private mode */ }
    if (who) toast({ title: "Signed in with another account", description: `${who} signed in in another tab. All tabs in this browser use the same login; use a different browser (or a private window) for a second person.` });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useStaffRealtime((event, payload) => {
    if (event === "chat:activity") return; // keystrokes: only the Live Chat page uses them
    if (event.startsWith("chat:")) queryClient.invalidateQueries({ queryKey: ["live-chat-counts"] });
    if (event === "enquiry:updated") queryClient.invalidateQueries({ queryKey: ["sidebarNewEnquiries"] });
    // A guest just opened the website chat — tell Reception wherever they are.
    if (event === "chat:presence" && payload?.online && !location.pathname.startsWith("/admin/live-chat")) {
      toast({
        title: "A guest opened the website chat",
        description: <button className="underline" onClick={() => navigate("/admin/live-chat")}>Open Live Chat to see them typing</button>,
      });
    }
  }, () => queryClient.invalidateQueries({ queryKey: ["live-chat-counts"] }), canChat);
  const chatBadge = (chatCounts?.unread || 0) + (chatCounts?.waiting || 0);
  const chatOnline = chatCounts?.online || 0;

  const NAV_SECTIONS: NavSection[] = [
    {
      title: "FRONT OFFICE",
      items: [
        { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, pageKey: "DASHBOARD.ADMIN" },
        { label: "Reception Dashboard", to: "/front-desk/dashboard", icon: LayoutDashboard, pageKey: "DASHBOARD.FRONT_DESK", hideIfPage: "DASHBOARD.ADMIN" },
        { label: "Front Desk (Reception)", to: "/admin/front-desk", icon: Home, pageKey: "FRONT_DESK", badge: arrivalsCount > 0 ? arrivalsCount : undefined },
        { label: "Task Approvals", to: "/admin/task-approvals", icon: ShieldCheck, pageKey: "TASK_APPROVALS" },
        { label: "Room Rack (Tape Chart)", to: "/admin/calendar", icon: CalendarDays, pageKey: "CALENDAR" },
        { label: "Guest Directory", to: "/admin/guests", icon: Users, pageKey: "GUESTS" },
      ],
    },
    {
      title: "RESERVATIONS",
      items: [
        { label: "Enquiries", to: "/admin/enquiries", icon: MessageSquare, pageKey: "ENQUIRIES", badge: newEnquiriesCount > 0 ? newEnquiriesCount : undefined },
        { label: "All Reservations", to: "/admin/bookings", icon: CalendarDays, pageKey: "BOOKINGS" },
        { label: "Guest Change Requests", to: "/admin/change-requests", icon: CalendarClock, pageKey: "BOOKINGS", badge: pendingChangeRequests > 0 ? pendingChangeRequests : undefined },
        { label: "Live Chat", to: "/admin/live-chat", icon: MessagesSquare, pageKey: "ENQUIRIES", badge: chatBadge > 0 ? (chatOnline ? `${chatBadge} · ${chatOnline} online` : chatBadge) : chatOnline ? `${chatOnline} online` : undefined },
        { label: "OTA Bookings", to: "/admin/ota-bookings", icon: Globe, pageKey: "BOOKINGS" },
      ],
    },
    {
      title: "HOUSEKEEPING & MAINTENANCE",
      items: [
        { label: "My Rooms to Clean", to: "/housekeeping/dashboard", icon: Sparkles, pageKey: "DASHBOARD.HOUSEKEEPING", hideForRoles: ["ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST"] },
        { label: "Housekeeping", to: "/admin/housekeeping", icon: Sparkles, pageKey: "HOUSEKEEPING", badge: dirtyCount > 0 ? dirtyCount : undefined, hideForRoles: ["HOUSEKEEPING"] },
        { label: "Maintenance", to: "/admin/maintenance", icon: Wrench, pageKey: "MAINTENANCE" },
        { label: "Rooms Management", to: "/admin/rooms", icon: BedDouble, pageKey: "ROOMS", hideForRoles: ["HOUSEKEEPING"] },
      ],
    },
    {
      title: "CASHIERING",
      items: [
        { label: "Payments & Folios", to: "/admin/payments", icon: CreditCard, pageKey: "PAYMENTS" },
        { label: "Advance Deposits", to: "/admin/advances", icon: CreditCard, pageKey: "ADVANCES" },
        { label: "Cashier Shifts", to: "/admin/cashier-shifts", icon: DollarSign, pageKey: "CASHIER_SHIFTS" },
      ],
    },
    {
      title: "MANAGEMENT",
      items: [
        { label: "Reports & Analytics", to: "/admin/reports", icon: BarChart3, pageKey: "REPORTS_LAYOUT" },
        { label: "Local SEO & Discovery", to: "/admin/seo", icon: Globe, pageKey: "SETTINGS" },
        { label: "Promotions & Offers", to: "/admin/coupons", icon: Tag, pageKey: "COUPONS" },
      ],
    },
    {
      title: "SYSTEM SETUP",
      items: [
        { label: "Master Data", to: "/admin/master-data", icon: Settings, pageKey: "SETTINGS" },
        { label: "User Roles & Rights", to: "/admin/staff", icon: Users, pageKey: "STAFF" },
        { label: "Audit Trail", to: "/admin/audit-logs", icon: ScrollText, pageKey: "AUDIT_LOGS" },
        { label: "Property Settings", to: "/admin/settings", icon: Settings, pageKey: "SETTINGS" },
      ],
    },
  ];

  // Filter sections and items based on effective permissions
  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPageAccess(item.pageKey) && !item.hideForRoles?.includes(user?.role ?? "") && !(item.hideIfPage && hasPageAccess(item.hideIfPage))),
  })).filter((section) => section.items.length > 0);

  const totalBadgeCount = (arrivalsCount > 0 ? 1 : 0) + (departuresCount > 0 ? 1 : 0) + (dirtyCount > 0 ? 1 : 0);

  // Embedded in a pop-up (e.g. the GRC / invoice viewer on Guest Registration): content only, no sidebar.
  if (typeof window !== "undefined" && window.self !== window.top) {
    return <div className="bg-white">{children}</div>;
  }

  return (
    <div className="admin-panel h-screen overflow-hidden bg-slate-50 text-slate-800 flex selection:bg-hotel-gold selection:text-black print:h-auto print:overflow-visible print:bg-white print:block">
      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Operational Alerts Drawer */}
      <NotificationCenter open={notificationOpen} onClose={() => setNotificationOpen(false)} />

      {/* Quick Action Modal */}
      <QuickActionModal open={quickActionOpen} onOpenChange={setQuickActionOpen} />

      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 shadow-sm transform transition-all duration-300 ease-in-out print:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static flex flex-col ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <img src="/brand/yes-mark.png" alt="YES HOTELS" className="w-9 h-9 object-contain shrink-0" />
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
          <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setPasswordOpen(true)}
            title="Change password"
            aria-label="Change password"
            className="min-h-[36px] min-w-[36px] p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition"
          >
            <KeyRound size={15} className="mx-auto" />
          </button>
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
        </div>
      </aside>
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 print:bg-white">
        {/* Universal Topbar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs px-4 py-3 sm:px-6 flex items-center justify-between gap-3 print:hidden">
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
                  <Building2 size={12} /> YES HOTELS Bengaluru
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
          <div className="hidden lg:flex flex-1 min-w-0 max-w-md mx-4">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full min-w-0 overflow-hidden flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs text-slate-400 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search size={14} className="text-slate-400 shrink-0" />
                <span className="truncate whitespace-nowrap">Quick search (guest, room, booking, folio)...</span>
              </div>
              <kbd className="hidden sm:inline-block shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-200 text-[10px] text-slate-500 font-mono">
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

            {/* Prominent Walk-In / Reservation Button */}
            <Link
              to="/admin/guest-registration"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm hover:shadow transition transform active:scale-95"
            >
              <Plus size={15} className="stroke-[2.5]" />
              <span>New Walk-In</span>
            </Link>

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
        <main ref={mainRef} style={{ overflowAnchor: "none" }} className={`flex-1 overflow-auto print:overflow-visible ${hidePadding ? "" : "p-4 sm:p-6 lg:p-8"} print:p-0`}>
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (phones & tablets only) ── */}
      <nav className="mobile-bottom-nav items-center justify-around px-2 py-1 safe-area-pb print:hidden">
        {[
          { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, pageKey: "DASHBOARD.ADMIN" },
          { to: "/housekeeping/dashboard", label: "My Rooms", icon: Sparkles, pageKey: "DASHBOARD.HOUSEKEEPING", only: ["HOUSEKEEPING"] },
          { to: "/admin/front-desk", label: "Front Desk", icon: Home, pageKey: "FRONT_DESK" },
          { to: "/admin/live-chat", label: "Chat", icon: MessagesSquare, pageKey: "ENQUIRIES" },
          { to: "/admin/room-rack", label: "Rooms", icon: BedDouble, pageKey: "ROOM_RACK" },
          { to: "/admin/housekeeping", label: "Cleaning", icon: Sparkles, pageKey: "HOUSEKEEPING", hide: ["HOUSEKEEPING"] },
        ]
          .filter((i: any) => hasPageAccess(i.pageKey) && (!i.only || i.only.includes(user?.role)) && !(i.hide ?? []).includes(user?.role))
          .slice(0, 4)
          .map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={`flex min-h-[44px] flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-bold transition ${location.pathname === to ? "text-amber-700 bg-amber-50" : "text-slate-600"}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex min-h-[44px] flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-bold text-slate-600 transition"
        >
          <MenuIcon size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
