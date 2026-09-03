import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard, CalendarDays, BedDouble, Users, CreditCard,
  BarChart3, Settings, Home, Wrench, LogOut, MenuIcon, X, Mail,
  Image, HelpCircle, MessageSquare, FileText, Star, Ticket, RotateCcw, ScrollText,
} from "lucide-react";

const ADMIN_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];
const STAFF_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"];

const NAV_ITEMS = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, roles: ADMIN_ROLES },
  { label: "Bookings", to: "/admin/bookings", icon: CalendarDays, roles: ADMIN_ROLES },
  { label: "Calendar", to: "/admin/calendar", icon: CalendarDays, roles: ADMIN_ROLES },
  { label: "Check-In", to: "/admin/check-in", icon: Home, roles: ADMIN_ROLES },
  { label: "Check-Out", to: "/admin/check-out", icon: LogOut, roles: ADMIN_ROLES },
  { label: "Rooms", to: "/admin/rooms", icon: BedDouble, roles: ADMIN_ROLES },
  { label: "Room Categories", to: "/admin/room-categories", icon: BedDouble, roles: ["ADMIN", "MANAGER"] },
  { label: "Pricing", to: "/admin/pricing", icon: CreditCard, roles: ["ADMIN", "MANAGER"] },
  { label: "Guests", to: "/admin/guests", icon: Users, roles: ADMIN_ROLES },
  { label: "Payments", to: "/admin/payments", icon: CreditCard, roles: ["ADMIN", "MANAGER"] },
  { label: "Refunds", to: "/admin/refunds", icon: RotateCcw, roles: ["ADMIN", "MANAGER"] },
  { label: "Coupons", to: "/admin/coupons", icon: Ticket, roles: ["ADMIN", "MANAGER"] },
  { label: "Housekeeping", to: "/admin/housekeeping", icon: Home, roles: STAFF_ROLES },
  { label: "Maintenance", to: "/admin/maintenance", icon: Wrench, roles: STAFF_ROLES },
  { label: "Staff", to: "/admin/staff", icon: Users, roles: ["ADMIN", "MANAGER"] },
  { label: "Gallery", to: "/admin/gallery", icon: Image, roles: ["ADMIN", "MANAGER"] },
  { label: "FAQs", to: "/admin/faqs", icon: HelpCircle, roles: ["ADMIN", "MANAGER"] },
  { label: "Testimonials", to: "/admin/testimonials", icon: MessageSquare, roles: ["ADMIN", "MANAGER"] },
  { label: "Reviews", to: "/admin/reviews", icon: Star, roles: ["ADMIN", "MANAGER"] },
  { label: "Content", to: "/admin/content", icon: FileText, roles: ["ADMIN"] },
  { label: "Contact Messages", to: "/admin/contact-messages", icon: Mail, roles: ["ADMIN", "MANAGER"] },
  { label: "Reports", to: "/admin/reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
  { label: "Audit Logs", to: "/admin/audit-logs", icon: ScrollText, roles: ["ADMIN", "MANAGER"] },
  { label: "Settings", to: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
];

export default function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => !user?.role || item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-hotel-black text-white transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto flex flex-col`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <Link to="/" className="font-serif text-lg tracking-widest text-hotel-gold uppercase">YES HOTELS</Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 text-xs font-semibold text-white/30 uppercase tracking-widest mt-2">Management</div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {visibleItems.map(({ label, to, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                  active ? "bg-white/10 text-hotel-gold" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors w-full"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500">
              <MenuIcon size={20} />
            </button>
            {title && <h1 className="font-semibold text-gray-800 text-lg">{title}</h1>}
          </div>
          <div className="text-sm text-gray-500">
            {user?.firstName} {user?.lastName} · <span className="text-hotel-gold font-medium">{user?.role}</span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
