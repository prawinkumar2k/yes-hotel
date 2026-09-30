import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const STATUSES = ["ALL", "NEW", "CONTACTED", "CLOSED"];

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED: "bg-green-50 text-green-700 border-green-200",
};

export default function AdminEnquiries() {
  const { toast } = useToast();
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["booking-enquiries", page, status],
    queryFn: async () => {
      const res = await api.get(`/admin/booking-enquiries?page=${page}&limit=15${status !== "ALL" ? `&status=${status}` : ""}`);
      return res.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const res = await api.patch(`/admin/booking-enquiries/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-enquiries"] });
      toast({ title: "Success", description: "Enquiry status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/booking-enquiries/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-enquiries"] });
      toast({ title: "Success", description: "Enquiry deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to delete", variant: "destructive" });
    },
  });

  const handleView = (enq: any) => {
    setViewing(enq);
    if (enq.status === "NEW") {
      updateStatusMutation.mutate({ id: enq._id, newStatus: "CONTACTED" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-white">Booking Enquiries</h1>
        <p className="text-zinc-400">Leads collected by the website concierge chatbot, ready for front-desk follow-up</p>
      </div>

      <div className="flex gap-2 mb-6">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left text-gray-900">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Guest</th>
              <th className="px-4 py-3 font-medium text-gray-500">Stay</th>
              <th className="px-4 py-3 font-medium text-gray-500">Guests / Rooms</th>
              <th className="px-4 py-3 font-medium text-gray-500">Received</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.enquiries?.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No enquiries found</td></tr>
            ) : (
              data?.enquiries?.map((enq: any) => (
                <tr key={enq._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-hotel-black">{enq.guestName}</div>
                    <div className="text-gray-500 text-xs">{enq.phone}{enq.email ? ` · ${enq.email}` : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    {format(new Date(enq.checkIn), "MMM d")} — {format(new Date(enq.checkOut), "MMM d, yyyy")}
                    <div className="text-gray-500 text-xs">{enq.nights} night{enq.nights === 1 ? "" : "s"} · {enq.roomType}</div>
                  </td>
                  <td className="px-4 py-3">
                    {enq.adults} adult{enq.adults === 1 ? "" : "s"}{enq.children > 0 ? `, ${enq.children} child${enq.children === 1 ? "" : "ren"}` : ""}
                    <div className="text-gray-500 text-xs">{enq.rooms} room{enq.rooms === 1 ? "" : "s"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(enq.createdAt), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_STYLES[enq.status]}>{enq.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleView(enq)} title="View"><Eye className="h-4 w-4" /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this enquiry permanently?")) {
                            deleteMutation.mutate(enq._id);
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data?.totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enquiry from {viewing?.guestName}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-2">
                <p><span className="font-medium text-hotel-black">Name:</span> {viewing.guestName}</p>
                <p><span className="font-medium text-hotel-black">Phone:</span> {viewing.phone}</p>
                <p><span className="font-medium text-hotel-black">Email:</span> {viewing.email || "Not provided"}</p>
                <p><span className="font-medium text-hotel-black">Check-in:</span> {format(new Date(viewing.checkIn), "d MMMM yyyy")}</p>
                <p><span className="font-medium text-hotel-black">Check-out:</span> {format(new Date(viewing.checkOut), "d MMMM yyyy")}</p>
                <p><span className="font-medium text-hotel-black">Stay:</span> {viewing.nights} night{viewing.nights === 1 ? "" : "s"}</p>
                <p><span className="font-medium text-hotel-black">Guests:</span> {viewing.adults} adult{viewing.adults === 1 ? "" : "s"}, {viewing.children} child{viewing.children === 1 ? "" : "ren"}</p>
                <p><span className="font-medium text-hotel-black">Rooms:</span> {viewing.rooms} · {viewing.roomType}</p>
                {viewing.roomSubtotal != null && (
                  <p><span className="font-medium text-hotel-black">Est. Room Subtotal:</span> ₹{viewing.roomSubtotal.toLocaleString("en-IN")}</p>
                )}
                <p className="text-gray-500 text-xs pt-1">Received {format(new Date(viewing.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.filter((s) => s !== "ALL").map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={viewing.status === s ? "default" : "outline"}
                    onClick={() => {
                      updateStatusMutation.mutate({ id: viewing._id, newStatus: s });
                      setViewing({ ...viewing, status: s });
                    }}
                  >
                    Mark {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
