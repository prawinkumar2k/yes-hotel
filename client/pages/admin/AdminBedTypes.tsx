import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";

export default function AdminBedTypes() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const qc = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const canEdit = hasPermission("SETTINGS", "EDIT");
  const canCreate = hasPermission("SETTINGS", "CREATE");
  const canDelete = hasPermission("SETTINGS", "DELETE");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    capacity: 2,
    description: "",
    displayOrder: 0,
    isActive: true,
  });

  const { data: bedTypes, isLoading } = useQuery({
    queryKey: ["adminBedTypes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/master-data/bed-types", { headers: { Authorization: `Bearer ${user?.token}` } });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingItem ? `/api/admin/master-data/bed-types/${editingItem._id}` : `/api/admin/master-data/bed-types`;
      const method = editingItem ? "PATCH" : "POST";
      const payload = {
        name: data.name,
        code: data.code.toUpperCase(),
        capacity: Number(data.capacity),
        description: data.description,
        displayOrder: Number(data.displayOrder),
        isActive: data.isActive,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["adminBedTypes"] });
        toast({ title: "Success", description: "Bed Type saved successfully." });
        closeModal();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/master-data/bed-types/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["adminBedTypes"] });
        toast({ title: "Success", description: data.message });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const openModal = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        code: item.code,
        capacity: item.capacity || 2,
        description: item.description || "",
        displayOrder: item.displayOrder || 0,
        isActive: item.isActive,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        code: "",
        capacity: 2,
        description: "",
        displayOrder: 0,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-hotel-black text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/dashboard" className="font-serif text-lg text-hotel-gold uppercase tracking-widest">YES HOTELS</Link>
        <span className="text-white/30">/</span>
        <Link to="/admin/master-data" className="text-white/70 hover:text-white text-sm">Master Data</Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Bed Types</span>
      </div>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bed Types Master</h1>
            <p className="text-sm text-gray-500 mt-1">Manage bed configurations and base sleeping capacity.</p>
          </div>
          {canCreate && (
            <button onClick={() => openModal()} className="flex items-center gap-2 bg-hotel-gold text-hotel-black px-4 py-2 rounded font-medium hover:bg-yellow-500 transition-colors">
              <Plus size={18} /> Add Bed Type
            </button>
          )}
        </div>
        <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Code", "Name", "Capacity", "Order", "Status", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(5).fill(0).map((_,i) => (
                  <tr key={i}>{Array(6).fill(0).map((_,j) => <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : (bedTypes ?? []).map((item: any) => (
                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-bold text-gray-800">{item.code}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-5 py-3 text-gray-600">{item.capacity} Adults</td>
                  <td className="px-5 py-3 text-gray-600">{item.displayOrder}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 flex items-center gap-3">
                    {canEdit && (
                      <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-800" title="Edit">
                        <Edit size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => { if(confirm("Delete this bed type? Deactivated if in use.")) deleteMutation.mutate(item._id); }} className="text-red-600 hover:text-red-800" title="Delete">
                        {deleteMutation.isPending && deleteMutation.variables === item._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!isLoading && bedTypes?.length === 0) && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No bed types found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">{editingItem ? "Edit Bed Type" : "New Bed Type"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. King Bed" className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="e.g. KING" className="w-full border border-gray-300 rounded px-3 py-2 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-hotel-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity <span className="text-red-500">*</span></label>
                  <input type="number" required min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input type="number" value={formData.displayOrder} onChange={e => setFormData({...formData, displayOrder: Number(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded text-hotel-gold focus:ring-hotel-gold" />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active (Visible in UI)</label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="bg-hotel-black text-white px-6 py-2 rounded font-medium hover:bg-hotel-black/90 disabled:opacity-50 flex items-center gap-2">
                  {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
