import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Edit, Ban, CheckCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminGuests() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingGuest, setViewingGuest] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["guests", page, searchTerm],
    queryFn: async () => {
      const res = await api.get(`/guests?page=${page}&limit=10&search=${searchTerm}`);
      return res.data.data;
    }
  });

  const { data: viewData, isLoading: isLoadingView } = useQuery({
    queryKey: ["guestDetails", viewingGuest?._id],
    queryFn: async () => {
      if (!viewingGuest) return null;
      const res = await api.get(`/guests/${viewingGuest._id}`);
      return res.data.data;
    },
    enabled: !!viewingGuest
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await api.patch(`/guests/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["guestDetails"] });
      toast({ title: "Success", description: "Guest updated successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update", variant: "destructive" });
    }
  });

  const blockMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/guests/${id}/block`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["guestDetails"] });
      toast({ title: "Success", description: "Guest block status toggled" });
    }
  });

  const handleEdit = (guest: any) => {
    setEditingGuest(guest);
    setIsOpen(true);
  };

  const handleView = (guest: any) => {
    setViewingGuest(guest);
    setIsViewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Guest Management</h1>
          <p className="text-hotel-black/60">Manage guest profiles, view history, and handle VIPs</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            placeholder="Search by name, email, or phone..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Contact</th>
              <th className="px-4 py-3 font-medium text-gray-500">Bookings</th>
              <th className="px-4 py-3 font-medium text-gray-500">Spend</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.guests?.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No guests found</td></tr>
            ) : (
              data?.guests?.map((guest: any) => (
                <tr key={guest._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-hotel-black">{guest.fullName}</div>
                    {guest.isVip && <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 mt-1">VIP</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{guest.email}</div>
                    <div className="text-gray-500 text-xs">{guest.phone}</div>
                  </td>
                  <td className="px-4 py-3">{guest.totalBookings}</td>
                  <td className="px-4 py-3 font-medium">₹{guest.totalSpend}</td>
                  <td className="px-4 py-3">
                    {guest.isBlocked ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleView(guest)} title="View Details"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(guest)} title="Edit"><Edit className="h-4 w-4" /></Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          if (confirm(`Are you sure you want to ${guest.isBlocked ? 'unblock' : 'block'} this guest?`)) {
                            blockMutation.mutate(guest._id);
                          }
                        }}
                        title={guest.isBlocked ? "Unblock" : "Block"}
                      >
                        {guest.isBlocked ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-red-600" />}
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
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Guest</DialogTitle></DialogHeader>
          {editingGuest && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                id: editingGuest._id,
                data: {
                  fullName: fd.get("fullName"),
                  phone: fd.get("phone"),
                  address: fd.get("address"),
                  city: fd.get("city"),
                  country: fd.get("country"),
                  notes: fd.get("notes"),
                  isVip: fd.get("isVip") === "true",
                }
              });
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm">Full Name</label><Input name="fullName" defaultValue={editingGuest.fullName} required /></div>
                <div className="space-y-2"><label className="text-sm">Phone</label><Input name="phone" defaultValue={editingGuest.phone} required /></div>
              </div>
              <div className="space-y-2"><label className="text-sm">Email (Read-only)</label><Input value={editingGuest.email} disabled /></div>
              <div className="space-y-2"><label className="text-sm">Address</label><Input name="address" defaultValue={editingGuest.address} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm">City</label><Input name="city" defaultValue={editingGuest.city} /></div>
                <div className="space-y-2"><label className="text-sm">Country</label><Input name="country" defaultValue={editingGuest.country} /></div>
              </div>
              <div className="space-y-2"><label className="text-sm">Notes</label><Input name="notes" defaultValue={editingGuest.notes} /></div>
              <div className="space-y-2">
                <label className="text-sm block">VIP Status</label>
                <select name="isVip" defaultValue={editingGuest.isVip ? "true" : "false"} className="w-full border rounded-md p-2">
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Guest Profile</DialogTitle></DialogHeader>
          {isLoadingView ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-hotel-gold" /></div>
          ) : viewData && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{viewData.guest.fullName}</h2>
                  <p className="text-gray-500">{viewData.guest.email} • {viewData.guest.phone}</p>
                </div>
                <div className="flex gap-2">
                  {viewData.guest.isVip && <Badge variant="outline" className="bg-yellow-50 text-yellow-700">VIP</Badge>}
                  {viewData.guest.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Total Bookings</p>
                  <p className="text-xl font-bold">{viewData.guest.totalBookings}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Total Spend</p>
                  <p className="text-xl font-bold">₹{viewData.guest.totalSpend}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Last Stay</p>
                  <p className="text-lg font-bold">{viewData.guest.lastStay ? format(new Date(viewData.guest.lastStay), 'MMM d, yyyy') : 'Never'}</p>
                </div>
              </div>

              {viewData.guest.notes && (
                <div className="bg-blue-50 text-blue-900 p-4 rounded-lg">
                  <p className="font-semibold text-sm mb-1">Staff Notes:</p>
                  <p className="text-sm">{viewData.guest.notes}</p>
                </div>
              )}

              <div>
                <h3 className="font-bold mb-3 border-b pb-2">Recent Bookings</h3>
                {viewData.bookings.length === 0 ? (
                  <p className="text-gray-500 text-sm">No bookings found.</p>
                ) : (
                  <div className="space-y-3">
                    {viewData.bookings.map((booking: any) => (
                      <div key={booking._id} className="flex justify-between items-center border p-3 rounded hover:bg-gray-50">
                        <div>
                          <div className="font-semibold">{booking.roomCategory?.name} {booking.assignedRoom ? `(Room ${booking.assignedRoom.roomNumber})` : ''}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(booking.checkInDate), 'MMM d')} - {format(new Date(booking.checkOutDate), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">₹{booking.totalAmount}</div>
                          <Badge variant="outline">{booking.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
