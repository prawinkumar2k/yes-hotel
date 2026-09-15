import { useState, useEffect } from "react";
import { UtensilsCrossed, Plus, RefreshCw, Search, EyeOff, Eye, Pencil, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";

const CATEGORIES = ["BEVERAGE", "STARTER", "MAIN_COURSE", "BREAD", "RICE_BIRYANI", "DESSERT", "SNACK", "OTHER"] as const;
const FOOD_TYPES = ["VEG", "NON_VEG", "EGG", "VEGAN"] as const;

interface MenuItem {
  _id: string;
  name: string;
  sku: string;
  category: (typeof CATEGORIES)[number];
  description?: string;
  price: number;
  taxRatePercent: number;
  foodType: (typeof FOOD_TYPES)[number];
  isAvailable: boolean;
  isActive: boolean;
  kdsStation?: string;
  displayOrder: number;
}

const getAuthHeaders = () => {
  const token = getStoredAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const emptyForm = {
  name: "", sku: "", category: "MAIN_COURSE" as (typeof CATEGORIES)[number],
  description: "", price: "", taxRatePercent: "5", foodType: "VEG" as (typeof FOOD_TYPES)[number],
  kdsStation: "",
};

export default function AdminMenu() {
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/menu?includeInactive=true", { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setItems(data.data);
    } catch {
      toast({ title: "Error", description: "Failed to load menu", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingId(item._id);
    setForm({
      name: item.name, sku: item.sku, category: item.category,
      description: item.description || "", price: String(item.price),
      taxRatePercent: String(item.taxRatePercent), foodType: item.foodType,
      kdsStation: item.kdsStation || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category: form.category,
        description: form.description || undefined,
        price: Number(form.price),
        taxRatePercent: Number(form.taxRatePercent),
        foodType: form.foodType,
        kdsStation: form.kdsStation || undefined,
      };
      const url = editingId ? `/api/menu/${editingId}` : "/api/menu";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: editingId ? "Menu Item Updated" : "Menu Item Created", description: form.name });
        setShowModal(false);
        fetchItems();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: MenuItem) => {
    const res = await fetch(`/api/menu/${item._id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    const data = await res.json();
    if (data.success) {
      toast({ title: item.isActive ? "Item Disabled" : "Item Enabled", description: item.name });
      fetchItems();
    }
  };

  const toggleAvailable = async (item: MenuItem) => {
    const res = await fetch(`/api/menu/${item._id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    const data = await res.json();
    if (data.success) fetchItems();
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="text-hotel-gold" size={24} />
            Menu Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">The restaurant catalog POS orders are priced from — never edit prices anywhere but here</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchItems} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-hotel-gold hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> New Menu Item
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-hotel-gold focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-gray-900">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">Tax</th>
              <th className="text-center px-4 py-3">Type</th>
              <th className="text-center px-4 py-3">Available</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No menu items found.</td></tr>
            ) : filtered.map(item => (
              <tr key={item._id} className={!item.isActive ? "opacity-50" : ""}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.category.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-right font-semibold">₹{item.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{item.taxRatePercent}%</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${item.foodType === "VEG" || item.foodType === "VEGAN" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {item.foodType.replace("_", "-")}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleAvailable(item)} title={item.isAvailable ? "Mark 86'd (out of stock today)" : "Mark back in stock"}>
                    {item.isAvailable ? <Eye size={16} className="text-emerald-600 mx-auto" /> : <EyeOff size={16} className="text-orange-500 mx-auto" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(item)}
                    className={`text-xs px-2 py-1 rounded font-semibold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {item.isActive ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-hotel-gold">
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? "Edit Menu Item" : "New Menu Item"}</h3>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Item Name</label>
                  <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="Paneer Tikka" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">SKU / Code</label>
                  <input required type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="MAIN-001" disabled={!!editingId} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })} className="w-full border p-2 rounded-lg">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Price (₹)</label>
                  <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Tax Rate (%)</label>
                  <input required type="number" min="0" max="100" step="0.01" value={form.taxRatePercent} onChange={e => setForm({ ...form, taxRatePercent: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Food Type</label>
                  <select value={form.foodType} onChange={e => setForm({ ...form, foodType: e.target.value as any })} className="w-full border p-2 rounded-lg">
                    {FOOD_TYPES.map(t => <option key={t} value={t}>{t.replace("_", "-")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">KDS Station</label>
                  <input type="text" value={form.kdsStation} onChange={e => setForm({ ...form, kdsStation: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="GRILL, BEVERAGE..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border p-2 rounded-lg" rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-hotel-gold text-white rounded-lg font-semibold">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
