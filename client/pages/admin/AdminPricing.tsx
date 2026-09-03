import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";

export default function AdminPricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    roomCategory: "",
    type: "BASE",
    startDate: "",
    endDate: "",
    price: 0,
    priority: 0,
    isActive: true,
  });

  const { data: categories } = useQuery({
    queryKey: ["adminRoomCategories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/room-categories", { headers: { Authorization: `Bearer ${user?.token}` } });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["adminPricingRules"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pricing", { headers: { Authorization: `Bearer ${user?.token}` } });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingRule ? `/api/admin/pricing/${editingRule._id}` : `/api/admin/pricing`;
      const method = editingRule ? "PATCH" : "POST";
      
      const payload: any = {
        name: data.name,
        roomCategory: data.roomCategory,
        type: data.type,
        price: Number(data.price),
        priority: Number(data.priority),
        isActive: data.isActive,
      };

      if (data.startDate) payload.startDate = data.startDate;
      if (data.endDate) payload.endDate = data.endDate;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["adminPricingRules"] });
        toast({ title: "Success", description: "Pricing rule saved successfully." });
        closeModal();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/pricing/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["adminPricingRules"] });
        toast({ title: "Success", description: data.message });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const openModal = (rule: any = null) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        roomCategory: rule.roomCategory._id,
        type: rule.type,
        startDate: rule.startDate ? new Date(rule.startDate).toISOString().split('T')[0] : "",
        endDate: rule.endDate ? new Date(rule.endDate).toISOString().split('T')[0] : "",
        price: rule.price,
        priority: rule.priority,
        isActive: rule.isActive,
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: "", roomCategory: categories?.[0]?._id || "", type: "BASE",
        startDate: "", endDate: "", price: 0, priority: 0, isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-hotel-black text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/dashboard" className="font-serif text-lg text-hotel-gold uppercase tracking-widest">YES HOTELS</Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Pricing Rules</span>
      </div>
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Pricing Engine</h1>
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-hotel-gold text-hotel-black px-4 py-2 rounded font-medium hover:bg-yellow-500 transition-colors">
            <Plus size={18} /> Add Rule
          </button>
        </div>

        <div className="bg-white rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name", "Category", "Type", "Price", "Priority", "Status", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(4).fill(0).map((_,i) => (
                  <tr key={i}>{Array(7).fill(0).map((_,j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : rules?.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">No pricing rules found.</td></tr>
              ) : rules?.map((rule: any) => (
                <tr key={rule._id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-800">{rule.name}</td>
                  <td className="px-5 py-4 text-gray-500">{rule.roomCategory?.name || "—"}</td>
                  <td className="px-5 py-4">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">{rule.type}</span>
                  </td>
                  <td className="px-5 py-4 font-medium">₹{rule.price}</td>
                  <td className="px-5 py-4 text-gray-500">{rule.priority}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${rule.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 flex items-center gap-3">
                    <button onClick={() => openModal(rule)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => { if(confirm("Delete rule?")) deleteMutation.mutate(rule._id); }} className="text-red-600 hover:text-red-800">
                      {deleteMutation.isPending && deleteMutation.variables === rule._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">{editingRule ? "Edit Rule" : "New Rule"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(formData); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select required value={formData.roomCategory} onChange={e => setFormData({...formData, roomCategory: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold">
                    <option value="">Select Category</option>
                    {categories?.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold">
                    <option value="BASE">Base Price</option>
                    <option value="WEEKEND">Weekend Price</option>
                    <option value="SEASONAL">Seasonal Price</option>
                    <option value="PROMO">Promotional Price</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (Optional)</label>
                  <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Optional)</label>
                  <input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                  <input type="number" required min="0" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input type="number" required min="0" value={formData.priority} onChange={e => setFormData({...formData, priority: Number(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold" />
                  <p className="text-xs text-gray-500 mt-1">Higher priority overrides lower.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={formData.isActive ? "true" : "false"} onChange={e => setFormData({...formData, isActive: e.target.value === "true"})} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-hotel-gold">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="bg-hotel-black text-white px-6 py-2 rounded font-medium hover:bg-hotel-black/90 disabled:opacity-50 flex items-center gap-2">
                  {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
