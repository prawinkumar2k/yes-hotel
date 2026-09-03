import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { Search } from "lucide-react";

const TASK_STATUS_COLORS: Record<string, string> = {
  DIRTY: "bg-red-100 text-red-700",
  ASSIGNED: "bg-yellow-100 text-yellow-700",
  CLEANING: "bg-blue-100 text-blue-700",
  CLEAN: "bg-green-100 text-green-700",
  INSPECTED: "bg-purple-100 text-purple-700",
};

const TASK_STATUSES = ["DIRTY","ASSIGNED","CLEANING","CLEAN","INSPECTED"];

export default function AdminHousekeeping() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["housekeepingTasks"],
    queryFn: async () => {
      const res = await fetch("/api/admin/housekeeping", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/housekeeping/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["housekeepingTasks"] });
        toast({ title: "Task updated" });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const filtered = (tasks ?? []).filter((t: any) =>
    !search || t.room?.roomNumber?.includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-hotel-black text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/dashboard" className="font-serif text-lg text-hotel-gold uppercase tracking-widest">YES HOTELS</Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Housekeeping</span>
      </div>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Housekeeping Tasks</h1>
          <div className="flex items-center border border-gray-200 rounded px-3 py-2 gap-2 bg-white">
            <Search size={15} className="text-gray-400" />
            <input type="text" placeholder="Search by room..."
              className="text-sm bg-transparent focus:outline-none"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Status columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {TASK_STATUSES.map(status => (
            <div key={status} className="bg-white rounded shadow-sm">
              <div className={`px-4 py-2 rounded-t text-xs font-bold uppercase tracking-widest ${TASK_STATUS_COLORS[status]}`}>
                {status}
              </div>
              <div className="p-2 space-y-2 min-h-24">
                {isLoading ? (
                  <div className="h-12 bg-gray-100 rounded animate-pulse" />
                ) : filtered.filter((t: any) => t.status === status).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No tasks</p>
                ) : (
                  filtered.filter((t: any) => t.status === status).map((task: any) => (
                    <div key={task._id} className="border border-gray-100 rounded p-2 text-xs">
                      <p className="font-bold text-gray-700">Room {task.room?.roomNumber ?? "—"}</p>
                      {task.notes && <p className="text-gray-400 mt-0.5 truncate">{task.notes}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {TASK_STATUSES.filter(s => s !== status).map(s => (
                          <button key={s} onClick={() => updateTask.mutate({ id: task._id, status: s })}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-hotel-gold hover:text-hotel-black transition-colors">
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
