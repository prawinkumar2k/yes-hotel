import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  OCCUPIED: "bg-red-100 text-red-700",
  RESERVED: "bg-blue-100 text-blue-700",
  CLEANING: "bg-yellow-100 text-yellow-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  OUT_OF_SERVICE: "bg-gray-100 text-gray-500",
};

const ALL_STATUSES = ["AVAILABLE","RESERVED","OCCUPIED","CLEANING","MAINTENANCE","OUT_OF_SERVICE"];

export default function AdminRooms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["adminRooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms", { headers: { Authorization: `Bearer ${user?.token}` } });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/rooms/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["adminRooms"] });
        toast({ title: "Room updated", description: "Status changed successfully." });
        setEditingRoom(null);
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-hotel-black text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/dashboard" className="font-serif text-lg text-hotel-gold uppercase tracking-widest">YES HOTELS</Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Room Management</span>
      </div>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Physical Rooms</h1>
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Room #","Category","Floor","Status","Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(8).fill(0).map((_,i) => (
                  <tr key={i}>{Array(5).fill(0).map((_,j) => <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : (rooms ?? []).map((room: any) => (
                <tr key={room._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-bold text-gray-800">{room.roomNumber}</td>
                  <td className="px-5 py-3 text-gray-600">{room.category?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-600">Floor {room.floor}</td>
                  <td className="px-5 py-3">
                    {editingRoom === room._id ? (
                      <div className="flex items-center gap-2">
                        <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-hotel-gold">
                          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => updateStatus.mutate({ id: room._id, status: newStatus })}
                          className="bg-hotel-gold text-hotel-black text-xs px-3 py-1 rounded font-medium hover:bg-yellow-500">Save</button>
                        <button onClick={() => setEditingRoom(null)} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[room.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {room.status}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => { setEditingRoom(room._id); setNewStatus(room.status); }}
                      className="text-xs text-hotel-gold hover:underline">Change Status</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
