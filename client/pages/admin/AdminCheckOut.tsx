import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { LogOut, Search, User, Calendar, Loader2, ArrowLeft, LogIn } from "lucide-react";

async function apiFetch(url: string, token?: string, method = "GET", body?: any) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

export default function AdminCheckOut() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["checkOutBookings", search],
    queryFn: () =>
      apiFetch(
        `/api/admin/bookings?status=CHECKED_IN&search=${encodeURIComponent(search)}`,
        user?.token
      ),
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/bookings/${id}/check-out`, user?.token, "POST"),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "✅ Checked Out",
          description: `${selectedBooking?.guestDetails.firstName} has been checked out. Housekeeping task auto-created.`,
        });
        setSelectedBooking(null);
        setConfirmed(false);
        queryClient.invalidateQueries({ queryKey: ["checkOutBookings"] });
        queryClient.invalidateQueries({ queryKey: ["checkInBookings"] });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const bookings = bookingsData?.data?.bookings ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <h1 className="font-semibold text-gray-900 flex items-center gap-2">
            <LogOut size={18} className="text-red-600" /> Check-Out Management
          </h1>
        </div>
        <Link to="/admin/check-in" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          <LogIn size={16} /> Go to Check-In →
        </Link>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking List */}
          <div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Currently Checked-In Guests</p>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search guest or booking reference..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[500px]">
                {isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No guests currently checked in.</div>
                ) : (
                  bookings.map((b: any) => (
                    <button
                      key={b._id}
                      onClick={() => { setSelectedBooking(b); setConfirmed(false); }}
                      className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedBooking?._id === b._id ? "bg-red-50 border-l-2 border-l-red-500" : ""}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{b.guestDetails.firstName} {b.guestDetails.lastName}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{b.bookingReference}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">{format(new Date(b.checkOutDate), "MMM dd")} checkout</p>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full">CHECKED IN</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {b.roomCategory?.name} · Room {b.assignedRoom?.roomNumber ?? "N/A"} · Floor {b.assignedRoom?.floor ?? "—"}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Check-Out Panel */}
          <div>
            {selectedBooking ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-red-50 border-b border-red-100 px-6 py-4">
                  <h2 className="font-semibold text-red-800 flex items-center gap-2">
                    <LogOut size={18} /> Process Check-Out
                  </h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Guest</p>
                      <p className="font-medium text-gray-900">{selectedBooking.guestDetails.firstName} {selectedBooking.guestDetails.lastName}</p>
                      <p className="text-gray-500">{selectedBooking.guestDetails.email}</p>
                      <p className="text-gray-500">{selectedBooking.guestDetails.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Stay</p>
                      <p className="font-medium text-gray-900">{selectedBooking.roomCategory?.name}</p>
                      <p className="text-gray-500">Room {selectedBooking.assignedRoom?.roomNumber ?? "N/A"} · Floor {selectedBooking.assignedRoom?.floor ?? "—"}</p>
                      <p className="text-gray-500 flex items-center gap-1 mt-1"><Calendar size={12} /> Checkout: {format(new Date(selectedBooking.checkOutDate), "MMM dd, yyyy")}</p>
                    </div>
                  </div>

                  {/* Billing */}
                  <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Bill Summary</p>
                    <div className="flex justify-between text-gray-700">
                      <span>Room Charges</span>
                      <span>₹{(selectedBooking.totalAmount - selectedBooking.taxAmount).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>GST (18%)</span>
                      <span>₹{selectedBooking.taxAmount?.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                      <span>Total</span>
                      <span>₹{selectedBooking.totalAmount?.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-green-700 font-medium">
                      <span>Paid</span>
                      <span>₹{selectedBooking.paidAmount?.toLocaleString("en-IN") ?? 0}</span>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700">
                    ⚠️ This will mark the booking as CHECKED OUT and automatically create a housekeeping task for the room.
                  </div>

                  {/* Confirm toggle */}
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="w-4 h-4 accent-red-600" />
                    <span className="text-gray-700">I confirm that the guest has vacated the room.</span>
                  </label>

                  <button
                    disabled={!confirmed || checkOutMutation.isPending}
                    onClick={() => checkOutMutation.mutate(selectedBooking._id)}
                    className="w-full bg-red-600 text-white py-3 rounded font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {checkOutMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    Confirm Check-Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center h-full min-h-[300px] text-center text-gray-400">
                <div>
                  <User size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Select a checked-in guest to process check-out.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
