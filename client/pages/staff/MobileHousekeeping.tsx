import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function MobileHousekeeping() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  
  // Mobile check
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  if (!isMobile) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[60vh]">
        <AlertTriangle className="h-12 w-12 mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold mb-2">Mobile View Only</h2>
        <p className="max-w-md">This view is optimized for housekeeping staff using mobile devices. Please use a mobile device or switch your browser to mobile preview.</p>
      </div>
    );
  }

  const handleAction = (roomId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: roomId, status: newStatus });
  };

  return (
    <div className="pb-16 bg-gray-50 min-h-screen">
      <div className="bg-hotel-black text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg">My Assignments</h1>
            <p className="text-xs text-gray-300">Housekeeping Staff</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["housekeeping-assignments"] })} className="text-white">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-hotel-gold" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-3 text-green-500 opacity-50" />
            <p>No pending assignments.</p>
          </div>
        ) : (
          assignments.map((room: any) => (
            <Card key={room._id} className="overflow-hidden border-0 shadow-sm rounded-xl">
              <div className={`h-1.5 w-full ${
                room.housekeepingStatus === 'DIRTY' ? 'bg-red-500' :
                room.housekeepingStatus === 'CLEANING' ? 'bg-yellow-500' :
                room.housekeepingStatus === 'CLEANING_COMPLETED' ? 'bg-blue-500' :
                room.housekeepingStatus === 'INSPECTED' ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              <CardHeader className="p-4 pb-2 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-hotel-black">Room {room.roomNumber}</h2>
                    <p className="text-sm text-muted-foreground">{room.category?.name || "Standard Room"}</p>
                  </div>
                  <Badge variant="outline" className={`font-semibold ${
                    room.housekeepingStatus === 'DIRTY' ? 'text-red-700 bg-red-50 border-red-200' :
                    room.housekeepingStatus === 'CLEANING' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
                    room.housekeepingStatus === 'CLEANING_COMPLETED' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                    'text-gray-700 bg-gray-50 border-gray-200'
                  }`}>
                    {room.housekeepingStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2 mb-4">
                   {room.occupancyStatus === 'VACANT' && <Badge variant="secondary" className="bg-gray-100"><User className="h-3 w-3 mr-1" /> Vacant</Badge>}
                   {room.occupancyStatus === 'OCCUPIED' && <Badge variant="secondary" className="bg-blue-100 text-blue-800"><User className="h-3 w-3 mr-1" /> Occupied</Badge>}
                   {room.occupancyStatus === 'DEPARTING' && <Badge variant="secondary" className="bg-orange-100 text-orange-800"><User className="h-3 w-3 mr-1" /> Check-out today</Badge>}
                   {room.occupancyStatus === 'ARRIVING' && <Badge variant="secondary" className="bg-emerald-100 text-emerald-800"><User className="h-3 w-3 mr-1" /> Check-in today</Badge>}
                </div>
                
                <div className="flex gap-2 w-full mt-2">
                  {room.housekeepingStatus === 'DIRTY' && (
                    <Button onClick={() => handleAction(room._id, 'CLEANING')} className="flex-1 bg-hotel-gold hover:bg-yellow-600">Start Cleaning</Button>
                  )}
                  {room.housekeepingStatus === 'CLEANING' && (
                    <Button onClick={() => handleAction(room._id, 'CLEANING_COMPLETED')} className="flex-1">Finish Cleaning</Button>
                  )}
                  {room.housekeepingStatus === 'CLEANING_COMPLETED' && user?.role === 'MANAGER' && (
                     <Button onClick={() => handleAction(room._id, 'INSPECTED')} className="flex-1 bg-green-600 hover:bg-green-700"><ShieldCheck className="h-4 w-4 mr-2"/> Pass Inspection</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
