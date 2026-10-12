import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { Loader2, Plus, Edit, Trash2, ShieldAlert } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  OCCUPIED: "bg-red-100 text-red-700",
  RESERVED: "bg-blue-100 text-blue-700",
  CLEANING: "bg-yellow-100 text-yellow-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  OUT_OF_SERVICE: "bg-gray-100 text-gray-500",
  OUT_OF_ORDER: "bg-red-100 text-red-900",
};

const ALL_STATUSES = ["AVAILABLE", "OUT_OF_SERVICE", "OUT_OF_ORDER", "MAINTENANCE"];

export default function AdminRooms() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const qc = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);

  const canEdit = hasPermission("ROOMS", "EDIT");
  const canCreate = hasPermission("ROOMS", "CREATE");
  const canDelete = hasPermission("ROOMS", "DELETE");

  const [formData, setFormData] = useState({
    roomNumber: "",
    category: "",
    floor: "",
    floor_number: 0,
    status: "AVAILABLE",
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["adminRooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms", { headers: { Authorization: `Bearer ${user?.token}` } });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
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

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingRoom ? `/api/rooms/${editingRoom._id}` : `/api/rooms`;
      const method = editingRoom ? "PATCH" : "POST";
      const payload = {
        roomNumber: data.roomNumber,
        category: data.category,
        floor: data.floor,
        floor_number: Number(data.floor_number),
        status: data.status,
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
        qc.invalidateQueries({ queryKey: ["adminRooms"] });
        toast({ title: "Success", description: "Room saved successfully." });
        closeModal();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["adminRooms"] });
        toast({ title: "Success", description: data.message });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const openModal = (room: any = null) => {
    if (room) {
      setEditingRoom(room);
      setFormData({
        roomNumber: room.roomNumber,
        category: room.category?._id || "",
        floor: room.floor,
        floor_number: room.floor_number || 0,
        status: room.status,
      });
    } else {
      setEditingRoom(null);
      setFormData({
        roomNumber: "",
        category: categories?.[0]?._id || "",
        floor: "",
        floor_number: 0,
        status: "AVAILABLE",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
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
        <span className="text-white/70 text-sm">Master Data</span>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Physical Rooms</span>
      </div>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Physical Rooms</h1>
          {canCreate && (
            <button onClick={() => openModal()} className="flex items-center gap-2 bg-hotel-gold text-hotel-black px-4 py-2 rounded font-medium hover:bg-yellow-500 transition-colors">
              <Plus size={18} /> Add Room
            </button>
          )}
        </div>
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Room #","Category","Floor","HK Status","Sell Status","Status","Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(8).fill(0).map((_,i) => (
                  <tr key={i}>{Array(7).fill(0).map((_,j) => <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : (rooms ?? []).map((room: any) => (
                <tr key={room._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-bold text-gray-800">{room.roomNumber}</td>
                  <td className="px-5 py-3 text-gray-600">{room.category?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-600">Floor {room.floor}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-600">{room.housekeepingStatus}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-600">{room.sellStatus}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[room.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 flex items-center gap-3">
                    {canEdit && (
                      <button onClick={() => openModal(room)} className="text-blue-600 hover:text-blue-800" title="Edit">
                        <Edit size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => { if(confirm("Delete this room? Historic bookings will prevent hard deletion.")) deleteMutation.mutate(room._id); }} className="text-red-600 hover:text-red-800" title="Delete">
                        {deleteMutation.isPending && deleteMutation.variables === room._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">{editingRoom ? "Edit Room" : "New Room"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            {editingRoom && (
              <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex gap-2 items-start text-xs text-amber-800">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <p>Do not use this form to transition a room's operational status (like OCCUPIED). Operational statuses should be managed via Front Desk operations.</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                <input type="text" required value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Category</label>
                <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold">
                  <option value="" disabled>Select Category</option>
                  {categories?.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Floor Name/Code</label>
                  <input type="text" required value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Floor Number (Sort)</label>
                  <input type="number" value={formData.floor_number} onChange={e => setFormData({...formData, floor_number: Number(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legacy Status (Forces Sell Status)</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-hotel-gold">
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="bg-hotel-black text-white px-6 py-2 rounded font-medium hover:bg-hotel-black/90 disabled:opacity-50 flex items-center gap-2">
                  {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Save Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
