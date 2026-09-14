import { useState, useEffect } from "react";
import { Truck, Plus, RefreshCw, Star, CheckCircle, XCircle, Search, Mail, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Vendor {
  _id: string;
  vendorCode: string;
  name: string;
  gstin?: string;
  contactPerson: string;
  email: string;
  phone: string;
  paymentTerms: string;
  rating: number;
  isActive: boolean;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AdminVendors() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [saving, setSaving] = useState(false);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendors", { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setVendors(data.data);
    } catch {
      toast({ title: "Error", description: "Failed to load vendor directory", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, gstin, contactPerson, email, phone, paymentTerms }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Vendor Registered", description: `${name} added to vendor database` });
        setShowModal(false);
        setName(""); setGstin(""); setContactPerson(""); setEmail(""); setPhone("");
        fetchVendors();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
    v.contactPerson.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="text-emerald-600" size={24} />
            Vendor & Supplier Directory
          </h2>
          <p className="text-sm text-gray-500 mt-1">Manage vendor contracts, GSTIN details, and procurement terms</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Register Vendor
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search vendor by name, code, contact..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(vendor => (
          <div key={vendor._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs text-gray-400 font-bold">{vendor.vendorCode}</span>
                <h3 className="text-base font-bold text-gray-900 leading-snug">{vendor.name}</h3>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                <Star size={12} className="fill-amber-500 text-amber-500" /> {vendor.rating}.0
              </span>
            </div>

            {vendor.gstin && (
              <div className="text-xs text-gray-500 font-mono">
                GSTIN: <span className="text-gray-800 font-medium">{vendor.gstin}</span>
              </div>
            )}

            <div className="space-y-1 text-xs text-gray-600 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Mail size={12} className="text-gray-400" /> {vendor.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone size={12} className="text-gray-400" /> {vendor.phone} ({vendor.contactPerson})
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs border-t border-gray-100">
              <span className="text-gray-500">Terms: <strong className="text-gray-800">{vendor.paymentTerms}</strong></span>
              <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded">Active Supplier</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Register New Vendor</h3>
            <form onSubmit={handleCreateVendor} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Company / Vendor Name</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="Amul Fresh Dairy Co." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">GSTIN Number</label>
                <input type="text" value={gstin} onChange={e => setGstin(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="24AAACA0000A1Z5" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Contact Person</label>
                  <input required type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="Ramesh Patel" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Payment Terms</label>
                  <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="Net 30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email</label>
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="vendor@domain.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone</label>
                  <input required type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="+91 98200 11223" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold">{saving ? "Saving..." : "Save Vendor"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
