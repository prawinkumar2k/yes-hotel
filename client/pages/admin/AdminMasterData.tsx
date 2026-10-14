import { Link } from "react-router-dom";
import {
  Building2, BedDouble, Wind, Maximize, PaintBucket,
  CreditCard, Tag, Landmark, ShieldCheck,
} from "lucide-react";

// Every card opens a working page. Buildings / wings are recorded on each floor (Floors page).
const MASTER_MODULES = [
  { group: "Property & Infrastructure", items: [
    { name: "Properties", icon: Building2, path: "/admin/multi-property", desc: "Hotel properties: name, address, GSTIN, contact" },
    { name: "Floors", icon: Maximize, path: "/admin/master-data/floors", desc: "Property floors, with their building / wing" },
  ]},
  { group: "Rooms & Inventory", items: [
    { name: "Room Categories", icon: BedDouble, path: "/admin/room-categories", desc: "Room types, base rates and capacities" },
    { name: "Physical Rooms", icon: BedDouble, path: "/admin/rooms", desc: "Actual rooms and their status" },
    { name: "Bed Types", icon: BedDouble, path: "/admin/master-data/bed-types", desc: "Bed configurations" },
    { name: "Amenities", icon: Wind, path: "/admin/master-data/amenities", desc: "Room and hotel amenities" },
    { name: "Room Views", icon: PaintBucket, path: "/admin/master-data/room-views", desc: "View options" },
  ]},
  { group: "Rates & Financials", items: [
    { name: "Rate Plans", icon: Tag, path: "/admin/rate-plans", desc: "Pricing multipliers and plans" },
    { name: "Pricing Rules", icon: Tag, path: "/admin/pricing", desc: "Dynamic pricing rules" },
    { name: "Payment Channels", icon: CreditCard, path: "/admin/settings/payment-channels", desc: "Payment modes and gateways" },
    { name: "Taxes & Fees", icon: Landmark, path: "/admin/settings", desc: "Tax slabs (GST) in settings" },
  ]},
  { group: "Security & Users", items: [
    { name: "Staff & Permissions", icon: ShieldCheck, path: "/admin/staff", desc: "Staff logins and roles" },
  ]},
];

export default function AdminMasterData() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">Master Data Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">The core lists the hotel runs on. Changes here affect the whole property.</p>
      </div>

      {MASTER_MODULES.map((group) => (
        <div key={group.group}>
          <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">{group.group}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.name} to={item.path} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition group flex items-start gap-4">
                  <div className="bg-amber-50 p-3 rounded-lg group-hover:bg-amber-100 transition-colors">
                    <Icon className="text-amber-700" size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">{item.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
