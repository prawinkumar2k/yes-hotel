import { useState } from "react";
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

  const [proofModal, setProofModal] = useState<{ open: boolean; roomId: string; targetStatus: string; roomNumber?: string }>({ open: false, roomId: "", targetStatus: "" });
  const [proofPhoto, setProofPhoto] = useState<string>("");
  const [viewPhotoModal, setViewPhotoModal] = useState<string | null>(null);

  const handleMobilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes, cleaningProofPhoto }: { id: string, status: string, notes?: string, cleaningProofPhoto?: string }) => {
      const res = await api.patch(`/housekeeping/rooms/${id}/status`, { status, notes, cleaningProofPhoto });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["housekeeping-assignments"] });
      setProofModal({ open: false, roomId: "", targetStatus: "" });
      setProofPhoto("");
      toast({ title: "Status Updated & Proof Saved" });
    },
    onError: (e: any) => {
      toast({ title: "Update Failed", description: e.response?.data?.message, variant: "destructive" });
    }
  });

  const handleAction = (roomId: string, newStatus: string, roomNumber?: string, photoOverride?: string) => {
    if ((newStatus === 'CLEANING_COMPLETED' || newStatus === 'INSPECTED') && !photoOverride && !proofPhoto) {
      setProofModal({ open: true, roomId, targetStatus: newStatus, roomNumber });
      return;
    }
    updateStatusMutation.mutate({ id: roomId, status: newStatus, cleaningProofPhoto: photoOverride || proofPhoto || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-semibold text-white">My Assignments</h2>
          <p className="text-xs text-zinc-400">Rooms needing housekeeping action & proof photo upload</p>
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  {room.occupancyStatus && OCCUPANCY_LABEL[room.occupancyStatus] && (
                    <Badge variant="outline" className={OCCUPANCY_BADGE[room.occupancyStatus]}>
                      <User className="h-3 w-3 mr-1" /> {OCCUPANCY_LABEL[room.occupancyStatus]}
                    </Badge>
                  )}
                  {(room.cleaningProofPhoto || room.lastCleaningProofPhoto) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewPhotoModal(room.cleaningProofPhoto || room.lastCleaningProofPhoto)}
                      className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                    >
                      📷 View Cleaning Proof
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 w-full mt-2">
                  {room.housekeepingStatus === 'DIRTY' && (
                    <Button onClick={() => handleAction(room._id, 'CLEANING', room.roomNumber)} className="flex-1 bg-hotel-gold hover:bg-champagne text-black font-semibold">Start Cleaning</Button>
                  )}
                  {room.housekeepingStatus === 'CLEANING' && (
                    <Button onClick={() => handleAction(room._id, 'CLEANING_COMPLETED', room.roomNumber)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Finish Cleaning & Upload Photo</Button>
                  )}
                  {room.housekeepingStatus === 'CLEANING_COMPLETED' && user?.role === 'MANAGER' && (
                    <Button onClick={() => handleAction(room._id, 'INSPECTED', room.roomNumber)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"><ShieldCheck className="h-4 w-4 mr-2"/> Pass Inspection</Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Cleaning Proof Photo Dialog */}
      {proofModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15171b] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 text-white shadow-2xl">
            <h3 className="font-bold text-base flex items-center gap-2">📷 Upload Cleaning Proof Photo</h3>
            <p className="text-xs text-zinc-400">Snap a photo of Room {proofModal.roomNumber || "Work"} (bed, bathroom, room) to complete turnover.</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleMobilePhotoChange}
              className="text-xs text-zinc-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-hotel-gold file:text-black cursor-pointer"
            />
            {proofPhoto && (
              <img src={proofPhoto} alt="Cleaning Proof Preview" className="h-36 w-full object-cover rounded-lg border border-white/10" />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setProofModal({ open: false, roomId: "", targetStatus: "" })}>Cancel</Button>
              <Button size="sm" onClick={() => handleAction(proofModal.roomId, proofModal.targetStatus, proofModal.roomNumber, proofPhoto)} className="bg-hotel-gold text-black font-bold">Submit Photo & Complete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Viewing Photo Dialog */}
      {viewPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewPhotoModal(null)}>
          <div className="max-w-md w-full bg-[#15171b] p-4 rounded-xl border border-white/10 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center text-xs font-bold text-white border-b border-white/10 pb-2">
              <span>📷 Room Cleaning Proof Photo</span>
              <button onClick={() => setViewPhotoModal(null)} className="text-zinc-400">✕</button>
            </div>
            <img src={viewPhotoModal} alt="Cleaning Proof" className="max-h-[60vh] w-full object-contain rounded-lg" />
            <Button size="sm" onClick={() => setViewPhotoModal(null)} className="w-full bg-zinc-800 text-white">Close View</Button>
          </div>
        </div>
      )}
    </div>
  );
}
