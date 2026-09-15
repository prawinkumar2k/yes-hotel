import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const STATUS_BAR: Record<string, string> = {
  DIRTY: "bg-red-500",
  CLEANING: "bg-blue-500",
  CLEANING_COMPLETED: "bg-cyan-400",
  INSPECTED: "bg-emerald-500",
};

const STATUS_BADGE: Record<string, string> = {
  DIRTY: "bg-red-500/10 text-red-400 border-red-500/30",
  CLEANING: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  CLEANING_COMPLETED: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  INSPECTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const OCCUPANCY_BADGE: Record<string, string> = {
  VACANT: "bg-white/5 text-zinc-300 border-white/10",
  OCCUPIED: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  DEPARTING: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  ARRIVING: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

const OCCUPANCY_LABEL: Record<string, string> = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  DEPARTING: "Check-out today",
  ARRIVING: "Check-in today",
};

export default function MobileHousekeeping() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["housekeeping-assignments", user?._id],
    queryFn: async () => {
      // In a real implementation this might fetch assignments specific to the user.
      // For now we get all rooms that need cleaning or inspection.
      const res = await api.get("/housekeeping/dashboard");
      return res.data.data.rooms;
    },
    refetchInterval: 30000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string, status: string, notes?: string }) => {
      const res = await api.patch(`/housekeeping/rooms/${id}/status`, { status, notes });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["housekeeping-assignments"] });
      toast({ title: "Status Updated" });
    },
    onError: (e: any) => {
      toast({ title: "Update Failed", description: e.response?.data?.message, variant: "destructive" });
    }
  });

  const handleAction = (roomId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: roomId, status: newStatus });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-semibold text-white">My Assignments</h2>
          <p className="text-xs text-zinc-400">Rooms needing housekeeping action</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => qc.invalidateQueries({ queryKey: ["housekeeping-assignments"] })}
          className="text-zinc-400 hover:text-white hover:bg-white/5"
        >
          <RefreshCw className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-hotel-gold" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center p-8 text-zinc-500">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-3 text-emerald-500 opacity-60" />
            <p>No pending assignments.</p>
          </div>
        ) : (
          assignments.map((room: any) => (
            <div key={room._id} className="overflow-hidden rounded-xl bg-[#15171b] border border-white/10 shadow-sm">
              <div className={`h-1.5 w-full ${STATUS_BAR[room.housekeepingStatus] || "bg-zinc-700"}`} />
              <div className="p-4 pb-3 border-b border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white">Room {room.roomNumber}</h2>
                    <p className="text-sm text-zinc-400">{room.category?.name || "Standard Room"}</p>
                  </div>
                  <Badge variant="outline" className={`font-semibold ${STATUS_BADGE[room.housekeepingStatus] || "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>
                    {room.housekeepingStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {room.occupancyStatus && OCCUPANCY_LABEL[room.occupancyStatus] && (
                    <Badge variant="outline" className={OCCUPANCY_BADGE[room.occupancyStatus]}>
                      <User className="h-3 w-3 mr-1" /> {OCCUPANCY_LABEL[room.occupancyStatus]}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2 w-full mt-2">
                  {room.housekeepingStatus === 'DIRTY' && (
                    <Button onClick={() => handleAction(room._id, 'CLEANING')} className="flex-1 bg-hotel-gold hover:bg-champagne text-black font-semibold">Start Cleaning</Button>
                  )}
                  {room.housekeepingStatus === 'CLEANING' && (
                    <Button onClick={() => handleAction(room._id, 'CLEANING_COMPLETED')} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Finish Cleaning</Button>
                  )}
                  {room.housekeepingStatus === 'CLEANING_COMPLETED' && user?.role === 'MANAGER' && (
                    <Button onClick={() => handleAction(room._id, 'INSPECTED')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"><ShieldCheck className="h-4 w-4 mr-2"/> Pass Inspection</Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
