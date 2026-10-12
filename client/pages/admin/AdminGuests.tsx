import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Edit, Ban, CheckCircle, Eye, UserPlus, Plus, Printer, FileCheck2, Receipt, ExternalLink, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function AdminGuests() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post("/guests", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      toast({ title: "Success", description: "New guest registered successfully" });
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Registration Failed", description: error.response?.data?.message || "Failed to create guest profile", variant: "destructive" });
    }
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-hotel-black font-bold">Guest Directory</h1>
          <p className="text-hotel-black/60 text-sm">Manage guest profiles, view stay history, and handle VIPs</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-hotel-gold text-black hover:bg-amber-600 font-bold w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Register New Guest
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            placeholder="Search by name, email, or phone..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10 text-black font-medium"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border table-scroll">
        <table className="w-full text-sm text-left text-gray-900">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm">Full Name</label><Input name="fullName" defaultValue={editingGuest.fullName} required /></div>
                <div className="space-y-2"><label className="text-sm">Phone</label><Input name="phone" defaultValue={editingGuest.phone} required /></div>
              </div>
              <div className="space-y-2"><label className="text-sm">Email (Read-only)</label><Input value={editingGuest.email} disabled /></div>
              <div className="space-y-2"><label className="text-sm">Address</label><Input name="address" defaultValue={editingGuest.address} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                    {viewData.guest.loyaltyTier}
                  </Badge>
                  {viewData.guest.isVip && <Badge variant="outline" className="bg-yellow-50 text-yellow-700">VIP</Badge>}
                  {viewData.guest.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Bookings</p>
                  <p className="text-xl font-bold font-serif text-gray-900 mt-0.5">{viewData.guest.totalBookings || 0}</p>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Spend</p>
                  <p className="text-xl font-bold font-serif text-gray-900 mt-0.5">₹{Number(viewData.guest.totalSpend || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loyalty Points</p>
                  <p className="text-xl font-bold font-serif text-purple-700 mt-0.5">{viewData.guest.loyaltyPoints || 0}</p>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Last Stay</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{viewData.guest.lastStay ? format(new Date(viewData.guest.lastStay), 'MMM d, yyyy') : 'Never'}</p>
                </div>
              </div>

              {viewData.guest.notes && (
                <div className="bg-blue-50 text-blue-900 p-4 rounded-lg">
                  <p className="font-semibold text-sm mb-1">Staff Notes:</p>
                  <p className="text-sm">{viewData.guest.notes}</p>
                </div>
              )}

              {/* ID Proof Photo Verification */}
              {(viewData.guest?.idProofPhoto || viewData.bookings?.some((b: any) => b.idProofPhoto)) && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">📷 Verified ID Proof Photo Attached</p>
                    <p className="text-xs text-emerald-700">Official identity verification document collected at check-in</p>
                  </div>
                  <button
                    onClick={() => {
                      const proofUrl = viewData.guest?.idProofPhoto || viewData.bookings?.find((b: any) => b.idProofPhoto)?.idProofPhoto;
                      if (proofUrl) window.open(proofUrl, "_blank");
                    }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold transition shadow-sm"
                  >
                    View ID Proof Photo
                  </button>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h3 className="font-bold text-base font-serif text-gray-900">
                    Stay History, Reports &amp; Invoices ({viewData.bookings.length})
                  </h3>
                  <a
                    href="/admin/reports/bulk-docs"
                    target="_blank"
                    className="text-xs font-bold text-[#c9a227] hover:underline flex items-center gap-1"
                  >
                    <Printer size={13} /> Bulk GRC &amp; GST Viewer
                  </a>
                </div>
                {viewData.bookings.length === 0 ? (
                  <p className="text-gray-500 text-sm">No bookings found.</p>
                ) : (
                  <div className="space-y-3">
                    {viewData.bookings.map((booking: any) => {
                      const roomNo = booking.assignedRoom?.roomNumber || "—";
                      const billNo = booking.billNumber || booking.bookingReference?.slice(-4) || "—";
                      return (
                        <div key={booking._id} className="border border-gray-200 bg-white p-3.5 rounded-xl shadow-sm hover:border-gray-400 transition space-y-2">
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div>
                              <div className="font-bold text-gray-900 flex items-center gap-2">
                                <span>Room {roomNo}</span>
                                <span className="text-xs font-normal text-gray-500">({booking.roomCategory?.name || "Standard"})</span>
                                <span className="text-xs font-mono font-semibold bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">Bill #{billNo}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5 font-mono">
                                {format(new Date(booking.checkInDate), "dd MMM yyyy")} &rarr; {format(new Date(booking.checkOutDate), "dd MMM yyyy")}
                                <span className="text-gray-400 ml-2">&bull; Ref: {booking.bookingReference}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-mono font-black text-sm text-gray-900">₹{booking.totalAmount?.toLocaleString()}</div>
                              <Badge variant="outline" className={`text-[10px] uppercase font-bold mt-0.5 ${booking.status === "CHECKED_IN" ? "bg-green-50 text-green-700 border-green-200" : booking.status === "CHECKED_OUT" ? "bg-blue-50 text-blue-700 border-blue-200" : ""}`}>
                                {booking.status}
                              </Badge>
                            </div>
                          </div>

                          {/* Quick Document & Report Action Links */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/admin/bookings/${booking._id}/grc-print`}
                                target="_blank"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-bold text-[11px] transition shadow-xs"
                              >
                                <FileCheck2 size={13} className="text-[#c9a227]" /> View GRC
                              </Link>
                              <Link
                                to={`/admin/bookings/${booking._id}/folio-print`}
                                target="_blank"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded font-bold text-[11px] transition shadow-xs"
                              >
                                <Receipt size={13} className="text-blue-700" /> View GST Invoice
                              </Link>
                              <Link
                                to={`/admin/bookings/${booking._id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-300 rounded font-bold text-[11px] transition"
                              >
                                <ExternalLink size={12} /> Open Booking
                              </Link>
                            </div>

                            {booking.idProofPhoto && (
                              <button
                                onClick={() => window.open(booking.idProofPhoto, "_blank")}
                                className="text-[11px] text-indigo-600 hover:underline font-semibold flex items-center gap-1"
                              >
                                📷 ID Photo
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {viewData.complaints?.length > 0 && (
                <div>
                  <h3 className="font-bold mb-3 border-b pb-2">Complaints History</h3>
                  <div className="space-y-3">
                    {viewData.complaints.map((complaint: any) => (
                      <div key={complaint._id} className="flex justify-between items-center border border-red-100 bg-red-50/50 p-3 rounded">
                        <div>
                          <div className="font-semibold">{complaint.issue}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(complaint.reportedAt), 'MMM d, yyyy')} • {complaint.department}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={complaint.status === "RESOLVED" ? "secondary" : "destructive"}>{complaint.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Guest Registration Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-hotel-gold" />
              Manual Guest Registration
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({
                fullName: fd.get("fullName"),
                email: fd.get("email"),
                phone: fd.get("phone"),
                address: fd.get("address"),
                city: fd.get("city"),
                country: fd.get("country"),
                idType: fd.get("idType"),
                idNumber: fd.get("idNumber"),
                notes: fd.get("notes"),
                isVip: fd.get("isVip") === "true",
              });
            }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-600">Full Name *</label>
                <Input name="fullName" placeholder="e.g. Rahul Sharma" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-600">Phone *</label>
                <Input name="phone" placeholder="+91 9876543210" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-gray-600">Email Address *</label>
              <Input name="email" type="email" placeholder="rahul@example.com" required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-600">ID Type</label>
                <select name="idType" className="w-full border rounded-md p-2 text-sm">
                  <option value="Aadhaar">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Voter ID">Voter ID</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-600">ID Number</label>
                <Input name="idNumber" placeholder="XXXX-XXXX-XXXX" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-600">City</label>
                <Input name="city" placeholder="Bengaluru" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-600">Country</label>
                <Input name="country" defaultValue="India" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-gray-600">VIP Status</label>
              <select name="isVip" className="w-full border rounded-md p-2 text-sm">
                <option value="false">Standard Guest</option>
                <option value="true">VIP Guest</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-gray-600">Staff Notes</label>
              <Input name="notes" placeholder="Special preferences or requirements..." />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-hotel-gold text-black font-bold">
                {createMutation.isPending ? "Creating..." : "Create Guest Profile"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

