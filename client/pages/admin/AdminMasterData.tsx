import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import { 
  Settings, Building2, BedDouble, 
  MapPin, Wind, Maximize, PaintBucket, 
  CreditCard, Tag, Landmark, ShieldCheck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const MASTER_MODULES = [
  { group: "Property & Infrastructure", items: [
    { name: "Properties", icon: Building2, path: "/admin/master-data/properties", desc: "Manage physical hotel properties", countQuery: "properties" },
    { name: "Buildings & Wings", icon: MapPin, path: "/admin/master-data/buildings", desc: "Manage building wings/blocks", countQuery: "buildings" },
    { name: "Floors", icon: Maximize, path: "/admin/master-data/floors", desc: "Manage property floors", countQuery: "floors" },
  ]},
  { group: "Rooms & Inventory", items: [
    { name: "Room Categories", icon: BedDouble, path: "/admin/room-categories", desc: "Manage room types and base capacities", countQuery: "categories" },
    { name: "Physical Rooms", icon: BedDouble, path: "/admin/rooms", desc: "Manage actual rooms and status", countQuery: "rooms" },
    { name: "Bed Types", icon: BedDouble, path: "/admin/master-data/bed-types", desc: "Manage bed configurations", countQuery: "bedTypes" },
    { name: "Amenities", icon: Wind, path: "/admin/master-data/amenities", desc: "Manage room & hotel amenities", countQuery: "amenities" },
    { name: "Room Views", icon: PaintBucket, path: "/admin/master-data/room-views", desc: "Manage scenic view options", countQuery: "roomViews" },
  ]},
  { group: "Rates & Financials", items: [
    { name: "Rate Plans", icon: Tag, path: "/admin/rate-plans", desc: "Manage pricing multipliers and plans", countQuery: "ratePlans" },
    { name: "Pricing Rules", icon: Tag, path: "/admin/pricing", desc: "Manage dynamic pricing rules", countQuery: "pricingRules" },
    { name: "Payment Channels", icon: CreditCard, path: "/admin/settings/payment-channels", desc: "Manage payment gateways and modes", countQuery: "paymentChannels" },
    { name: "Taxes & Fees", icon: Landmark, path: "/admin/settings", desc: "Manage tax slabs (GST) in settings", countQuery: null },
  ]},
  { group: "Security & Users", items: [
    { name: "Staff & Permissions", icon: ShieldCheck, path: "/admin/staff", desc: "Manage staff roles and access", countQuery: "staff" },
  ]}
];

export default function AdminMasterData() {
  const { user } = useAuth();
  
  // Example query to fetch summary stats
  const { data: stats } = useQuery({
    queryKey: ["masterDataStats"],
    queryFn: async () => {
      // In a real implementation, you might have an endpoint for these aggregate counts.
      // For now, we will just use placeholders or fetch what we can.
      return {
        categories: 0,
        rooms: 0,
        floors: 0,
        amenities: 0,
        ratePlans: 0,
      };
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-hotel-black text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/dashboard" className="font-serif text-lg text-hotel-gold uppercase tracking-widest">YES HOTELS</Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Master Data Management</span>
      </div>
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Master Data Configuration</h1>
          <p className="text-gray-600 mt-2">Manage the core underlying data structures for the hotel operating system. These changes affect the entire property.</p>
        </div>

        <div className="space-y-8">
          {MASTER_MODULES.map(group => (
            <div key={group.group}>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">{group.group}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.name} to={item.path} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow group flex items-start gap-4">
                      <div className="bg-amber-50 p-3 rounded-lg group-hover:bg-amber-100 transition-colors">
                        <Icon className="text-amber-700" size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-amber-700 transition-colors">{item.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
