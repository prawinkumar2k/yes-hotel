import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  ASSIGNED: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default function AdminMaintenance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTicket, setNewTicket] = useState({ roomId: "", issueTitle: "", description: "", priority: "MEDIUM" });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["maintenanceTickets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/maintenance", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  const { data: rooms } = useQuery({
    queryKey: ["adminRooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms", { headers: { Authorization: `Bearer ${user?.token}` } });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  const createTicket = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["maintenanceTickets"] });
        toast({ title: "Ticket created" });
        setShowCreate(false);
        setNewTicket({ roomId: "", issueTitle: "", description: "", priority: "MEDIUM" });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const resolveTicket = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/maintenance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenanceTickets"] });
      toast({ title: "Ticket resolved" });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-hotel-black text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/dashboard" className="font-serif text-lg text-hotel-gold uppercase tracking-widest">YES HOTELS</Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Maintenance</span>
      </div>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Maintenance Tickets</h1>
          <button onClick={() => setShowCreate(!showCreate)}
            className="bg-hotel-gold text-hotel-black text-sm font-medium px-5 py-2 rounded hover:bg-yellow-500 transition-colors">
            + New Ticket
          </button>
        </div>

        {showCreate && (
          <div className="bg-white rounded shadow-sm p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Create Maintenance Ticket</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Room</label>
                <select value={newTicket.roomId} onChange={e => setNewTicket(f => ({ ...f, roomId: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-hotel-gold">
                  <option value="">Select room</option>
                  {(rooms ?? []).map((r: any) => (
                    <option key={r._id} value={r._id}>Room {r.roomNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Priority</label>
                <select value={newTicket.priority} onChange={e => setNewTicket(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-hotel-gold">
                  {["LOW","MEDIUM","HIGH","CRITICAL"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Issue Title</label>
                <input type="text" value={newTicket.issueTitle}
                  onChange={e => setNewTicket(f => ({ ...f, issueTitle: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-hotel-gold" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea value={newTicket.description}
                  onChange={e => setNewTicket(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-hotel-gold resize-none" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => createTicket.mutate(newTicket)}
                className="bg-hotel-gold text-hotel-black text-sm font-medium px-6 py-2 rounded hover:bg-yellow-500 transition-colors">
                Create Ticket
              </button>
              <button onClick={() => setShowCreate(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {isLoading ? (
            Array(4).fill(0).map((_,i) => <div key={i} className="h-20 bg-white rounded shadow-sm animate-pulse" />)
          ) : (tickets ?? []).length === 0 ? (
            <div className="bg-white rounded shadow-sm p-12 text-center">
              <CheckCircle size={40} className="mx-auto text-green-400 mb-3" />
              <p className="text-gray-400">No open maintenance tickets.</p>
            </div>
          ) : (
            (tickets ?? []).map((ticket: any) => (
              <div key={ticket._id} className="bg-white rounded shadow-sm p-5 flex items-start justify-between">
                <div className="flex gap-3">
                  <AlertTriangle size={18} className={ticket.priority === "CRITICAL" ? "text-red-500" : "text-orange-400"} />
                  <div>
                    <p className="font-semibold text-gray-800">{ticket.issueTitle}</p>
                    <p className="text-sm text-gray-500 mt-0.5">Room {ticket.room?.roomNumber ?? "—"} · {ticket.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${TICKET_STATUS_COLORS[ticket.status]}`}>{ticket.status}</span>
                  {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                    <button onClick={() => resolveTicket.mutate(ticket._id)}
                      className="text-xs text-green-600 hover:underline">Resolve</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
